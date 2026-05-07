-- v384 Backend Source of Truth Gate
-- Evidence layer for tracking whether critical ERP workflows are local/demo,
-- staging foundation, worker-backed, or backend-authoritative.

create extension if not exists pgcrypto;

create table if not exists public.backend_authority_snapshots (
  id uuid primary key default gen_random_uuid(),
  gate_status text not null default 'local-watch',
  gate_score integer not null default 0,
  production_blockers integer not null default 0,
  workflow_counts jsonb not null default '{}'::jsonb,
  backend_objects jsonb not null default '[]'::jsonb,
  local_risks jsonb not null default '[]'::jsonb,
  evidence jsonb not null default '{}'::jsonb,
  recorded_by uuid references auth.users(id),
  recorded_at timestamptz not null default now()
);

create table if not exists public.backend_authority_events (
  id uuid primary key default gen_random_uuid(),
  snapshot_id uuid references public.backend_authority_snapshots(id) on delete set null,
  event_type text not null,
  severity text not null default 'info',
  message text,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.backend_authority_registry (
  key text primary key,
  module text not null,
  workflow text not null,
  current_authority text not null,
  target_authority text not null,
  required_backend_object text not null,
  required_gate text not null,
  risk text not null default 'high',
  production_blocking boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists backend_authority_snapshots_recorded_idx on public.backend_authority_snapshots(recorded_at desc, gate_status, production_blockers);
create index if not exists backend_authority_events_snapshot_idx on public.backend_authority_events(snapshot_id, event_type, created_at desc);
create index if not exists backend_authority_registry_module_idx on public.backend_authority_registry(module, risk, production_blocking);

alter table public.backend_authority_snapshots enable row level security;
alter table public.backend_authority_events enable row level security;
alter table public.backend_authority_registry enable row level security;

drop policy if exists backend_authority_snapshots_read_authenticated_v384 on public.backend_authority_snapshots;
create policy backend_authority_snapshots_read_authenticated_v384 on public.backend_authority_snapshots
  for select to authenticated using (true);

drop policy if exists backend_authority_events_read_authenticated_v384 on public.backend_authority_events;
create policy backend_authority_events_read_authenticated_v384 on public.backend_authority_events
  for select to authenticated using (true);

drop policy if exists backend_authority_registry_read_authenticated_v384 on public.backend_authority_registry;
create policy backend_authority_registry_read_authenticated_v384 on public.backend_authority_registry
  for select to authenticated using (true);

insert into public.backend_authority_registry(key, module, workflow, current_authority, target_authority, required_backend_object, required_gate, risk, production_blocking)
values
  ('setup.master-data', 'setup', 'Branches, stores, suppliers, items, categories, chart accounts', 'Local state with Supabase setup persistence foundation', 'Supabase tables with scoped writes and audit', 'branches, stores, suppliers, items, chart_accounts, setup_sync_batches', 'Explicit RLS + settings.manage/setup.manage permission', 'high', true),
  ('access.users-rbac', 'access', 'Users, roles, permissions, branch/store scope', 'Local user/access tables with RBAC evidence gate', 'Supabase Auth + app_roles/app_permissions/app_user_roles + scope assignments', 'app_permissions, app_roles, app_user_roles, branch_user_assignments, rbac_gate_snapshots', 'v383 RBAC production hardening + server-side role management RPC', 'critical', true),
  ('finance.posting', 'finance', 'Manual journals, invoices, payments, reversals, period locks', 'Posting contracts exist; production posting functions still need final authority proof', 'Database transaction RPCs with locks, immutable posted records, reversals only', 'posting_batches, posting_batch_lines, finance_journal_entries_backend, worker_finance_reconciliation_*', 'Balanced posting + immutable records + permission check + period lock check', 'critical', true),
  ('inventory.ledger', 'inventory', 'Stock movements, balances, counts, adjustments, valuation rebuild', 'Local movement model plus v376 rebuild worker evidence', 'Inventory movement ledger + costing snapshots + worker rebuild results', 'inventory_stock_movements, inventory_stock_balances, inventory_rebuild_runs, inventory_rebuild_balances', 'Movement ledger source exists and rebuild reconciles with GL', 'critical', true),
  ('pos.replay', 'sales', 'Foodics/POS import, replay, duplicate prevention, settlement handoff', 'v377 POS replay worker foundation, final posting not connected', 'POS staging -> replay -> settlement -> finance/inventory posting', 'pos_replay_runs, pos_replay_applied_rows, foodics_staging_rows, sales_pos_batches', 'Idempotent replay + payment/VAT/COGS posting authority', 'critical', true),
  ('imports.cutover', 'imports', 'CSV/Excel import staging, validation, approval, cutover, rollback evidence', 'v378 cutover worker evidence layer', 'Validated staging rows with approval and idempotent cutover to target tables', 'import_staging_rows, import_cutover_runs, import_cutover_applied_rows', 'Approved import only + row-level validation + duplicate hash + rollback package', 'high', true),
  ('reports.snapshots', 'reports', 'Dashboard KPIs, report packs, Smart Analysis, management reports', 'v379 report snapshot worker foundation', 'Report snapshots generated from posted/backend truth only', 'report_snapshot_runs, report_snapshot_sources, report_snapshot_artifacts', 'Truth score blocks reports when source data is incomplete/untrusted', 'high', true),
  ('backup.restore', 'administration', 'Backup ZIP, restore ZIP, archive evidence, restore proof', 'v381 local platform backup ZIP + backend evidence tables', 'Database/storage backup plan with restore drill proof', 'backup_archive_runs, backup_restore_runs, backup_archive_artifacts', 'Restore drill on staging before production cutover', 'high', true),
  ('backend.mode', 'administration', 'Local/staging/production gate, Supabase configuration, service-key exposure checks', 'v382 backend mode gate', 'Production cannot run without Supabase, auth, branch scope, and no demo data', 'productionConfig, providerSelector, backend_mode_gate_snapshots', 'VITE_RUNTIME_MODE=production hard blocks unsafe fallback', 'critical', true)
on conflict (key) do update set
  module = excluded.module,
  workflow = excluded.workflow,
  current_authority = excluded.current_authority,
  target_authority = excluded.target_authority,
  required_backend_object = excluded.required_backend_object,
  required_gate = excluded.required_gate,
  risk = excluded.risk,
  production_blocking = excluded.production_blocking,
  updated_at = now();

create or replace function public.backend_authority_record_snapshot(
  p_gate_status text,
  p_gate_score integer,
  p_production_blockers integer,
  p_workflow_counts jsonb default '{}'::jsonb,
  p_backend_objects jsonb default '[]'::jsonb,
  p_local_risks jsonb default '[]'::jsonb,
  p_evidence jsonb default '{}'::jsonb
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_snapshot_id uuid;
begin
  insert into public.backend_authority_snapshots(
    gate_status,
    gate_score,
    production_blockers,
    workflow_counts,
    backend_objects,
    local_risks,
    evidence,
    recorded_by
  ) values (
    coalesce(nullif(p_gate_status, ''), 'local-watch'),
    greatest(0, least(100, coalesce(p_gate_score, 0))),
    greatest(0, coalesce(p_production_blockers, 0)),
    coalesce(p_workflow_counts, '{}'::jsonb),
    coalesce(p_backend_objects, '[]'::jsonb),
    coalesce(p_local_risks, '[]'::jsonb),
    coalesce(p_evidence, '{}'::jsonb),
    auth.uid()
  ) returning id into v_snapshot_id;

  insert into public.backend_authority_events(snapshot_id, event_type, severity, message, details)
  values (
    v_snapshot_id,
    'backend_authority.snapshot_recorded',
    case when greatest(0, coalesce(p_production_blockers, 0)) > 0 then 'warning' else 'info' end,
    'Backend source-of-truth gate snapshot recorded.',
    jsonb_build_object('gateStatus', p_gate_status, 'gateScore', p_gate_score, 'productionBlockers', p_production_blockers)
  );

  return v_snapshot_id;
end;
$$;

revoke all on function public.backend_authority_record_snapshot(text, integer, integer, jsonb, jsonb, jsonb, jsonb) from public;
revoke all on function public.backend_authority_record_snapshot(text, integer, integer, jsonb, jsonb, jsonb, jsonb) from authenticated;
grant execute on function public.backend_authority_record_snapshot(text, integer, integer, jsonb, jsonb, jsonb, jsonb) to service_role;
