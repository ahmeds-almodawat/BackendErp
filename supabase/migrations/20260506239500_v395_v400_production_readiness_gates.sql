-- v395-v400 Production Readiness Gates
-- Evidence-only production readiness layer for tablet, deployment, UAT, security,
-- rehearsal, and pilot release signoff. This migration does not mutate ERP transactions.

create extension if not exists pgcrypto;

create table if not exists public.production_readiness_snapshots (
  id uuid primary key default gen_random_uuid(),
  gate_key text not null,
  gate_version text not null,
  status text not null default 'watch',
  score numeric not null default 0,
  generated_by uuid,
  counts jsonb not null default '{}'::jsonb,
  findings jsonb not null default '[]'::jsonb,
  checks jsonb not null default '[]'::jsonb,
  release_rule text,
  evidence jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.production_uat_scenarios (
  id uuid primary key default gen_random_uuid(),
  scenario_key text not null,
  scenario_name text not null,
  module text not null,
  status text not null default 'planned',
  tester_name text,
  expected_result text,
  actual_result text,
  evidence_url text,
  signed_off_by uuid,
  signed_off_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.production_security_findings (
  id uuid primary key default gen_random_uuid(),
  finding_key text not null,
  area text not null,
  severity text not null default 'warning',
  status text not null default 'open',
  finding text not null,
  required_action text not null,
  owner text,
  resolved_by uuid,
  resolved_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.production_rehearsal_events (
  id uuid primary key default gen_random_uuid(),
  rehearsal_key text not null,
  event_type text not null,
  status text not null default 'info',
  message text,
  evidence jsonb not null default '{}'::jsonb,
  created_by uuid,
  created_at timestamptz not null default now()
);

create table if not exists public.production_release_signoffs (
  id uuid primary key default gen_random_uuid(),
  release_key text not null,
  gate_key text not null,
  status text not null default 'pending',
  signed_by uuid,
  signed_at timestamptz,
  note text,
  evidence jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique(release_key, gate_key)
);

create index if not exists production_readiness_snapshots_gate_idx on public.production_readiness_snapshots(gate_key, status, created_at desc);
create index if not exists production_uat_scenarios_module_idx on public.production_uat_scenarios(module, status, created_at desc);
create index if not exists production_security_findings_status_idx on public.production_security_findings(severity, status, created_at desc);
create index if not exists production_rehearsal_events_key_idx on public.production_rehearsal_events(rehearsal_key, event_type, created_at desc);
create index if not exists production_release_signoffs_release_idx on public.production_release_signoffs(release_key, status, created_at desc);

alter table public.production_readiness_snapshots enable row level security;
alter table public.production_uat_scenarios enable row level security;
alter table public.production_security_findings enable row level security;
alter table public.production_rehearsal_events enable row level security;
alter table public.production_release_signoffs enable row level security;

drop policy if exists production_readiness_snapshots_read_authenticated_v395400 on public.production_readiness_snapshots;
create policy production_readiness_snapshots_read_authenticated_v395400 on public.production_readiness_snapshots for select to authenticated using (true);

drop policy if exists production_uat_scenarios_read_authenticated_v395400 on public.production_uat_scenarios;
create policy production_uat_scenarios_read_authenticated_v395400 on public.production_uat_scenarios for select to authenticated using (true);

drop policy if exists production_security_findings_read_authenticated_v395400 on public.production_security_findings;
create policy production_security_findings_read_authenticated_v395400 on public.production_security_findings for select to authenticated using (true);

drop policy if exists production_rehearsal_events_read_authenticated_v395400 on public.production_rehearsal_events;
create policy production_rehearsal_events_read_authenticated_v395400 on public.production_rehearsal_events for select to authenticated using (true);

drop policy if exists production_release_signoffs_read_authenticated_v395400 on public.production_release_signoffs;
create policy production_release_signoffs_read_authenticated_v395400 on public.production_release_signoffs for select to authenticated using (true);

create or replace function public.production_readiness_event(
  p_gate_key text,
  p_gate_version text,
  p_status text default 'watch',
  p_score numeric default 0,
  p_counts jsonb default '{}'::jsonb,
  p_findings jsonb default '[]'::jsonb,
  p_checks jsonb default '[]'::jsonb,
  p_release_rule text default null,
  p_evidence jsonb default '{}'::jsonb
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  insert into public.production_readiness_snapshots(gate_key, gate_version, status, score, generated_by, counts, findings, checks, release_rule, evidence)
  values (
    coalesce(nullif(p_gate_key, ''), 'unknown'),
    coalesce(nullif(p_gate_version, ''), 'v395-v400'),
    coalesce(nullif(p_status, ''), 'watch'),
    coalesce(p_score, 0),
    auth.uid(),
    coalesce(p_counts, '{}'::jsonb),
    coalesce(p_findings, '[]'::jsonb),
    coalesce(p_checks, '[]'::jsonb),
    p_release_rule,
    coalesce(p_evidence, '{}'::jsonb)
  ) returning id into v_id;
  return v_id;
end;
$$;

revoke all on function public.production_readiness_event(text, text, text, numeric, jsonb, jsonb, jsonb, text, jsonb) from public;
grant execute on function public.production_readiness_event(text, text, text, numeric, jsonb, jsonb, jsonb, text, jsonb) to authenticated;
