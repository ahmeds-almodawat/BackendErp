-- v150 production launch suite migration
-- Adds backend-ready structures for import staging, approvals, posting orchestration, attachments, denied actions and close snapshots.

create extension if not exists pgcrypto;

create table if not exists public.import_batches (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null,
  import_type text not null,
  source_system text default 'manual',
  file_name text,
  file_hash text,
  status text not null default 'uploaded' check (status in ('uploaded','validated','approved','posted','reversed','failed')),
  uploaded_by uuid,
  approved_by uuid,
  approved_at timestamptz,
  posted_at timestamptz,
  validation_summary jsonb default '{}'::jsonb,
  created_at timestamptz default now()
);

create table if not exists public.import_batch_rows (
  id uuid primary key default gen_random_uuid(),
  batch_id uuid not null references public.import_batches(id) on delete cascade,
  row_no integer not null,
  natural_key text,
  raw_data jsonb not null,
  mapped_data jsonb default '{}'::jsonb,
  status text not null default 'staged' check (status in ('staged','valid','warning','error','imported','skipped')),
  errors jsonb default '[]'::jsonb,
  created_at timestamptz default now(),
  unique(batch_id, row_no)
);

create table if not exists public.approval_workflows (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null,
  entity_type text not null,
  entity_id uuid not null,
  status text not null default 'pending' check (status in ('pending','approved','rejected','cancelled')),
  requested_by uuid,
  requested_at timestamptz default now(),
  completed_at timestamptz,
  amount numeric default 0,
  branch_id text,
  store_id text,
  metadata jsonb default '{}'::jsonb
);

create table if not exists public.approval_actions (
  id uuid primary key default gen_random_uuid(),
  workflow_id uuid not null references public.approval_workflows(id) on delete cascade,
  action text not null check (action in ('submit','approve','reject','return','delegate','cancel')),
  actor_id uuid,
  comment text,
  created_at timestamptz default now()
);

create table if not exists public.posting_orchestrations (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null,
  document_type text not null,
  document_id uuid not null,
  posting_mode text not null,
  status text not null default 'draft' check (status in ('draft','validated','posted','reversed','failed')),
  validation_result jsonb default '{}'::jsonb,
  journal_entry_id uuid,
  stock_movement_ids uuid[] default '{}',
  requested_by uuid,
  posted_by uuid,
  posted_at timestamptz,
  reversal_reason text,
  created_at timestamptz default now()
);

create table if not exists public.denied_actions (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null,
  actor_id uuid,
  permission_key text not null,
  entity_type text,
  entity_id uuid,
  branch_id text,
  store_id text,
  reason text,
  request_payload jsonb default '{}'::jsonb,
  created_at timestamptz default now()
);

create table if not exists public.document_timelines (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null,
  document_type text not null,
  document_id uuid not null,
  event_type text not null,
  event_note text,
  actor_id uuid,
  event_payload jsonb default '{}'::jsonb,
  created_at timestamptz default now()
);

create table if not exists public.close_snapshots (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null,
  period_code text not null,
  close_type text not null,
  status text not null default 'open' check (status in ('open','ready','closed','reopened')),
  checklist jsonb default '[]'::jsonb,
  metrics jsonb default '{}'::jsonb,
  closed_by uuid,
  closed_at timestamptz,
  created_at timestamptz default now(),
  unique(company_id, period_code, close_type)
);

create index if not exists idx_import_batches_company_status on public.import_batches(company_id, status);
create index if not exists idx_approval_workflows_company_entity on public.approval_workflows(company_id, entity_type, entity_id);
create index if not exists idx_posting_orchestrations_company_doc on public.posting_orchestrations(company_id, document_type, document_id);
create index if not exists idx_denied_actions_company_created on public.denied_actions(company_id, created_at desc);
create index if not exists idx_document_timelines_doc on public.document_timelines(company_id, document_type, document_id, created_at);
