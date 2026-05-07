-- v386-v390 Operational Workflow Gates Mega Patch
-- Evidence-only operational gates for inventory, sales/POS, production, finance close, and HR.
-- This migration does not post accounting, stock, POS, payroll, or purchasing documents.

create extension if not exists pgcrypto;

create table if not exists public.operational_workflow_gate_snapshots (
  id uuid primary key default gen_random_uuid(),
  gate_key text not null,
  version text not null,
  status text not null default 'watch',
  score integer not null default 0,
  counts jsonb not null default '{}'::jsonb,
  checks jsonb not null default '[]'::jsonb,
  findings jsonb not null default '[]'::jsonb,
  cutover_rule text,
  generated_by text not null default 'operational-gate-worker',
  generated_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create table if not exists public.operational_workflow_gate_events (
  id uuid primary key default gen_random_uuid(),
  snapshot_id uuid references public.operational_workflow_gate_snapshots(id) on delete set null,
  gate_key text,
  event_type text not null,
  severity text not null default 'info',
  message text,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists operational_workflow_gate_snapshots_gate_idx on public.operational_workflow_gate_snapshots(gate_key, status, generated_at desc);
create index if not exists operational_workflow_gate_events_gate_idx on public.operational_workflow_gate_events(gate_key, event_type, created_at desc);

alter table public.operational_workflow_gate_snapshots enable row level security;
alter table public.operational_workflow_gate_events enable row level security;

drop policy if exists operational_workflow_gate_snapshots_read_authenticated_v386_390 on public.operational_workflow_gate_snapshots;
create policy operational_workflow_gate_snapshots_read_authenticated_v386_390
on public.operational_workflow_gate_snapshots for select to authenticated using (true);

drop policy if exists operational_workflow_gate_events_read_authenticated_v386_390 on public.operational_workflow_gate_events;
create policy operational_workflow_gate_events_read_authenticated_v386_390
on public.operational_workflow_gate_events for select to authenticated using (true);

create or replace function public.worker_record_operational_workflow_gate_snapshot(
  p_gate_key text,
  p_version text,
  p_status text,
  p_score integer,
  p_counts jsonb default '{}'::jsonb,
  p_checks jsonb default '[]'::jsonb,
  p_findings jsonb default '[]'::jsonb,
  p_cutover_rule text default null,
  p_generated_by text default 'operational-gate-worker'
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_snapshot_id uuid;
begin
  if p_gate_key is null or btrim(p_gate_key) = '' then
    raise exception 'gate_key is required';
  end if;

  insert into public.operational_workflow_gate_snapshots(
    gate_key, version, status, score, counts, checks, findings, cutover_rule, generated_by
  ) values (
    p_gate_key,
    coalesce(nullif(p_version, ''), 'v386-v390'),
    coalesce(nullif(p_status, ''), 'watch'),
    greatest(0, least(100, coalesce(p_score, 0))),
    coalesce(p_counts, '{}'::jsonb),
    coalesce(p_checks, '[]'::jsonb),
    coalesce(p_findings, '[]'::jsonb),
    p_cutover_rule,
    coalesce(nullif(p_generated_by, ''), 'operational-gate-worker')
  ) returning id into v_snapshot_id;

  insert into public.operational_workflow_gate_events(snapshot_id, gate_key, event_type, severity, message, details)
  values (v_snapshot_id, p_gate_key, 'snapshot.recorded', 'info', 'Operational workflow gate snapshot recorded.', jsonb_build_object('version', p_version, 'score', p_score, 'status', p_status));

  return v_snapshot_id;
end;
$$;

create or replace function public.worker_record_operational_workflow_gate_event(
  p_snapshot_id uuid,
  p_gate_key text,
  p_event_type text,
  p_severity text default 'info',
  p_message text default null,
  p_details jsonb default '{}'::jsonb
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_event_id uuid;
begin
  insert into public.operational_workflow_gate_events(snapshot_id, gate_key, event_type, severity, message, details)
  values (
    p_snapshot_id,
    p_gate_key,
    coalesce(nullif(p_event_type, ''), 'operational_gate.event'),
    coalesce(nullif(p_severity, ''), 'info'),
    p_message,
    coalesce(p_details, '{}'::jsonb)
  ) returning id into v_event_id;
  return v_event_id;
end;
$$;

revoke all on function public.worker_record_operational_workflow_gate_snapshot(text, text, text, integer, jsonb, jsonb, jsonb, text, text) from public, authenticated;
grant execute on function public.worker_record_operational_workflow_gate_snapshot(text, text, text, integer, jsonb, jsonb, jsonb, text, text) to service_role;

revoke all on function public.worker_record_operational_workflow_gate_event(uuid, text, text, text, text, jsonb) from public, authenticated;
grant execute on function public.worker_record_operational_workflow_gate_event(uuid, text, text, text, text, jsonb) to service_role;
