-- v13 Enterprise Accounting Upgrade - Supabase-ready design notes
-- This file is intentionally additive. It documents the tables needed when moving
-- the local finance engine to PostgreSQL/Supabase.

create table if not exists public.finance_fiscal_periods (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  start_date date not null,
  end_date date not null,
  status text not null default 'open' check (status in ('open','soft_closed','locked')),
  closed_by uuid,
  closed_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.journal_entries (
  id uuid primary key default gen_random_uuid(),
  journal_no text not null unique,
  journal_date date not null,
  source_module text not null,
  source_document_type text,
  source_document_id uuid,
  description text,
  status text not null default 'draft' check (status in ('draft','posted','reversed')),
  posted_by uuid,
  posted_at timestamptz,
  reversed_by uuid,
  reversed_at timestamptz,
  reversal_of uuid references public.journal_entries(id),
  created_at timestamptz not null default now()
);

create table if not exists public.journal_entry_lines (
  id uuid primary key default gen_random_uuid(),
  journal_entry_id uuid not null references public.journal_entries(id) on delete cascade,
  account_code text not null,
  branch_id uuid,
  cost_center_id uuid,
  debit numeric(18,4) not null default 0,
  credit numeric(18,4) not null default 0,
  memo text,
  created_at timestamptz not null default now(),
  check (debit >= 0 and credit >= 0 and not (debit > 0 and credit > 0))
);

create table if not exists public.finance_posting_rules (
  id uuid primary key default gen_random_uuid(),
  event_key text not null unique,
  description_en text not null,
  description_ar text not null,
  debit_rule jsonb not null default '[]'::jsonb,
  credit_rule jsonb not null default '[]'::jsonb,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.bank_reconciliation_batches (
  id uuid primary key default gen_random_uuid(),
  bank_account_code text not null,
  statement_date date not null,
  opening_balance numeric(18,4) not null default 0,
  closing_balance numeric(18,4) not null default 0,
  status text not null default 'draft' check (status in ('draft','reconciled','locked')),
  created_at timestamptz not null default now()
);

-- Required database validations for production:
-- 1. Posted journals must balance: sum(debit) = sum(credit).
-- 2. Closed/locked fiscal periods must block new postings.
-- 3. Accounts requiring cost center must reject null cost_center_id.
-- 4. Reversal must create a separate reversing entry, not physically delete history.
