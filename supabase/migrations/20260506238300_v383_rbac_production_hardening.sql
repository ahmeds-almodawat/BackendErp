-- v383 RBAC Production Hardening
-- Evidence registry for route permissions, RPC permissions, dangerous actions, and RBAC gate snapshots.
-- This migration is intentionally evidence-focused. Enforcement remains in RLS and permission-checked backend RPCs.

create extension if not exists pgcrypto;

create table if not exists public.rbac_gate_snapshots (
  id uuid primary key default gen_random_uuid(),
  gate_status text not null default 'local-watch',
  gate_score integer not null default 0,
  permission_count integer not null default 0,
  role_count integer not null default 0,
  user_count integer not null default 0,
  active_user_count integer not null default 0,
  scoped_assignment_count integer not null default 0,
  critical_findings integer not null default 0,
  findings jsonb not null default '[]'::jsonb,
  evidence jsonb not null default '{}'::jsonb,
  created_by uuid,
  created_at timestamptz not null default now()
);

create table if not exists public.rbac_gate_events (
  id uuid primary key default gen_random_uuid(),
  snapshot_id uuid references public.rbac_gate_snapshots(id) on delete set null,
  event_type text not null,
  severity text not null default 'info',
  message text,
  details jsonb not null default '{}'::jsonb,
  created_by uuid,
  created_at timestamptz not null default now()
);

create table if not exists public.rbac_route_permission_registry (
  route_key text primary key,
  route_label text not null,
  required_permission text not null,
  scope_type text not null default 'company',
  risk_level text not null default 'medium',
  backend_required boolean not null default true,
  updated_at timestamptz not null default now()
);

create table if not exists public.rbac_rpc_permission_registry (
  rpc_name text primary key,
  module text not null,
  required_permission text not null,
  caller_type text not null default 'service-role-worker',
  service_role_only boolean not null default true,
  risk_level text not null default 'critical',
  updated_at timestamptz not null default now()
);

create table if not exists public.rbac_dangerous_action_registry (
  action_key text primary key,
  module text not null,
  label text not null,
  required_permission text not null,
  risk_level text not null default 'critical',
  server_authority_required boolean not null default true,
  updated_at timestamptz not null default now()
);

create index if not exists rbac_gate_snapshots_created_idx on public.rbac_gate_snapshots(created_at desc, gate_status);
create index if not exists rbac_gate_events_snapshot_idx on public.rbac_gate_events(snapshot_id, event_type, created_at desc);
create index if not exists rbac_route_permission_registry_permission_idx on public.rbac_route_permission_registry(required_permission, risk_level);
create index if not exists rbac_rpc_permission_registry_permission_idx on public.rbac_rpc_permission_registry(required_permission, risk_level);
create index if not exists rbac_dangerous_action_registry_permission_idx on public.rbac_dangerous_action_registry(required_permission, risk_level);

alter table public.rbac_gate_snapshots enable row level security;
alter table public.rbac_gate_events enable row level security;
alter table public.rbac_route_permission_registry enable row level security;
alter table public.rbac_rpc_permission_registry enable row level security;
alter table public.rbac_dangerous_action_registry enable row level security;

drop policy if exists rbac_gate_snapshots_read_authenticated_v383 on public.rbac_gate_snapshots;
create policy rbac_gate_snapshots_read_authenticated_v383 on public.rbac_gate_snapshots
  for select to authenticated using (true);

drop policy if exists rbac_gate_events_read_authenticated_v383 on public.rbac_gate_events;
create policy rbac_gate_events_read_authenticated_v383 on public.rbac_gate_events
  for select to authenticated using (true);

drop policy if exists rbac_route_permission_registry_read_authenticated_v383 on public.rbac_route_permission_registry;
create policy rbac_route_permission_registry_read_authenticated_v383 on public.rbac_route_permission_registry
  for select to authenticated using (true);

