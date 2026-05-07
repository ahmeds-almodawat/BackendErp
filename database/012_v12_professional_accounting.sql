-- V12 professional accounting schema notes
-- This file describes the backend-ready structure to implement in Supabase/Postgres.

create table if not exists chart_accounts (
  id uuid primary key default gen_random_uuid(),
  code text unique not null,
  name_en text not null,
  name_ar text,
  account_type text not null check (account_type in ('asset','liability','equity','revenue','cogs','expense','other_income','other_expense')),
  parent_code text,
  require_cost_center boolean default false,
  active boolean default true,
  created_at timestamptz default now()
);

create table if not exists journal_entries (
  id uuid primary key default gen_random_uuid(),
  journal_no text unique not null,
  journal_date date not null,
  source_module text not null,
  source_document_type text,
  source_document_id text,
  description text,
  status text not null default 'draft' check (status in ('draft','posted','reversed')),
  posted_at timestamptz,
  posted_by uuid,
  created_at timestamptz default now()
);

create table if not exists journal_lines (
  id uuid primary key default gen_random_uuid(),
  journal_entry_id uuid not null references journal_entries(id) on delete cascade,
  account_code text not null references chart_accounts(code),
  debit numeric(18,2) default 0 check (debit >= 0),
  credit numeric(18,2) default 0 check (credit >= 0),
  branch_id uuid,
  cost_center_id uuid,
  memo text,
  created_at timestamptz default now(),
  check ((debit > 0 and credit = 0) or (credit > 0 and debit = 0))
);

create table if not exists fixed_assets (
  id uuid primary key default gen_random_uuid(),
  asset_code text unique not null,
  asset_name text not null,
  asset_category text,
  branch_id uuid,
  cost_center_id uuid,
  purchase_date date,
  cost numeric(18,2) not null default 0,
  useful_life_months integer not null default 60,
  salvage_value numeric(18,2) default 0,
  accumulated_depreciation numeric(18,2) default 0,
  active boolean default true,
  created_at timestamptz default now()
);

create table if not exists recipe_lines (
  id uuid primary key default gen_random_uuid(),
  menu_item_id uuid not null,
  item_id uuid not null,
  quantity numeric(18,4) not null,
  unit text not null,
  wastage_pct numeric(8,4) default 0,
  note text,
  active boolean default true,
  created_at timestamptz default now()
);

-- Future database rule: posted journals must balance.
-- This can be enforced through a posting function that checks sum(debit)=sum(credit) before status becomes posted.
