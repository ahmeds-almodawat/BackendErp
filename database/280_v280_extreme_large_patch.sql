-- v280 Extreme Large Patch design notes
-- This file is documentation-first SQL for the next backend wiring stage.

create table if not exists public.setup_sync_dry_runs (
  id uuid primary key default gen_random_uuid(),
  company_id uuid,
  created_by uuid,
  status text not null default 'dry_run',
  payload_summary jsonb not null default '{}'::jsonb,
  validation_summary jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.posting_orchestration_dry_runs (
  id uuid primary key default gen_random_uuid(),
  company_id uuid,
  source_module text not null,
  source_document_id text,
  posting_mode text not null,
  guard_result jsonb not null default '{}'::jsonb,
  created_by uuid,
  created_at timestamptz not null default now()
);

create table if not exists public.module_refactor_registry (
  id uuid primary key default gen_random_uuid(),
  module_key text not null unique,
  current_location text,
  target_location text,
  priority text,
  status text not null default 'planned',
  notes text,
  updated_at timestamptz not null default now()
);