drop policy if exists rbac_rpc_permission_registry_read_authenticated_v383 on public.rbac_rpc_permission_registry;
create policy rbac_rpc_permission_registry_read_authenticated_v383 on public.rbac_rpc_permission_registry
  for select to authenticated using (true);

drop policy if exists rbac_dangerous_action_registry_read_authenticated_v383 on public.rbac_dangerous_action_registry;
create policy rbac_dangerous_action_registry_read_authenticated_v383 on public.rbac_dangerous_action_registry
  for select to authenticated using (true);

insert into public.rbac_route_permission_registry(route_key, route_label, required_permission, scope_type, risk_level, backend_required)
values
  ('dashboard', 'Executive Dashboard', 'dashboard.view', 'company', 'medium', false),
  ('smartAnalysis', 'Smart Analysis', 'finance.statements.view', 'company', 'high', true),
  ('reports', 'Reports', 'finance.statements.view', 'company', 'high', true),
  ('workload', 'Workload Ops', 'access.manage', 'global', 'critical', true),
  ('controls', 'Control Center', 'access.manage', 'global', 'critical', true),
  ('sales', 'Sales / POS Trial', 'sales.post', 'branch', 'high', true),
  ('inventory', 'Inventory', 'inventory.view', 'store', 'high', true),
  ('purchasing', 'Purchasing', 'purchasing.invoice.create', 'branch', 'high', true),
  ('production', 'Production / Prep', 'production.batch.create', 'store', 'high', true),
  ('finance', 'Finance', 'finance.view', 'company', 'critical', true),
  ('setup', 'Setup', 'settings.master.manage', 'global', 'critical', true),
  ('users', 'Users & Employees', 'access.user.manage', 'global', 'critical', true),
  ('access', 'Access Control', 'access.manage', 'global', 'critical', true),
  ('hr', 'HR & Attendance', 'hr.employee.manage', 'branch', 'high', true),
  ('imports', 'Import / Export', 'imports.manage', 'company', 'critical', true),
  ('backup', 'Backup / Restore', 'access.manage', 'global', 'critical', true),
  ('backend', 'Backend Mode', 'access.manage', 'global', 'critical', true),
  ('rbac', 'RBAC Gate', 'access.manage', 'global', 'critical', true)
on conflict (route_key) do update set
  route_label = excluded.route_label,
  required_permission = excluded.required_permission,
  scope_type = excluded.scope_type,
  risk_level = excluded.risk_level,
  backend_required = excluded.backend_required,
  updated_at = now();

insert into public.rbac_rpc_permission_registry(rpc_name, module, required_permission, caller_type, service_role_only, risk_level)
values
  ('worker_enqueue_job', 'worker', 'access.manage', 'service-role-worker', true, 'critical'),
  ('worker_acquire_job', 'worker', 'access.manage', 'service-role-worker', true, 'critical'),
  ('worker_enqueue_inventory_rebuild', 'inventory', 'inventory.adjustment.approve', 'service-role-worker', true, 'critical'),
  ('worker_enqueue_pos_replay', 'sales', 'sales.post', 'service-role-worker', true, 'critical'),
  ('worker_enqueue_import_cutover', 'imports', 'imports.manage', 'service-role-worker', true, 'critical'),
  ('worker_enqueue_report_snapshot', 'reports', 'finance.statements.view', 'service-role-worker', true, 'high'),
  ('worker_enqueue_finance_reconciliation', 'finance', 'finance.bank.reconcile', 'service-role-worker', true, 'critical'),
  ('worker_enqueue_backup_archive', 'backup', 'access.manage', 'service-role-worker', true, 'critical'),
  ('app_current_user_has_permission', 'access', 'access.manage', 'authenticated-rpc', false, 'high')
on conflict (rpc_name) do update set
  module = excluded.module,
  required_permission = excluded.required_permission,
  caller_type = excluded.caller_type,
  service_role_only = excluded.service_role_only,
  risk_level = excluded.risk_level,
  updated_at = now();

