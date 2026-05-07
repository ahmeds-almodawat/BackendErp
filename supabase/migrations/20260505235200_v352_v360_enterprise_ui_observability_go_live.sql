-- v352-v360 Enterprise UI, Observability, Staging, UAT, and Go-Live
-- Additive only. Does not rewrite AppShell or apply migrations automatically.

create extension if not exists pgcrypto;

create table if not exists public.appshell_refactor_tasks (
  id uuid primary key default gen_random_uuid(),
  task_key text not null unique,
  title text not null,
  target_folder text not null,
  risk text not null default 'medium',
  status text not null default 'planned',
  reason text,
  created_at timestamptz not null default now()
);

create table if not exists public.permission_navigation_rules (
  id uuid primary key default gen_random_uuid(),
  nav_key text not null unique,
  label text not null,
  route text not null,
  module text not null,
  required_permission text,
  required_any_permission text[],
  risk_level text not null default 'medium',
  show_in_sidebar boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.enterprise_table_migration_tasks (
  id uuid primary key default gen_random_uuid(),
  task_key text not null unique,
  screen text not null,
  module text not null,
  estimated_rows int not null default 0,
  needs_server_pagination boolean not null default true,
  needs_export boolean not null default true,
  status text not null default 'planned',
  created_at timestamptz not null default now()
);

create table if not exists public.live_error_support_cases (
  id uuid primary key default gen_random_uuid(),
  reference_id text not null unique,
  severity text not null check (severity in ('info','warning','error','critical')),
  module text not null,
  message text not null,
  user_message text,
  metadata jsonb not null default '{}'::jsonb,
  status text not null default 'open' check (status in ('open','investigating','resolved','closed')),
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  resolved_at timestamptz
);

create table if not exists public.live_audit_events (
  id uuid primary key default gen_random_uuid(),
  module text not null,
  action text not null,
  record_type text,
  record_id text,
  branch_id text references public.branches(id) on delete set null,
  risk text not null default 'medium',
  before_snapshot jsonb,
  after_snapshot jsonb,
  metadata jsonb not null default '{}'::jsonb,
  actor_id uuid references auth.users(id),
  created_at timestamptz not null default now()
);

create table if not exists public.staging_deployment_checks (
  id uuid primary key default gen_random_uuid(),
  check_key text not null unique,
  label text not null,
  status text not null default 'not_checked',
  required boolean not null default true,
  owner text not null default 'developer',
  notes text,
  created_at timestamptz not null default now()
);

create table if not exists public.uat_scenarios (
  id uuid primary key default gen_random_uuid(),
  scenario_key text not null unique,
  title text not null,
  module text not null,
  status text not null default 'not_started',
  critical boolean not null default true,
  steps jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.production_go_live_checklist (
  id uuid primary key default gen_random_uuid(),
  item_key text not null unique,
  section text not null,
  label text not null,
  status text not null default 'not_checked',
  required boolean not null default true,
  notes text,
  created_at timestamptz not null default now()
);

create index if not exists idx_live_error_support_cases_status on public.live_error_support_cases(status, severity, created_at desc);
create index if not exists idx_live_audit_events_module on public.live_audit_events(module, action, created_at desc);
create index if not exists idx_staging_deployment_checks_status on public.staging_deployment_checks(status, required);
create index if not exists idx_uat_scenarios_status on public.uat_scenarios(status, critical);
create index if not exists idx_production_go_live_checklist_status on public.production_go_live_checklist(status, required);

alter table public.appshell_refactor_tasks enable row level security;
alter table public.permission_navigation_rules enable row level security;
alter table public.enterprise_table_migration_tasks enable row level security;
alter table public.live_error_support_cases enable row level security;
alter table public.live_audit_events enable row level security;
alter table public.staging_deployment_checks enable row level security;
alter table public.uat_scenarios enable row level security;
alter table public.production_go_live_checklist enable row level security;

insert into public.staging_deployment_checks (check_key, label, status, required, owner)
values
  ('build_passes', 'Build passes', 'not_checked', true, 'developer'),
  ('qa_all_passes', 'QA all passes', 'not_checked', true, 'developer'),
  ('migrations_applied_staging', 'Migrations applied to staging', 'not_checked', true, 'developer'),
  ('rls_tests_pass', 'RLS tests pass', 'not_checked', true, 'developer'),
  ('backup_restore_tested', 'Backup and restore tested', 'not_checked', true, 'admin'),
  ('uat_data_loaded', 'UAT data loaded', 'not_checked', true, 'operations')
on conflict (check_key) do update set
  label = excluded.label,
  required = excluded.required,
  owner = excluded.owner;

insert into public.production_go_live_checklist (item_key, section, label, status, required)
values
  ('production_backup', 'Backup', 'Production backup plan approved', 'not_checked', true),
  ('restore_test', 'Backup', 'Restore tested on staging', 'not_checked', true),
  ('admin_users', 'Access', 'Admin users confirmed', 'not_checked', true),
  ('roles_assigned', 'Access', 'Roles and branch assignments confirmed', 'not_checked', true),
  ('opening_balances', 'Finance', 'Opening balances posted and reconciled', 'not_checked', true),
  ('opening_stock', 'Inventory', 'Opening stock posted and reconciled', 'not_checked', true),
  ('first_period_open', 'Finance', 'First fiscal period opened', 'not_checked', true),
  ('support_process', 'Support', 'Support escalation process ready', 'not_checked', true)
on conflict (item_key) do update set
  section = excluded.section,
  label = excluded.label,
  required = excluded.required;

create or replace function public.live_support_log_error(error_payload jsonb)
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

  insert into public.live_error_support_cases (
    reference_id,
    severity,
    module,
    message,
    user_message,
    metadata,
    created_by
  )
  values (
    error_payload->>'reference_id',
    error_payload->>'severity',
    error_payload->>'module',
    error_payload->>'message',
    error_payload->>'user_message',
    coalesce(error_payload->'metadata', '{}'::jsonb),
    auth.uid()
  )
  returning id into v_id;

  return jsonb_build_object('ok', true, 'message', 'Support error case logged.', 'id', v_id);
end;
$$;

create or replace function public.live_audit_log_event(audit_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  if not coalesce(public.app_current_user_has_permission('settings.manage'), false) then
    raise exception 'permission denied: settings.manage' using errcode = '42501';
  end if;

  insert into public.live_audit_events (
    module,
    action,
    record_type,
    record_id,
    branch_id,
    risk,
    before_snapshot,
    after_snapshot,
    metadata,
    actor_id
  )
  values (
    audit_payload->>'module',
    audit_payload->>'action',
    audit_payload->>'record_type',
    audit_payload->>'record_id',
    nullif(audit_payload->>'branch_id',''),
    coalesce(audit_payload->>'risk', 'medium'),
    audit_payload->'before_snapshot',
    audit_payload->'after_snapshot',
    coalesce(audit_payload->'metadata', '{}'::jsonb),
    auth.uid()
  )
  returning id into v_id;

  return jsonb_build_object('ok', true, 'message', 'Audit event logged.', 'id', v_id);
end;
$$;

create or replace function public.go_live_readiness_summary()
returns jsonb
language sql
security definer
set search_path = public
as $$
  with checklist as (
    select
      count(*) filter (where required and status = 'blocked') as blocked,
      count(*) filter (where required and status = 'not_checked') as not_checked,
      count(*) filter (where status = 'ready') as ready,
      count(*) as total
    from public.production_go_live_checklist
    where public.app_current_user_has_permission('settings.manage') or public.app_current_user_has_permission('reports.view')
  )
  select jsonb_build_object(
    'ok', blocked = 0 and not_checked = 0,
    'status', case when blocked > 0 then 'blocked' when not_checked > 0 then 'warning' else 'ready' end,
    'blocked', blocked,
    'not_checked', not_checked,
    'ready', ready,
    'total', total
  )
  from checklist;
$$;
do $$
begin
  if to_regprocedure('public.live_support_log_error(jsonb)') is not null then
    execute 'grant execute on function public.live_support_log_error(jsonb) to authenticated';
  end if;
end;
$$;
do $$
begin
  if to_regprocedure('public.live_audit_log_event(jsonb)') is not null then
    execute 'grant execute on function public.live_audit_log_event(jsonb) to authenticated';
  end if;
end;
$$;
do $$
begin
  if to_regprocedure('public.go_live_readiness_summary()') is not null then
    execute 'grant execute on function public.go_live_readiness_summary() to authenticated';
  end if;
end;
$$;
