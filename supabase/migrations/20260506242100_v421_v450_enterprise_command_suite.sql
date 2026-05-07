-- v421-v450 Enterprise Command Suite
-- Adds pilot governance, SOP, training, support, data-quality, and launch evidence tables.
-- This migration is evidence-only. It does not mutate finance, inventory, sales, production, or payroll records.

create extension if not exists pgcrypto;

create table if not exists public.enterprise_command_snapshots (
  id uuid primary key default gen_random_uuid(),
  snapshot_scope text not null default 'pilot-governance',
  readiness_score numeric not null default 0,
  readiness_status text not null default 'watch' check (readiness_status in ('ready','watch','blocked')),
  payload jsonb not null default '{}'::jsonb,
  created_by uuid,
  created_at timestamptz not null default now()
);

create table if not exists public.enterprise_operator_sops (
  id uuid primary key default gen_random_uuid(),
  area text not null,
  sop_code text not null,
  title text not null,
  purpose text,
  owner_role text,
  status text not null default 'draft' check (status in ('draft','approved','retired')),
  content jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(area, sop_code)
);

create table if not exists public.enterprise_training_sessions (
  id uuid primary key default gen_random_uuid(),
  role_key text not null,
  session_title text not null,
  status text not null default 'planned' check (status in ('planned','completed','cancelled')),
  attendees jsonb not null default '[]'::jsonb,
  evidence jsonb not null default '{}'::jsonb,
  completed_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.enterprise_support_cases (
  id uuid primary key default gen_random_uuid(),
  case_no text not null unique,
  tier text not null default 'T1',
  status text not null default 'open' check (status in ('open','in_progress','resolved','closed')),
  severity text not null default 'medium' check (severity in ('low','medium','high','critical')),
  area text,
  title text not null,
  details jsonb not null default '{}'::jsonb,
  opened_by uuid,
  resolved_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.enterprise_data_quality_checks (
  id uuid primary key default gen_random_uuid(),
  check_key text not null,
  area text not null,
  status text not null default 'watch' check (status in ('ready','watch','blocked')),
  target_value text,
  current_value text,
  evidence jsonb not null default '{}'::jsonb,
  checked_at timestamptz not null default now(),
  unique(check_key, checked_at)
);

create table if not exists public.enterprise_governance_events (
  id uuid primary key default gen_random_uuid(),
  event_type text not null,
  severity text not null default 'info' check (severity in ('info','warning','critical')),
  actor text not null default 'enterprise-command-suite',
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists enterprise_command_snapshots_created_idx on public.enterprise_command_snapshots(snapshot_scope, created_at desc);
create index if not exists enterprise_operator_sops_area_idx on public.enterprise_operator_sops(area, status);
create index if not exists enterprise_training_sessions_role_idx on public.enterprise_training_sessions(role_key, status, created_at desc);
create index if not exists enterprise_support_cases_status_idx on public.enterprise_support_cases(status, severity, created_at desc);
create index if not exists enterprise_data_quality_checks_area_idx on public.enterprise_data_quality_checks(area, status, checked_at desc);
create index if not exists enterprise_governance_events_created_idx on public.enterprise_governance_events(event_type, created_at desc);

alter table public.enterprise_command_snapshots enable row level security;
alter table public.enterprise_operator_sops enable row level security;
alter table public.enterprise_training_sessions enable row level security;
alter table public.enterprise_support_cases enable row level security;
alter table public.enterprise_data_quality_checks enable row level security;
alter table public.enterprise_governance_events enable row level security;

drop policy if exists enterprise_command_snapshots_read_authenticated_v421 on public.enterprise_command_snapshots;
create policy enterprise_command_snapshots_read_authenticated_v421 on public.enterprise_command_snapshots for select to authenticated using (true);

drop policy if exists enterprise_operator_sops_read_authenticated_v421 on public.enterprise_operator_sops;
create policy enterprise_operator_sops_read_authenticated_v421 on public.enterprise_operator_sops for select to authenticated using (true);

drop policy if exists enterprise_training_sessions_read_authenticated_v421 on public.enterprise_training_sessions;
create policy enterprise_training_sessions_read_authenticated_v421 on public.enterprise_training_sessions for select to authenticated using (true);

drop policy if exists enterprise_support_cases_read_authenticated_v421 on public.enterprise_support_cases;
create policy enterprise_support_cases_read_authenticated_v421 on public.enterprise_support_cases for select to authenticated using (true);

drop policy if exists enterprise_data_quality_checks_read_authenticated_v421 on public.enterprise_data_quality_checks;
create policy enterprise_data_quality_checks_read_authenticated_v421 on public.enterprise_data_quality_checks for select to authenticated using (true);

drop policy if exists enterprise_governance_events_read_authenticated_v421 on public.enterprise_governance_events;
create policy enterprise_governance_events_read_authenticated_v421 on public.enterprise_governance_events for select to authenticated using (true);

create or replace function public.enterprise_command_record_snapshot(
  p_scope text default 'pilot-governance',
  p_score numeric default 0,
  p_status text default 'watch',
  p_payload jsonb default '{}'::jsonb
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  insert into public.enterprise_command_snapshots(snapshot_scope, readiness_score, readiness_status, payload, created_by)
  values (
    coalesce(nullif(p_scope, ''), 'pilot-governance'),
    greatest(0, least(100, coalesce(p_score, 0))),
    case when p_status in ('ready','watch','blocked') then p_status else 'watch' end,
    coalesce(p_payload, '{}'::jsonb),
    auth.uid()
  ) returning id into v_id;

  insert into public.enterprise_governance_events(event_type, severity, actor, details)
  values ('enterprise_command.snapshot_recorded', 'info', 'enterprise-command-suite', jsonb_build_object('snapshotId', v_id, 'scope', p_scope, 'score', p_score, 'status', p_status));

  return v_id;
end;
$$;

revoke all on function public.enterprise_command_record_snapshot(text, numeric, text, jsonb) from public;
revoke all on function public.enterprise_command_record_snapshot(text, numeric, text, jsonb) from authenticated;
grant execute on function public.enterprise_command_record_snapshot(text, numeric, text, jsonb) to service_role;

insert into public.enterprise_operator_sops(area, sop_code, title, purpose, owner_role, status, content)
values
  ('Purchasing', 'PUR-POST-001', 'Supplier invoice posting SOP', 'Approve, post, and verify AP/VAT/inventory/GL evidence.', 'finance_manager', 'draft', jsonb_build_object('version', 'v421', 'evidence', 'Pilot Center')),
  ('Inventory', 'INV-COUNT-001', 'Stock count and adjustment SOP', 'Count, approve variance, post adjustment, and review balances.', 'inventory_manager', 'draft', jsonb_build_object('version', 'v421', 'evidence', 'Stock adjustment posting')),
  ('Sales', 'POS-SETTLE-001', 'POS day settlement SOP', 'Import/replay day sales, reconcile payments, and post settlement.', 'branch_manager', 'draft', jsonb_build_object('version', 'v421', 'evidence', 'POS settlement posting')),
  ('Finance', 'FIN-CLOSE-001', 'VAT settlement and period close SOP', 'Review blockers, settle VAT, run reconciliation, and close period.', 'finance_manager', 'draft', jsonb_build_object('version', 'v421', 'evidence', 'Finance close'))
on conflict (area, sop_code) do update set
  title = excluded.title,
  purpose = excluded.purpose,
  owner_role = excluded.owner_role,
  content = excluded.content,
  updated_at = now();
