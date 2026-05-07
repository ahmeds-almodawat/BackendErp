-- V22 Data Management Center design
-- Goal: support controlled imports with saved mappings, duplicate detection, validation, approval, rollback, and audit.

create table if not exists public.import_batches (
  id uuid primary key default gen_random_uuid(),
  import_type text not null,
  file_name text not null,
  file_type text not null check (file_type in ('csv','xlsx','json')),
  status text not null default 'draft' check (status in ('draft','mapped','validated','approved','posted','failed','rolled_back')),
  duplicate_key text,
  total_rows integer not null default 0,
  valid_rows integer not null default 0,
  error_rows integer not null default 0,
  uploaded_by uuid,
  approved_by uuid,
  posted_by uuid,
  created_at timestamptz not null default now(),
  posted_at timestamptz
);

create table if not exists public.import_mappings (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  import_type text not null,
  file_type text not null check (file_type in ('csv','xlsx')),
  duplicate_key text not null,
  mappings jsonb not null default '{}'::jsonb,
  requires_approval boolean not null default false,
  created_by uuid,
  created_at timestamptz not null default now()
);

create table if not exists public.import_rows (
  id uuid primary key default gen_random_uuid(),
  batch_id uuid not null references public.import_batches(id) on delete cascade,
  row_no integer not null,
  raw_data jsonb not null default '{}'::jsonb,
  mapped_data jsonb not null default '{}'::jsonb,
  status text not null default 'pending' check (status in ('pending','valid','error','posted','skipped')),
  errors text[] not null default '{}'
);

create unique index if not exists import_rows_batch_row_no_uq on public.import_rows(batch_id, row_no);
create index if not exists import_batches_type_status_idx on public.import_batches(import_type, status);
