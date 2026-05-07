-- v361-v365 Staging, RLS, UAT Seed, Cutover Rehearsal, Final Readiness
-- Additive only. Does not rewrite AppShell or apply migrations automatically.

create extension if not exists pgcrypto;

create table if not exists public.staging_migration_verification_runs (
  id uuid primary key default gen_random_uuid(),
  run_key text not null unique,
  status text not null default 'draft' check (status in ('draft','passed','warning','blocked','cancelled')),
  expected_count int not null default 0,
  ready_count int not null default 0,
  blocked_count int not null default 0,
  not_checked_count int not null default 0,
  metadata jsonb not null default '{}'::jsonb,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);

create table if not exists public.staging_migration_verification_items (
  id uuid primary key default gen_random_uuid(),
  run_id uuid references public.staging_migration_verification_runs(id) on delete cascade,
  check_key text not null,
  label text not null,
  expected_object text not null,
  object_type text not null,
  required boolean not null default true,
  status text not null default 'not_checked',
  message text,
  created_at timestamptz not null default now()
);

create table if not exists public.rls_dry_run_runs (
  id uuid primary key default gen_random_uuid(),
  run_key text not null unique,
  status text not null default 'draft' check (status in ('draft','passed','warning','blocked','cancelled')),
  passed_count int not null default 0,
  failed_count int not null default 0,
  blocked_count int not null default 0,
  not_run_count int not null default 0,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);

create table if not exists public.rls_dry_run_cases (
  id uuid primary key default gen_random_uuid(),
  run_id uuid references public.rls_dry_run_runs(id) on delete cascade,
  case_key text not null,
  module text not null,
  actor_role text not null,
  action text not null,
  resource text not null,
  expected text not null check (expected in ('allow','deny')),
  status text not null default 'not_run',
  critical boolean not null default true,
  message text,
  created_at timestamptz not null default now()
);

create table if not exists public.uat_seed_data_packs (
  id uuid primary key default gen_random_uuid(),
  pack_key text not null unique,
  title text not null,
  area text not null,
  required boolean not null default true,
  record_count int not null default 0,
  status text not null default 'planned',
  created_at timestamptz not null default now()
);

