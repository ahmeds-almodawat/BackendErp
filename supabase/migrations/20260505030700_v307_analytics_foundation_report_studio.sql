-- v307 Analytics Foundation & Report Studio
create table if not exists public.report_import_registrations (
  id uuid primary key default gen_random_uuid(),
  source_name text not null,
  original_file_name text not null,
  file_type text not null check (file_type in ('csv','xlsx','pdf')),
  mapped_report_pack text not null,
  owner_department text not null default 'Management',
  validation_status text not null default 'registered' check (validation_status in ('registered','validated','rejected')),
  validation_errors jsonb not null default '[]'::jsonb,
  storage_path text,
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.custom_kpi_definitions (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  formula text not null,
  chart_type text not null default 'bar' check (chart_type in ('bar','line','doughnut')),
  target numeric not null default 0,
  warning_threshold numeric not null default 0,
  critical_threshold numeric not null default 0,
  color text not null default '#22d3ee',
  visible boolean not null default true,
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.smart_analysis_views (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  period_from date,
  period_to date,
  comparison_mode text not null default 'previousSameLength',
  comparison_from date,
  comparison_to date,
  selected_kpis text[] not null default '{}',
  colors jsonb not null default '{}'::jsonb,
  visibility text not null default 'private' check (visibility in ('private','management','all')),
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.analytics_data_quality_checks (
  id uuid primary key default gen_random_uuid(),
  check_key text not null unique,
  check_label text not null,
  severity text not null default 'warning' check (severity in ('ok','warning','critical')),
  owner_module text not null,
  action_required text not null,
  last_checked_at timestamptz
);

alter table public.report_import_registrations enable row level security;
alter table public.custom_kpi_definitions enable row level security;
alter table public.smart_analysis_views enable row level security;
alter table public.analytics_data_quality_checks enable row level security;

do $$ begin
  if not exists (select 1 from pg_policies where schemaname = split_part('public.report_import_registrations', '.', 1) and tablename = split_part('public.report_import_registrations', '.', 2) and policyname = 'report_import_registrations_authenticated_read') then
    create policy report_import_registrations_authenticated_read on public.report_import_registrations for select to authenticated using (true);
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_policies where schemaname = split_part('public.custom_kpi_definitions', '.', 1) and tablename = split_part('public.custom_kpi_definitions', '.', 2) and policyname = 'custom_kpi_definitions_authenticated_read') then
    create policy custom_kpi_definitions_authenticated_read on public.custom_kpi_definitions for select to authenticated using (true);
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_policies where schemaname = split_part('public.smart_analysis_views', '.', 1) and tablename = split_part('public.smart_analysis_views', '.', 2) and policyname = 'smart_analysis_views_authenticated_read') then
    create policy smart_analysis_views_authenticated_read on public.smart_analysis_views for select to authenticated using (true);
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_policies where schemaname = split_part('public.analytics_data_quality_checks', '.', 1) and tablename = split_part('public.analytics_data_quality_checks', '.', 2) and policyname = 'analytics_data_quality_checks_authenticated_read') then
    create policy analytics_data_quality_checks_authenticated_read on public.analytics_data_quality_checks for select to authenticated using (true);
  end if;
end $$;
