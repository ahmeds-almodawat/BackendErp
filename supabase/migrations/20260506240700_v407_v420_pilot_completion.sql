-- v407-v420 Production Pilot Completion
-- Adds durable evidence tables and a backend RPC catalog for the final pilot-readiness pass.
-- This migration is additive and does not post accounting/inventory data by itself.

create extension if not exists pgcrypto;

create table if not exists public.pilot_completion_snapshots (
  id uuid primary key default gen_random_uuid(),
  version text not null default 'v407-v420',
  status text not null default 'draft',
  score numeric not null default 0,
  summary jsonb not null default '{}'::jsonb,
  evidence jsonb not null default '{}'::jsonb,
  created_by uuid,
  created_at timestamptz not null default now()
);

create table if not exists public.pilot_completion_events (
  id uuid primary key default gen_random_uuid(),
  snapshot_id uuid references public.pilot_completion_snapshots(id) on delete set null,
  event_type text not null,
  severity text not null default 'info',
  message text,
  details jsonb not null default '{}'::jsonb,
  created_by uuid,
  created_at timestamptz not null default now()
);

create table if not exists public.pilot_posting_rpc_catalog (
  key text primary key,
  module text not null,
  rpc_name text not null,
  required_permission text not null,
  required_status text not null,
  risk_level text not null default 'critical',
  proof_required text not null,
  is_required_for_pilot boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.pilot_release_checklist (
  key text primary key,
  title text not null,
  owner_role text not null,
  status text not null default 'pending',
  evidence text,
  exit_criteria text not null,
  sort_order integer not null default 100,
  updated_at timestamptz not null default now()
);

create index if not exists pilot_completion_snapshots_created_idx on public.pilot_completion_snapshots(created_at desc, status);
create index if not exists pilot_completion_events_snapshot_idx on public.pilot_completion_events(snapshot_id, event_type, created_at desc);
create index if not exists pilot_posting_rpc_catalog_required_idx on public.pilot_posting_rpc_catalog(is_required_for_pilot, risk_level, module);

alter table public.pilot_completion_snapshots enable row level security;
alter table public.pilot_completion_events enable row level security;
alter table public.pilot_posting_rpc_catalog enable row level security;
alter table public.pilot_release_checklist enable row level security;

drop policy if exists pilot_completion_snapshots_read_authenticated_v407 on public.pilot_completion_snapshots;
create policy pilot_completion_snapshots_read_authenticated_v407 on public.pilot_completion_snapshots for select to authenticated using (true);

drop policy if exists pilot_completion_events_read_authenticated_v407 on public.pilot_completion_events;
create policy pilot_completion_events_read_authenticated_v407 on public.pilot_completion_events for select to authenticated using (true);

drop policy if exists pilot_posting_rpc_catalog_read_authenticated_v407 on public.pilot_posting_rpc_catalog;
create policy pilot_posting_rpc_catalog_read_authenticated_v407 on public.pilot_posting_rpc_catalog for select to authenticated using (true);

drop policy if exists pilot_release_checklist_read_authenticated_v407 on public.pilot_release_checklist;
create policy pilot_release_checklist_read_authenticated_v407 on public.pilot_release_checklist for select to authenticated using (true);

insert into public.pilot_posting_rpc_catalog(key, module, rpc_name, required_permission, required_status, risk_level, proof_required, is_required_for_pilot)
values
  ('purchase-invoice', 'Purchasing / Inventory / Finance', 'purchasing_post_purchase_invoice', 'finance.post', 'approved / validated invoice', 'critical', 'One invoice posts to inventory, AP, VAT input, GL and audit evidence.', true),
  ('supplier-payment', 'Purchasing / Treasury / Finance', 'purchasing_post_supplier_payment', 'finance.post', 'approved payment', 'critical', 'One supplier payment settles AP and posts cash/bank GL evidence.', true),
  ('pos-day', 'Sales / POS / Finance', 'sales_post_pos_batch', 'sales.import or finance.post', 'approved / reconciled POS batch', 'critical', 'One POS day posts revenue, VAT output and settlement clearing lines.', true),
  ('production-batch', 'Production / Inventory / Finance', 'production_post_batch', 'production.post or inventory.adjust or finance.post', 'approved / completed production batch', 'critical', 'One production batch posts raw consumption, output and variance evidence.', true),
  ('stock-adjustment', 'Inventory / Finance', 'inventory_post_adjustment', 'inventory.adjust or finance.post', 'approved stock adjustment', 'critical', 'One adjustment posts stock movement, balance and GL variance.', true),
  ('stock-count', 'Inventory / Finance', 'inventory_post_stock_count', 'inventory.adjust or finance.post', 'approved stock count', 'critical', 'One count posts variance movements and GL equality.', true),
  ('vat-settlement', 'Finance / Tax', 'finance_post_vat_settlement', 'finance.post', 'open period after VAT evidence', 'critical', 'One period VAT settlement calculates payable/recoverable evidence.', true),
  ('period-close', 'Finance / Control', 'finance_close_period', 'finance.post', 'open period with blockers cleared', 'critical', 'One period close blocks unresolved risks or closes with explicit evidence.', true)
on conflict (key) do update set
  module = excluded.module,
  rpc_name = excluded.rpc_name,
  required_permission = excluded.required_permission,
  required_status = excluded.required_status,
  risk_level = excluded.risk_level,
  proof_required = excluded.proof_required,
  is_required_for_pilot = excluded.is_required_for_pilot,
  updated_at = now();

insert into public.pilot_release_checklist(key, title, owner_role, status, evidence, exit_criteria, sort_order)
values
  ('fresh-reset', 'Fresh Supabase reset', 'Technical admin', 'required', 'supabase db reset', 'No SQL migration errors on a clean local stack.', 10),
  ('qa-build', 'Full QA and production build', 'Technical admin', 'required', 'npm run qa:all && npm run build', 'No QA, TypeScript or build failures.', 20),
  ('posting-proof', 'Backend posting proof', 'Finance + operations', 'required', 'v401-v406 RPCs', 'Each critical posting RPC succeeds once in local Supabase with realistic data.', 30),
  ('report-truth', 'Report truth proof', 'Finance manager', 'required', 'Report snapshot and reconciliation evidence', 'Trial balance, VAT, AP and inventory reports reconcile to posted backend data.', 40),
  ('backup-drill', 'Backup and restore drill', 'System admin', 'required', 'v381 backup/restore and backend archive evidence', 'Backup can be restored to a clean environment and counts reconcile.', 50),
  ('uat-signoff', 'UAT sign-off', 'Business owners', 'required', 'Pilot scenario walkthrough', 'Purchasing, inventory, POS, production, finance close and HR scenarios signed off.', 60)
on conflict (key) do update set
  title = excluded.title,
  owner_role = excluded.owner_role,
  status = excluded.status,
  evidence = excluded.evidence,
  exit_criteria = excluded.exit_criteria,
  sort_order = excluded.sort_order,
  updated_at = now();

create or replace function public.pilot_completion_rpc_readiness()
returns table(
  key text,
  module text,
  rpc_name text,
  required_permission text,
  required_status text,
  risk_level text,
  proof_required text,
  function_exists boolean
)
language sql
stable
security definer
set search_path = public
as $$
  select
    c.key,
    c.module,
    c.rpc_name,
    c.required_permission,
    c.required_status,
    c.risk_level,
    c.proof_required,
    exists (
      select 1
      from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
      where n.nspname = 'public'
        and p.proname = c.rpc_name
    ) as function_exists
  from public.pilot_posting_rpc_catalog c
  order by c.module, c.key;
$$;

create or replace function public.pilot_record_completion_snapshot(
  p_status text default 'draft',
  p_score numeric default 0,
  p_summary jsonb default '{}'::jsonb,
  p_evidence jsonb default '{}'::jsonb
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  insert into public.pilot_completion_snapshots(status, score, summary, evidence, created_by)
  values (coalesce(nullif(p_status, ''), 'draft'), greatest(0, least(100, coalesce(p_score, 0))), coalesce(p_summary, '{}'::jsonb), coalesce(p_evidence, '{}'::jsonb), auth.uid())
  returning id into v_id;

  insert into public.pilot_completion_events(snapshot_id, event_type, severity, message, details, created_by)
  values (v_id, 'pilot.snapshot.created', 'info', 'Pilot completion snapshot recorded.', jsonb_build_object('score', p_score, 'status', p_status), auth.uid());

  return v_id;
end;
$$;

revoke execute on function public.pilot_completion_rpc_readiness() from public;
grant execute on function public.pilot_completion_rpc_readiness() to authenticated;

revoke execute on function public.pilot_record_completion_snapshot(text, numeric, jsonb, jsonb) from public;
grant execute on function public.pilot_record_completion_snapshot(text, numeric, jsonb, jsonb) to authenticated;
