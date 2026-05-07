-- v329-v334 Enterprise Real Backend Gate
-- QA lock, Supabase real client gate, migration verification, auth shell,
-- RBAC enforcement, and RLS test matrix foundations.

create extension if not exists pgcrypto;

create table if not exists public.backend_gate_checks (
  id uuid primary key default gen_random_uuid(),
  check_key text not null unique,
  module text not null,
  label text not null,
  severity text not null default 'warning' check (severity in ('info','warning','critical')),
  status text not null default 'not_checked' check (status in ('ready','warning','blocked','not_checked')),
  required_for_backend_cutover boolean not null default true,
  notes text,
  created_at timestamptz not null default now()
);

create table if not exists public.backend_gate_check_runs (
  id uuid primary key default gen_random_uuid(),
  run_key text not null unique,
  status text not null default 'draft' check (status in ('draft','passed','warning','blocked','cancelled')),
  critical_count int not null default 0,
  warning_count int not null default 0,
  metadata jsonb not null default '{}'::jsonb,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);

create table if not exists public.backend_gate_check_findings (
  id uuid primary key default gen_random_uuid(),
  run_id uuid references public.backend_gate_check_runs(id) on delete cascade,
  check_key text,
  severity text not null check (severity in ('info','warning','critical')),
  message text not null,
  action text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.auth_session_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  event_type text not null,
  status text not null default 'ok',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.permission_test_runs (
  id uuid primary key default gen_random_uuid(),
  run_key text not null unique,
  status text not null default 'draft' check (status in ('draft','passed','warning','blocked')),
  critical_count int not null default 0,
  warning_count int not null default 0,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);

create table if not exists public.rls_test_results (
  id uuid primary key default gen_random_uuid(),
  run_id uuid references public.permission_test_runs(id) on delete cascade,
  test_key text not null,
  module text not null,
  actor_role text not null,
  action text not null,
  resource text not null,
  expected text not null check (expected in ('allow','deny')),
  actual text check (actual in ('allow','deny','not_run')),
  passed boolean not null default false,
  reason text,
  created_at timestamptz not null default now()
);

create table if not exists public.migration_verification_runs (
  id uuid primary key default gen_random_uuid(),
  run_key text not null unique,
  expected_migration_count int not null default 0,
  missing_migration_count int not null default 0,
  expected_object_count int not null default 0,
  missing_object_count int not null default 0,
  status text not null default 'draft' check (status in ('draft','passed','warning','blocked')),
  metadata jsonb not null default '{}'::jsonb,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);

create index if not exists idx_backend_gate_check_findings_run on public.backend_gate_check_findings(run_id, severity);
create index if not exists idx_auth_session_events_user on public.auth_session_events(user_id, created_at desc);
create index if not exists idx_rls_test_results_run on public.rls_test_results(run_id, passed);
create index if not exists idx_migration_verification_runs_created on public.migration_verification_runs(created_at desc);

alter table public.backend_gate_checks enable row level security;
alter table public.backend_gate_check_runs enable row level security;
alter table public.backend_gate_check_findings enable row level security;
alter table public.auth_session_events enable row level security;
alter table public.permission_test_runs enable row level security;
alter table public.rls_test_results enable row level security;
alter table public.migration_verification_runs enable row level security;

insert into public.backend_gate_checks (check_key, module, label, severity, status, required_for_backend_cutover)
values
  ('qa_all_passes', 'qa', 'npm run qa:all passes', 'critical', 'not_checked', true),
  ('supabase_client_real', 'backend', 'Real Supabase client is configured', 'critical', 'not_checked', true),
  ('service_role_not_frontend', 'security', 'Service role key is not exposed in frontend', 'critical', 'not_checked', true),
  ('migrations_verified', 'database', 'All expected migrations verified on staging', 'critical', 'not_checked', true),
  ('auth_shell_ready', 'auth', 'Authentication shell is ready', 'critical', 'not_checked', true),
  ('rbac_rules_defined', 'access', 'RBAC route/action rules are defined', 'critical', 'not_checked', true),
  ('rls_matrix_defined', 'security', 'RLS test matrix is defined', 'critical', 'not_checked', true),
  ('backup_restore_done', 'ops', 'Backup and restore test completed', 'critical', 'not_checked', true)
on conflict (check_key) do update set
  module = excluded.module,
  label = excluded.label,
  severity = excluded.severity,
  required_for_backend_cutover = excluded.required_for_backend_cutover;

create or replace function public.backend_gate_summary()
returns jsonb
language sql
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'ok', count(*) filter (where severity = 'critical' and status not in ('ready')) = 0,
    'critical_count', count(*) filter (where severity = 'critical' and status not in ('ready')),
    'warning_count', count(*) filter (where severity = 'warning' and status not in ('ready')),
    'message', case
      when count(*) filter (where severity = 'critical' and status not in ('ready')) = 0
      then 'Backend gate critical checks are ready.'
      else 'Backend gate has blocking critical checks.'
    end,
    'checks', coalesce(jsonb_agg(row_to_json(backend_gate_checks)), '[]'::jsonb)
  )
  from public.backend_gate_checks
  where public.app_current_user_has_permission('settings.manage') or public.app_current_user_has_permission('reports.view');
$$;

create or replace function public.backend_gate_record_session_event(
  event_type text,
  status text default 'ok',
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
  if auth.uid() is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;

  insert into public.auth_session_events (user_id, event_type, status, metadata)
  values (auth.uid(), event_type, status, metadata)
  returning id into v_id;

  return jsonb_build_object('ok', true, 'message', 'Session event recorded.', 'id', v_id);
end;
$$;

create or replace function public.backend_gate_verify_expected_objects(expected_objects jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  if not coalesce(public.app_current_user_has_permission('settings.manage'), false) then
    raise exception 'permission denied: settings.manage' using errcode = '42501';
  end if;

  return jsonb_build_object(
    'ok', true,
    'message', 'Expected object verification stub created. Run detailed SQL checks in staging before production.',
    'expected_count', jsonb_array_length(coalesce(expected_objects, '[]'::jsonb)),
    'findings', '[]'::jsonb
  );
end;
$$;
do $$
begin
  if to_regprocedure('public.backend_gate_summary()') is not null then
    execute 'grant execute on function public.backend_gate_summary() to authenticated';
  end if;
end;
$$;
do $$
begin
  if to_regprocedure('public.backend_gate_record_session_event(text, text, jsonb)') is not null then
    execute 'grant execute on function public.backend_gate_record_session_event(text, text, jsonb) to authenticated';
  end if;
end;
$$;
do $$
begin
  if to_regprocedure('public.backend_gate_verify_expected_objects(jsonb)') is not null then
    execute 'grant execute on function public.backend_gate_verify_expected_objects(jsonb) to authenticated';
  end if;
end;
$$;
