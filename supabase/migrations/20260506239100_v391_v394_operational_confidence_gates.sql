-- v391-v394 Operational Confidence Gates
-- Adds evidence tables for report packs, alerts/exceptions, support diagnostics, and performance budget gates.

create extension if not exists pgcrypto;

create table if not exists public.operational_confidence_snapshots (
  id uuid primary key default gen_random_uuid(),
  gate_key text not null,
  status text not null default 'watch',
  score numeric not null default 0,
  snapshot jsonb not null default '{}'::jsonb,
  generated_by uuid,
  generated_at timestamptz not null default now()
);

create table if not exists public.operational_alert_rules (
  id uuid primary key default gen_random_uuid(),
  rule_key text not null unique,
  module text not null,
  severity text not null default 'warning',
  enabled boolean not null default true,
  owner_role text,
  sla_minutes integer,
  condition_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.operational_alert_events (
  id uuid primary key default gen_random_uuid(),
  rule_key text,
  module text not null,
  severity text not null default 'warning',
  source_table text,
  source_id text,
  branch_id text,
  status text not null default 'open',
  message text not null,
  details jsonb not null default '{}'::jsonb,
  opened_at timestamptz not null default now(),
  acknowledged_at timestamptz,
  resolved_at timestamptz
);

create table if not exists public.support_diagnostics_runs (
  id uuid primary key default gen_random_uuid(),
  run_key text not null unique,
  status text not null default 'generated',
  requested_by uuid,
  active_route text,
  active_user_id text,
  app_version text,
  diagnostics jsonb not null default '{}'::jsonb,
  generated_at timestamptz not null default now()
);

create table if not exists public.performance_budget_snapshots (
  id uuid primary key default gen_random_uuid(),
  budget_key text not null,
  route_key text,
  module text,
  status text not null default 'watch',
  measured_ms integer,
  max_budget_ms integer,
  row_count integer,
  details jsonb not null default '{}'::jsonb,
  measured_at timestamptz not null default now()
);

create index if not exists operational_confidence_snapshots_gate_idx on public.operational_confidence_snapshots(gate_key, generated_at desc);
create index if not exists operational_alert_events_status_idx on public.operational_alert_events(status, severity, opened_at desc);
create index if not exists support_diagnostics_runs_generated_idx on public.support_diagnostics_runs(generated_at desc);
create index if not exists performance_budget_snapshots_key_idx on public.performance_budget_snapshots(budget_key, status, measured_at desc);

alter table public.operational_confidence_snapshots enable row level security;
alter table public.operational_alert_rules enable row level security;
alter table public.operational_alert_events enable row level security;
alter table public.support_diagnostics_runs enable row level security;
alter table public.performance_budget_snapshots enable row level security;

drop policy if exists operational_confidence_snapshots_read_authenticated_v391 on public.operational_confidence_snapshots;
create policy operational_confidence_snapshots_read_authenticated_v391 on public.operational_confidence_snapshots for select to authenticated using (true);

drop policy if exists operational_alert_rules_read_authenticated_v392 on public.operational_alert_rules;
create policy operational_alert_rules_read_authenticated_v392 on public.operational_alert_rules for select to authenticated using (true);

drop policy if exists operational_alert_events_read_authenticated_v392 on public.operational_alert_events;
create policy operational_alert_events_read_authenticated_v392 on public.operational_alert_events for select to authenticated using (true);

drop policy if exists support_diagnostics_runs_read_authenticated_v393 on public.support_diagnostics_runs;
create policy support_diagnostics_runs_read_authenticated_v393 on public.support_diagnostics_runs for select to authenticated using (true);

drop policy if exists performance_budget_snapshots_read_authenticated_v394 on public.performance_budget_snapshots;
create policy performance_budget_snapshots_read_authenticated_v394 on public.performance_budget_snapshots for select to authenticated using (true);

create or replace function public.record_operational_confidence_snapshot(
  p_gate_key text,
  p_status text,
  p_score numeric,
  p_snapshot jsonb default '{}'::jsonb
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  if p_gate_key is null or btrim(p_gate_key) = '' then
    raise exception 'gate_key is required';
  end if;

  insert into public.operational_confidence_snapshots(gate_key, status, score, snapshot, generated_by)
  values (p_gate_key, coalesce(nullif(p_status, ''), 'watch'), coalesce(p_score, 0), coalesce(p_snapshot, '{}'::jsonb), auth.uid())
  returning id into v_id;

  return v_id;
end;
$$;

revoke all on function public.record_operational_confidence_snapshot(text, text, numeric, jsonb) from public;
grant execute on function public.record_operational_confidence_snapshot(text, text, numeric, jsonb) to authenticated;
