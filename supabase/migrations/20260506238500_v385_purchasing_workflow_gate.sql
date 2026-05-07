-- v385 Purchasing Workflow Gate
-- Evidence layer for request -> PO -> GRN -> invoice -> payment readiness.
-- This migration does not post accounting entries or mutate purchasing documents.

create extension if not exists pgcrypto;

create table if not exists public.purchasing_workflow_gate_snapshots (
  id uuid primary key default gen_random_uuid(),
  generated_at timestamptz not null default now(),
  workflow_score integer not null default 0,
  production_gate text not null default 'watch',
  scope jsonb not null default '{}'::jsonb,
  counts jsonb not null default '{}'::jsonb,
  stage_rows jsonb not null default '[]'::jsonb,
  document_links jsonb not null default '[]'::jsonb,
  findings jsonb not null default '[]'::jsonb,
  next_action text,
  created_by uuid
);

create table if not exists public.purchasing_workflow_gate_findings (
  id uuid primary key default gen_random_uuid(),
  snapshot_id uuid references public.purchasing_workflow_gate_snapshots(id) on delete cascade,
  severity text not null default 'warning',
  area text not null,
  finding text not null,
  required_action text not null,
  resolved_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.purchasing_workflow_gate_events (
  id uuid primary key default gen_random_uuid(),
  snapshot_id uuid references public.purchasing_workflow_gate_snapshots(id) on delete set null,
  event_type text not null,
  severity text not null default 'info',
  message text,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists purchasing_workflow_gate_snapshots_generated_idx on public.purchasing_workflow_gate_snapshots(generated_at desc, production_gate);
create index if not exists purchasing_workflow_gate_findings_snapshot_idx on public.purchasing_workflow_gate_findings(snapshot_id, severity, resolved_at, created_at desc);
create index if not exists purchasing_workflow_gate_events_snapshot_idx on public.purchasing_workflow_gate_events(snapshot_id, event_type, created_at desc);

alter table public.purchasing_workflow_gate_snapshots enable row level security;
alter table public.purchasing_workflow_gate_findings enable row level security;
alter table public.purchasing_workflow_gate_events enable row level security;

drop policy if exists purchasing_workflow_gate_snapshots_read_authenticated_v385 on public.purchasing_workflow_gate_snapshots;
create policy purchasing_workflow_gate_snapshots_read_authenticated_v385 on public.purchasing_workflow_gate_snapshots
  for select to authenticated using (true);

drop policy if exists purchasing_workflow_gate_findings_read_authenticated_v385 on public.purchasing_workflow_gate_findings;
create policy purchasing_workflow_gate_findings_read_authenticated_v385 on public.purchasing_workflow_gate_findings
  for select to authenticated using (true);

drop policy if exists purchasing_workflow_gate_events_read_authenticated_v385 on public.purchasing_workflow_gate_events;
create policy purchasing_workflow_gate_events_read_authenticated_v385 on public.purchasing_workflow_gate_events
  for select to authenticated using (true);

create or replace function public.worker_record_purchasing_workflow_gate_snapshot(
  p_workflow_score integer,
  p_production_gate text,
  p_scope jsonb default '{}'::jsonb,
  p_counts jsonb default '{}'::jsonb,
  p_stage_rows jsonb default '[]'::jsonb,
  p_document_links jsonb default '[]'::jsonb,
  p_findings jsonb default '[]'::jsonb,
  p_next_action text default null
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_snapshot_id uuid;
  v_finding jsonb;
begin
  insert into public.purchasing_workflow_gate_snapshots(
    workflow_score,
    production_gate,
    scope,
    counts,
    stage_rows,
    document_links,
    findings,
    next_action,
    created_by
  ) values (
    greatest(0, least(100, coalesce(p_workflow_score, 0))),
    coalesce(nullif(p_production_gate, ''), 'watch'),
    coalesce(p_scope, '{}'::jsonb),
    coalesce(p_counts, '{}'::jsonb),
    coalesce(p_stage_rows, '[]'::jsonb),
    coalesce(p_document_links, '[]'::jsonb),
    coalesce(p_findings, '[]'::jsonb),
    p_next_action,
    auth.uid()
  ) returning id into v_snapshot_id;

  for v_finding in select * from jsonb_array_elements(coalesce(p_findings, '[]'::jsonb)) loop
    insert into public.purchasing_workflow_gate_findings(snapshot_id, severity, area, finding, required_action)
    values (
      v_snapshot_id,
      coalesce(nullif(v_finding->>'severity', ''), 'warning'),
      coalesce(nullif(v_finding->>'area', ''), 'Purchasing'),
      coalesce(nullif(v_finding->>'finding', ''), 'Purchasing workflow finding'),
      coalesce(nullif(v_finding->>'action', ''), 'Review purchasing workflow evidence')
    );
  end loop;

  insert into public.purchasing_workflow_gate_events(snapshot_id, event_type, severity, message, details)
  values (
    v_snapshot_id,
    'purchasing_workflow.snapshot_recorded',
    case when coalesce(p_production_gate, 'watch') = 'blocked' then 'critical' when coalesce(p_production_gate, 'watch') = 'watch' then 'warning' else 'info' end,
    'Purchasing workflow gate snapshot recorded.',
    jsonb_build_object('workflowScore', p_workflow_score, 'productionGate', p_production_gate)
  );

  return v_snapshot_id;
end;
$$;

revoke all on function public.worker_record_purchasing_workflow_gate_snapshot(integer, text, jsonb, jsonb, jsonb, jsonb, jsonb, text) from public;
revoke all on function public.worker_record_purchasing_workflow_gate_snapshot(integer, text, jsonb, jsonb, jsonb, jsonb, jsonb, text) from authenticated;
grant execute on function public.worker_record_purchasing_workflow_gate_snapshot(integer, text, jsonb, jsonb, jsonb, jsonb, jsonb, text) to service_role;
