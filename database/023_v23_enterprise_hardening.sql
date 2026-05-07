-- V23 Enterprise Hardening Design Notes
-- These tables are backend targets for the current local-first UI additions.

create table if not exists public.document_attachments (
  id uuid primary key default gen_random_uuid(),
  company_id uuid,
  document_type text not null,
  document_ref text not null,
  file_name text not null,
  storage_path text not null,
  uploaded_by uuid,
  created_at timestamptz not null default now()
);

create table if not exists public.document_timelines (
  id uuid primary key default gen_random_uuid(),
  company_id uuid,
  document_type text not null,
  document_ref text not null,
  status_from text,
  status_to text not null,
  action text not null,
  comment text,
  action_by uuid,
  created_at timestamptz not null default now()
);

create table if not exists public.ap_payment_runs (
  id uuid primary key default gen_random_uuid(),
  company_id uuid,
  run_no text not null,
  payment_date date not null,
  bank_account_code text not null,
  status text not null default 'draft',
  total_amount numeric(18,2) not null default 0,
  created_by uuid,
  approved_by uuid,
  posted_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.ap_payment_run_lines (
  id uuid primary key default gen_random_uuid(),
  payment_run_id uuid references public.ap_payment_runs(id) on delete cascade,
  supplier_id uuid,
  supplier_invoice_id uuid,
  amount numeric(18,2) not null,
  notes text
);

create table if not exists public.saved_report_views (
  id uuid primary key default gen_random_uuid(),
  company_id uuid,
  user_id uuid,
  module text not null,
  name text not null,
  filters jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
