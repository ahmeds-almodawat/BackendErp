-- v19 control layer design notes
-- Supabase-ready tables to add in production phase.

create table if not exists public.fiscal_periods (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name_en text not null,
  name_ar text not null,
  start_date date not null,
  end_date date not null,
  status text not null default 'open' check (status in ('open','locked','closed')),
  locked_by uuid null,
  locked_at timestamptz null,
  created_at timestamptz not null default now()
);

create table if not exists public.bank_reconciliation_lines (
  id uuid primary key default gen_random_uuid(),
  date date not null,
  bank_account_code text not null,
  description text not null,
  statement_amount numeric not null default 0,
  matched_journal_ref text null,
  status text not null default 'unmatched' check (status in ('unmatched','matched','adjustment_needed')),
  created_at timestamptz not null default now()
);

create table if not exists public.import_profiles (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  import_type text not null,
  file_type text not null check (file_type in ('csv','xlsx')),
  duplicate_key text not null,
  requires_approval boolean not null default true,
  mappings jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

-- Server-side posting functions should reject controlled postings if the document date is in a locked/closed fiscal period.
-- Permission checks must happen server-side via custom RBAC tables before posting: journals, GRNs, payments, inventory adjustments, sales batches.