insert into public.rbac_dangerous_action_registry(action_key, module, label, required_permission, risk_level, server_authority_required)
values
  ('finance.post_journal', 'Finance', 'Post journal / official accounting batch', 'finance.journal.post', 'critical', true),
  ('finance.lock_period', 'Finance', 'Lock or close fiscal period', 'finance.period.lock', 'critical', true),
  ('finance.bank_reconcile', 'Finance', 'Approve bank reconciliation', 'finance.bank.reconcile', 'critical', true),
  ('inventory.post_adjustment', 'Inventory', 'Approve stock count / adjustment', 'inventory.adjustment.approve', 'critical', true),
  ('inventory.post_transfer', 'Inventory', 'Post store transfer', 'inventory.transfer.post', 'high', true),
  ('purchasing.post_invoice', 'Purchasing', 'Post supplier invoice', 'purchasing.invoice.post', 'critical', true),
  ('purchasing.post_payment', 'Purchasing', 'Post supplier payment', 'purchasing.payment.post', 'critical', true),
  ('production.post_batch', 'Production', 'Post production batch and consumption', 'production.batch.post', 'critical', true),
  ('sales.post_pos', 'Sales', 'Post POS/day close and deductions', 'sales.post', 'critical', true),
  ('access.assign_role', 'Access', 'Assign role or change permissions', 'access.manage', 'critical', true),
  ('backup.restore_platform', 'Backup', 'Restore full platform backup', 'access.manage', 'critical', true)
on conflict (action_key) do update set
  module = excluded.module,
  label = excluded.label,
  required_permission = excluded.required_permission,
  risk_level = excluded.risk_level,
  server_authority_required = excluded.server_authority_required,
  updated_at = now();

create or replace function public.rbac_record_gate_snapshot(
  p_gate_status text,
  p_gate_score integer,
  p_permission_count integer default 0,
  p_role_count integer default 0,
  p_user_count integer default 0,
  p_active_user_count integer default 0,
  p_scoped_assignment_count integer default 0,
  p_critical_findings integer default 0,
  p_findings jsonb default '[]'::jsonb,
  p_evidence jsonb default '{}'::jsonb
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  insert into public.rbac_gate_snapshots(
    gate_status,
    gate_score,
    permission_count,
    role_count,
    user_count,
    active_user_count,
    scoped_assignment_count,
    critical_findings,
    findings,
    evidence,
    created_by
  ) values (
    coalesce(nullif(p_gate_status, ''), 'local-watch'),
    greatest(0, least(100, coalesce(p_gate_score, 0))),
    greatest(0, coalesce(p_permission_count, 0)),
    greatest(0, coalesce(p_role_count, 0)),
    greatest(0, coalesce(p_user_count, 0)),
    greatest(0, coalesce(p_active_user_count, 0)),
    greatest(0, coalesce(p_scoped_assignment_count, 0)),
    greatest(0, coalesce(p_critical_findings, 0)),
    coalesce(p_findings, '[]'::jsonb),
    coalesce(p_evidence, '{}'::jsonb),
    auth.uid()
  ) returning id into v_id;

  insert into public.rbac_gate_events(snapshot_id, event_type, severity, message, details, created_by)
  values (v_id, 'rbac.snapshot.recorded', 'info', 'RBAC gate snapshot recorded.', coalesce(p_evidence, '{}'::jsonb), auth.uid());

  return v_id;
end;
$$;

revoke all on function public.rbac_record_gate_snapshot(text, integer, integer, integer, integer, integer, integer, integer, jsonb, jsonb) from public;
revoke all on function public.rbac_record_gate_snapshot(text, integer, integer, integer, integer, integer, integer, integer, jsonb, jsonb) from authenticated;
grant execute on function public.rbac_record_gate_snapshot(text, integer, integer, integer, integer, integer, integer, integer, jsonb, jsonb) to service_role;
