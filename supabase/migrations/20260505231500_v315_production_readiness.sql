-- v315 Production Readiness foundation

create extension if not exists pgcrypto;

create table if not exists public.production_readiness_checks (
  id uuid primary key default gen_random_uuid(),
  check_key text not null unique,
  area text not null,
  label text not null,
  required_for_go_live boolean not null default true,
  status text not null default 'not_checked',
  created_at timestamptz not null default now()
);

create table if not exists public.production_readiness_findings (
  id uuid primary key default gen_random_uuid(),
  area text not null,
  severity text not null check (severity in ('info', 'warning', 'critical')),
  message text not null,
  action text,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);

create table if not exists public.deployment_events (
  id uuid primary key default gen_random_uuid(),
  environment text not null,
  version text not null,
  status text not null,
  notes text,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);

create table if not exists public.app_error_logs (
  id uuid primary key default gen_random_uuid(),
  reference_id text not null unique default ('ERR-' || replace(gen_random_uuid()::text, '-', '')),
  severity text not null,
  module text,
  message text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);

create table if not exists public.backup_runs (
  id uuid primary key default gen_random_uuid(),
  environment text not null,
  backup_type text not null,
  status text not null,
  notes text,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);

create table if not exists public.restore_tests (
  id uuid primary key default gen_random_uuid(),
  environment text not null,
  status text not null,
  notes text,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);

create table if not exists public.release_checklist_runs (
  id uuid primary key default gen_random_uuid(),
  version text,
  status text not null default 'draft',
  score int not null default 0 check (score between 0 and 100),
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);

create table if not exists public.release_checklist_items (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null references public.release_checklist_runs(id) on delete cascade,
  item_key text not null,
  label text not null,
  required boolean not null default true,
  status text not null default 'not_checked',
  notes text,
  created_at timestamptz not null default now()
);

create index if not exists idx_production_readiness_findings_created on public.production_readiness_findings(severity, created_at desc);
create index if not exists idx_deployment_events_created on public.deployment_events(environment, created_at desc);
create index if not exists idx_app_error_logs_created on public.app_error_logs(severity, created_at desc);
create index if not exists idx_backup_runs_created on public.backup_runs(environment, created_at desc);
create index if not exists idx_restore_tests_created on public.restore_tests(environment, created_at desc);

create or replace function public.ops_log_app_error(
  severity text,
  module text,
  message text,
  metadata jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  insert into public.app_error_logs (severity, module, message, metadata, created_by)
  values (severity, module, message, metadata, auth.uid())
  returning id into v_id;

  return jsonb_build_object('ok', true, 'message', 'Error logged.', 'id', v_id);
end;
$$;

create or replace function public.ops_create_deployment_event(
  environment text,
  version text,
  status text,
  notes text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  insert into public.deployment_events (environment, version, status, notes, created_by)
  values (environment, version, status, notes, auth.uid())
  returning id into v_id;

  return jsonb_build_object('ok', true, 'message', 'Deployment event recorded.', 'id', v_id);
end;
$$;

create or replace function public.ops_get_production_readiness_summary()
returns jsonb
language sql
security definer
set search_path = public
as $$
  with counts as (
    select
      count(*) filter (where severity = 'critical') as critical_count,
      count(*) filter (where severity = 'warning') as warning_count
    from public.production_readiness_findings
  )
  select jsonb_build_object(
    'ok', true,
    'readiness_score', greatest(0, least(100, 100 - critical_count * 25 - warning_count * 8)),
    'critical_count', critical_count,
    'warning_count', warning_count,
    'status', case when critical_count > 0 then 'blocked' when warning_count > 0 then 'warning' else 'ready' end,
    'findings', '[]'::jsonb
  )
  from counts;
$$;

create or replace function public.ops_record_backup_run(
  environment text,
  backup_type text,
  status text,
  notes text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  insert into public.backup_runs (environment, backup_type, status, notes, created_by)
  values (environment, backup_type, status, notes, auth.uid())
  returning id into v_id;

  return jsonb_build_object('ok', true, 'message', 'Backup run recorded.', 'id', v_id);
end;
$$;

create or replace function public.ops_record_restore_test(
  environment text,
  status text,
  notes text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  insert into public.restore_tests (environment, status, notes, created_by)
  values (environment, status, notes, auth.uid())
  returning id into v_id;

  return jsonb_build_object('ok', true, 'message', 'Restore test recorded.', 'id', v_id);
end;
$$;

alter table public.production_readiness_checks enable row level security;
alter table public.production_readiness_findings enable row level security;
alter table public.deployment_events enable row level security;
alter table public.app_error_logs enable row level security;
alter table public.backup_runs enable row level security;
alter table public.restore_tests enable row level security;
alter table public.release_checklist_runs enable row level security;
alter table public.release_checklist_items enable row level security;
