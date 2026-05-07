-- v313 Reporting Truth foundation
-- Additive only: does not drop or rename v310/v311/v312 tables.

create extension if not exists pgcrypto;

create table if not exists public.reporting_truth_snapshots (
  id uuid primary key default gen_random_uuid(),
  period_start date not null,
  period_end date not null,
  branch_id text references public.branches(id) on delete set null,
  truth_score int not null default 0 check (truth_score between 0 and 100),
  status text not null default 'incomplete' check (status in ('trusted', 'warning', 'critical', 'incomplete')),
  critical_count int not null default 0,
  warning_count int not null default 0,
  info_count int not null default 0,
  message text,
  metadata jsonb not null default '{}'::jsonb,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);

create table if not exists public.reporting_truth_snapshot_metrics (
  id uuid primary key default gen_random_uuid(),
  snapshot_id uuid not null references public.reporting_truth_snapshots(id) on delete cascade,
  domain text not null,
  metric_key text not null,
  metric_label text not null,
  metric_value text,
  unit text,
  sources jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  unique (snapshot_id, domain, metric_key)
);

create table if not exists public.reporting_truth_findings (
  id uuid primary key default gen_random_uuid(),
  snapshot_id uuid not null references public.reporting_truth_snapshots(id) on delete cascade,
  domain text not null,
  severity text not null check (severity in ('info', 'warning', 'critical')),
  message text not null,
  action text,
  source_table text,
  source_id text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.reporting_report_runs (
  id uuid primary key default gen_random_uuid(),
  snapshot_id uuid references public.reporting_truth_snapshots(id) on delete set null,
  report_key text not null,
  report_title text not null,
  domain text not null,
  period_start date not null,
  period_end date not null,
  branch_id text references public.branches(id) on delete set null,
  status text not null default 'incomplete' check (status in ('trusted', 'warning', 'critical', 'incomplete')),
  truth_score int not null default 0 check (truth_score between 0 and 100),
  metrics jsonb not null default '[]'::jsonb,
  findings jsonb not null default '[]'::jsonb,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);

create table if not exists public.reporting_report_run_sources (
  id uuid primary key default gen_random_uuid(),
  report_run_id uuid not null references public.reporting_report_runs(id) on delete cascade,
  source_table text not null,
  note text,
  created_at timestamptz not null default now()
);

create table if not exists public.reporting_saved_periods (
  id uuid primary key default gen_random_uuid(),
  label text not null,
  period_start date not null,
  period_end date not null,
  branch_id text references public.branches(id) on delete set null,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  unique (label, period_start, period_end, branch_id)
);

create index if not exists idx_reporting_truth_snapshots_period on public.reporting_truth_snapshots(period_start, period_end);
create index if not exists idx_reporting_truth_snapshots_branch on public.reporting_truth_snapshots(branch_id, created_at desc);
create index if not exists idx_reporting_truth_findings_snapshot on public.reporting_truth_findings(snapshot_id, severity, created_at desc);
create index if not exists idx_reporting_report_runs_snapshot on public.reporting_report_runs(snapshot_id, domain, created_at desc);
create index if not exists idx_reporting_report_run_sources_run on public.reporting_report_run_sources(report_run_id);

create or replace function public.reporting_log_finding(
  snapshot_id uuid,
  domain text,
  severity text,
  message text,
  source_table text default null,
  source_id text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  if snapshot_id is null then
    return jsonb_build_object(
      'ok', false,
      'truth_score', 0,
      'critical_count', 1,
      'warning_count', 0,
      'message', 'snapshot_id is required',
      'findings', jsonb_build_array(jsonb_build_object('severity','critical','message','snapshot_id missing'))
    );
  end if;

  insert into public.reporting_truth_findings (
    snapshot_id,
    domain,
    severity,
    message,
    source_table,
    source_id
  )
  values (
    snapshot_id,
    coalesce(trim(domain), 'management'),
    case when severity in ('info','warning','critical') then severity else 'warning' end,
    coalesce(trim(message), 'Finding logged.'),
    nullif(trim(source_table), ''),
    nullif(trim(source_id), '')
  )
  returning id into v_id;

  return jsonb_build_object(
    'ok', true,
    'truth_score', 0,
    'critical_count', 0,
    'warning_count', 0,
    'message', 'Finding logged.',
    'findings', jsonb_build_array(jsonb_build_object('id', v_id::text))
  );
end;
$$;

create or replace function public.reporting_create_truth_snapshot(
  period_start date,
  period_end date,
  branch_id text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  if period_start is null or period_end is null then
    return jsonb_build_object(
      'ok', false,
      'truth_score', 0,
      'critical_count', 1,
      'warning_count', 0,
      'message', 'period_start and period_end are required',
      'findings', jsonb_build_array(jsonb_build_object('severity','critical','message','period_start/period_end missing'))
    );
  end if;

  insert into public.reporting_truth_snapshots (
    period_start,
    period_end,
    branch_id,
    created_by,
    status,
    message
  )
  values (
    reporting_create_truth_snapshot.period_start,
    reporting_create_truth_snapshot.period_end,
    reporting_create_truth_snapshot.branch_id,
    auth.uid(),
    'incomplete',
    'Snapshot created (v313 foundation). Populate metrics/findings from real report runs.'
  )
  returning id into v_id;

  return jsonb_build_object(
    'ok', true,
    'truth_score', 0,
    'critical_count', 0,
    'warning_count', 0,
    'message', 'Truth snapshot created.',
    'findings', jsonb_build_array(jsonb_build_object('snapshot_id', v_id::text))
  );
end;
$$;

create or replace function public.reporting_get_truth_summary(snapshot_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_snapshot record;
  v_critical int := 0;
  v_warning int := 0;
  v_score int := 0;
begin
  select * into v_snapshot from public.reporting_truth_snapshots where id = snapshot_id;
  if not found then
    return jsonb_build_object(
      'ok', false,
      'truth_score', 0,
      'critical_count', 1,
      'warning_count', 0,
      'message', 'Snapshot not found.',
      'findings', jsonb_build_array(jsonb_build_object('severity','critical','message','snapshot not found'))
    );
  end if;

  select count(*) filter (where severity = 'critical'),
         count(*) filter (where severity = 'warning')
    into v_critical, v_warning
  from public.reporting_truth_findings
  where reporting_truth_findings.snapshot_id = reporting_get_truth_summary.snapshot_id;

  v_score := greatest(0, least(100, 100 - v_critical * 25 - v_warning * 10));

  return jsonb_build_object(
    'ok', true,
    'truth_score', v_score,
    'critical_count', v_critical,
    'warning_count', v_warning,
    'message', coalesce(v_snapshot.message, 'Truth summary ready.'),
    'findings', '[]'::jsonb
  );
end;
$$;
do $$
begin
  if to_regprocedure('public.reporting_create_truth_snapshot(date, date, uuid)') is not null then
    execute 'grant execute on function public.reporting_create_truth_snapshot(date, date, uuid) to authenticated';
  end if;
end;
$$;
do $$
begin
  if to_regprocedure('public.reporting_get_truth_summary(uuid)') is not null then
    execute 'grant execute on function public.reporting_get_truth_summary(uuid) to authenticated';
  end if;
end;
$$;
do $$
begin
  if to_regprocedure('public.reporting_log_finding(uuid, text, text, text, text, text)') is not null then
    execute 'grant execute on function public.reporting_log_finding(uuid, text, text, text, text, text) to authenticated';
  end if;
end;
$$;

alter table public.reporting_truth_snapshots enable row level security;
alter table public.reporting_truth_snapshot_metrics enable row level security;
alter table public.reporting_truth_findings enable row level security;
alter table public.reporting_report_runs enable row level security;
alter table public.reporting_report_run_sources enable row level security;
alter table public.reporting_saved_periods enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'reporting_truth_snapshots' and policyname = 'reporting_truth_snapshots_read'
  ) then
    create policy reporting_truth_snapshots_read on public.reporting_truth_snapshots
      for select to authenticated using (
        public.app_current_user_has_permission('reports.view')
        or public.app_current_user_has_permission('finance.view')
        or public.app_current_user_has_permission('settings.manage')
      );
  end if;

  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'reporting_truth_snapshots' and policyname = 'reporting_truth_snapshots_write'
  ) then
    create policy reporting_truth_snapshots_write on public.reporting_truth_snapshots
      for insert to authenticated with check (
        public.app_current_user_has_permission('reports.view')
        or public.app_current_user_has_permission('settings.manage')
      );
  end if;

  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'reporting_truth_findings' and policyname = 'reporting_truth_findings_write'
  ) then
    create policy reporting_truth_findings_write on public.reporting_truth_findings
      for insert to authenticated with check (
        public.app_current_user_has_permission('reports.view')
        or public.app_current_user_has_permission('settings.manage')
      );
  end if;
end $$;

