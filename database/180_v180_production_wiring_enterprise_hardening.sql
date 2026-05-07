-- v180 Production Wiring + Enterprise Hardening design notes
-- This file documents backend-ready structures for the next implementation phase.

create table if not exists public.backend_mode_status (
  id uuid primary key default gen_random_uuid(),
  company_id uuid,
  mode text not null check (mode in ('local_trial','supabase_pilot','production')),
  status text not null default 'draft',
  readiness_score numeric default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.master_data_validation_runs (
  id uuid primary key default gen_random_uuid(),
  company_id uuid,
  run_at timestamptz default now(),
  run_by uuid,
  scope text not null default 'all',
  blockers int default 0,
  warnings int default 0,
  score numeric default 0,
  summary jsonb default '{}'::jsonb
);

create table if not exists public.posting_orchestration_requests (
  id uuid primary key default gen_random_uuid(),
  company_id uuid,
  document_type text not null,
  document_id uuid,
  posting_mode text not null,
  requested_by uuid,
  requested_at timestamptz default now(),
  status text not null default 'requested',
  validation_summary jsonb default '{}'::jsonb,
  result_summary jsonb default '{}'::jsonb
);

create table if not exists public.stock_reservations (
  id uuid primary key default gen_random_uuid(),
  company_id uuid,
  store_id uuid,
  item_id uuid,
  source_document_type text,
  source_document_id uuid,
  reserved_qty numeric not null default 0,
  status text not null default 'reserved',
  expires_at timestamptz,
  created_at timestamptz default now()
);

create table if not exists public.inventory_period_locks (
  id uuid primary key default gen_random_uuid(),
  company_id uuid,
  fiscal_period_id uuid,
  store_id uuid,
  status text not null default 'open',
  locked_by uuid,
  locked_at timestamptz,
  close_snapshot jsonb default '{}'::jsonb
);

create table if not exists public.finance_voucher_register (
  id uuid primary key default gen_random_uuid(),
  company_id uuid,
  voucher_type text not null,
  voucher_no text not null,
  date date not null,
  counterparty text,
  amount numeric not null default 0,
  status text not null default 'draft',
  journal_entry_id uuid,
  created_at timestamptz default now(),
  unique(company_id, voucher_type, voucher_no)
);