create table if not exists public.cutover_rehearsal_runs (
  id uuid primary key default gen_random_uuid(),
  run_key text not null unique,
  status text not null default 'planned' check (status in ('planned','running','passed','failed','blocked','cancelled')),
  expected_minutes int not null default 0,
  actual_minutes int,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

create table if not exists public.cutover_rehearsal_steps (
  id uuid primary key default gen_random_uuid(),
  run_id uuid references public.cutover_rehearsal_runs(id) on delete cascade,
  step_key text not null,
  title text not null,
  module text not null,
  expected_minutes int not null default 0,
  status text not null default 'planned',
  required boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.final_enterprise_readiness_snapshots (
  id uuid primary key default gen_random_uuid(),
  score numeric not null default 0,
  status text not null default 'blocked' check (status in ('ready','warning','blocked')),
  failed_checks jsonb not null default '[]'::jsonb,
  checks jsonb not null default '[]'::jsonb,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);

create index if not exists idx_staging_migration_verification_runs_status on public.staging_migration_verification_runs(status, created_at desc);
create index if not exists idx_rls_dry_run_runs_status on public.rls_dry_run_runs(status, created_at desc);
create index if not exists idx_uat_seed_data_packs_status on public.uat_seed_data_packs(status, required);
create index if not exists idx_cutover_rehearsal_runs_status on public.cutover_rehearsal_runs(status, created_at desc);
create index if not exists idx_final_enterprise_readiness_snapshots_status on public.final_enterprise_readiness_snapshots(status, created_at desc);

alter table public.staging_migration_verification_runs enable row level security;
alter table public.staging_migration_verification_items enable row level security;
alter table public.rls_dry_run_runs enable row level security;
alter table public.rls_dry_run_cases enable row level security;
alter table public.uat_seed_data_packs enable row level security;
alter table public.cutover_rehearsal_runs enable row level security;
alter table public.cutover_rehearsal_steps enable row level security;
alter table public.final_enterprise_readiness_snapshots enable row level security;

create or replace function public.staging_verify_enterprise_backend(expected_checks jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_run_id uuid;
  v_count int := 0;
begin
  v_count := jsonb_array_length(coalesce(expected_checks, '[]'::jsonb));

  insert into public.staging_migration_verification_runs (
    run_key,
    status,
    expected_count,
    not_checked_count,
    metadata,
    created_by
  )
  values (
    'STAGE-' || to_char(now(), 'YYYYMMDDHH24MISS'),
    'warning',
    v_count,
    v_count,
    jsonb_build_object('note', 'Foundation verification run registered. Execute detailed SQL checks in staging.'),
    auth.uid()
  )
  returning id into v_run_id;

  insert into public.staging_migration_verification_items (
    run_id,
    check_key,
    label,
    expected_object,
    object_type,
    required,
    status,
    message
  )
  select
    v_run_id,
    item->>'key',
    item->>'label',
    item->>'expectedObject',
    item->>'objectType',
    coalesce((item->>'required')::boolean, true),
    'not_checked',
    'Registered for staging verification.'
  from jsonb_array_elements(coalesce(expected_checks, '[]'::jsonb)) as item;

  return jsonb_build_object('ok', true, 'message', 'Staging verification run registered.', 'id', v_run_id, 'expected_count', v_count);
end;
$$;

create or replace function public.rls_register_dry_run_plan(run_key text, cases_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_run_id uuid;
  v_count int := 0;
begin
  v_count := jsonb_array_length(coalesce(cases_payload, '[]'::jsonb));

  insert into public.rls_dry_run_runs (
    run_key,
    status,
    not_run_count,
    created_by
  )
  values (
    run_key,
    'draft',
    v_count,
    auth.uid()
  )
  returning id into v_run_id;

  insert into public.rls_dry_run_cases (
    run_id,
    case_key,
    module,
    actor_role,
    action,
    resource,
    expected,
    status,
    critical,
    message
  )
  select
    v_run_id,
    item->>'key',
    item->>'module',
    item->>'actorRole',
    item->>'action',
    item->>'resource',
    item->>'expected',
    'not_run',
    coalesce((item->>'critical')::boolean, true),
    'Registered for manual/automated RLS dry-run.'
  from jsonb_array_elements(coalesce(cases_payload, '[]'::jsonb)) as item;

  return jsonb_build_object('ok', true, 'message', 'RLS dry-run plan registered.', 'id', v_run_id, 'case_count', v_count);
end;
$$;

create or replace function public.final_enterprise_readiness_snapshot(readiness_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  insert into public.final_enterprise_readiness_snapshots (
    score,
    status,
    failed_checks,
    checks,
    created_by
  )
  values (
    coalesce((readiness_payload->>'score')::numeric, 0),
    coalesce(readiness_payload->>'status', 'blocked'),
    coalesce(readiness_payload->'failed', '[]'::jsonb),
    coalesce(readiness_payload->'checks', '[]'::jsonb),
    auth.uid()
  )
  returning id into v_id;

  return jsonb_build_object('ok', true, 'message', 'Final enterprise readiness snapshot recorded.', 'id', v_id);
end;
$$;
do $$
begin
  if to_regprocedure('public.staging_verify_enterprise_backend(jsonb)') is not null then
    execute 'grant execute on function public.staging_verify_enterprise_backend(jsonb) to authenticated';
  end if;
end;
$$;
do $$
begin
  if to_regprocedure('public.rls_register_dry_run_plan(text, jsonb)') is not null then
    execute 'grant execute on function public.rls_register_dry_run_plan(text, jsonb) to authenticated';
  end if;
end;
$$;
do $$
begin
  if to_regprocedure('public.final_enterprise_readiness_snapshot(jsonb)') is not null then
    execute 'grant execute on function public.final_enterprise_readiness_snapshot(jsonb) to authenticated';
  end if;
end;
$$;
