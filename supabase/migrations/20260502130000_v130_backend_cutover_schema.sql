-- v130 Backend Cutover Schema Additions
-- Safe extension of the v120 local prototype into backend-ready domains.
create extension if not exists pgcrypto;

create table if not exists public.backend_cutover_runs (
  id uuid primary key default gen_random_uuid(),
  company_id uuid,
  period_code text not null,
  run_name text not null,
  status text not null default 'draft' check (status in ('draft','reviewed','approved','locked','cancelled')),
  readiness_score numeric not null default 0,
  backend_score numeric not null default 0,
  production_score numeric not null default 0,
  notes text,
  created_by uuid,
  approved_by uuid,
  created_at timestamptz not null default now(),
  approved_at timestamptz
);

create table if not exists public.backend_cutover_tasks (
  id uuid primary key default gen_random_uuid(),
  run_id uuid references public.backend_cutover_runs(id) on delete cascade,
  wave text not null,
  area text not null,
  task_name text not null,
  owner_role text,
  priority text not null default 'medium' check (priority in ('critical','high','medium','low')),
  status text not null default 'open' check (status in ('open','in_progress','blocked','done','cancelled')),
  evidence text,
  exit_criteria text,
  due_date date,
  created_at timestamptz not null default now()
);

create table if not exists public.api_contract_registry (
  id uuid primary key default gen_random_uuid(),
  function_name text not null unique,
  endpoint text not null,
  required_permission text not null,
  required_scope text,
  payload_schema jsonb not null default '{}'::jsonb,
  response_schema jsonb not null default '{}'::jsonb,
  lifecycle_status text not null default 'draft' check (lifecycle_status in ('draft','ready','active','deprecated')),
  created_at timestamptz not null default now()
);

create table if not exists public.import_staging_batches (
  id uuid primary key default gen_random_uuid(),
  company_id uuid,
  source_system text not null,
  import_type text not null,
  batch_key text not null,
  source_filename text,
  file_hash text,
  status text not null default 'uploaded' check (status in ('uploaded','validated','approved','posted','reversed','rejected')),
  row_count integer not null default 0,
  error_count integer not null default 0,
  warning_count integer not null default 0,
  metadata jsonb not null default '{}'::jsonb,
  created_by uuid,
  created_at timestamptz not null default now()
);
create unique index if not exists import_staging_batches_unique_file_idx
on public.import_staging_batches (
  company_id,
  source_system,
  import_type,
  batch_key,
  (coalesce(file_hash, ''))
);


create table if not exists public.import_staging_rows (
  id uuid primary key default gen_random_uuid(),
  batch_id uuid not null references public.import_staging_batches(id) on delete cascade,
  row_no integer not null,
  row_hash text not null,
  external_ref text,
  raw_data jsonb not null,
  normalized_data jsonb not null default '{}'::jsonb,
  validation_status text not null default 'pending' check (validation_status in ('pending','valid','warning','error','posted','ignored')),
  validation_errors jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  unique(batch_id, row_hash)
);

-- Auto compatibility columns for later enterprise migrations.
alter table if exists public.import_staging_rows add column if not exists file_id uuid;
alter table if exists public.import_staging_rows add column if not exists row_number int;
alter table if exists public.import_staging_rows add column if not exists mapped_data jsonb;
alter table if exists public.import_staging_rows add column if not exists is_valid boolean;


create table if not exists public.posting_guard_results (
  id uuid primary key default gen_random_uuid(),
  company_id uuid,
  source_module text not null,
  source_ref text not null,
  requested_action text not null,
  allowed boolean not null default false,
  blockers jsonb not null default '[]'::jsonb,
  warnings jsonb not null default '[]'::jsonb,
  generated_journal_id uuid,
  generated_stock_refs jsonb not null default '[]'::jsonb,
  requested_by uuid,
  created_at timestamptz not null default now()
);

create index if not exists idx_backend_cutover_runs_period on public.backend_cutover_runs(period_code);
create index if not exists idx_import_staging_batches_key on public.import_staging_batches(source_system, import_type, batch_key);
create index if not exists idx_import_staging_rows_batch on public.import_staging_rows(batch_id);
create index if not exists idx_posting_guard_results_source on public.posting_guard_results(source_module, source_ref);

