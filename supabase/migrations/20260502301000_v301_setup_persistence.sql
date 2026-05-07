create extension if not exists pgcrypto;

create table if not exists public.companies (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name_en text not null,
  name_ar text,
  currency text not null default 'SAR',
  vat_rate numeric not null default 15,
  created_at timestamptz not null default now()
);

create table if not exists public.branches (
  id text primary key,
  company_id uuid references public.companies(id) on delete cascade,
  code text not null,
  name_en text not null,
  name_ar text,
  location text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  unique(company_id, code)
);

-- Auto compatibility columns for later enterprise migrations.
alter table if exists public.branches add column if not exists status text;
alter table if exists public.branches add column if not exists is_head_office boolean;
alter table if exists public.branches add column if not exists updated_at timestamptz;


create table if not exists public.stores (
  id text primary key,
  company_id uuid references public.companies(id) on delete cascade,
  branch_id text references public.branches(id),
  code text not null,
  name_en text not null,
  name_ar text,
  store_type text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  unique(company_id, code)
);

-- Auto compatibility columns for later enterprise migrations.
alter table if exists public.stores add column if not exists status text;
alter table if exists public.stores add column if not exists updated_at timestamptz;


create table if not exists public.suppliers (
  id text primary key,
  company_id uuid references public.companies(id) on delete cascade,
  code text not null,
  name text not null,
  vat_no text,
  payment_terms text,
  contact_name text,
  phone text,
  email text,
  bank_name text,
  bank_account text,
  representative_name text,
  representative_phone text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  unique(company_id, code)
);

-- Auto compatibility columns for later enterprise migrations.
alter table if exists public.suppliers add column if not exists supplier_code text;
alter table if exists public.suppliers add column if not exists vat_number text;
alter table if exists public.suppliers add column if not exists default_account_code text;
alter table if exists public.suppliers add column if not exists status text;
alter table if exists public.suppliers add column if not exists updated_at timestamptz;


create table if not exists public.items (
  id text primary key,
  company_id uuid references public.companies(id) on delete cascade,
  sku text not null,
  name_en text not null,
  name_ar text,
  category text,
  purchase_unit text,
  consumption_unit text,
  conversion_factor numeric not null default 1,
  standard_cost numeric not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  unique(company_id, sku)
);

-- Auto compatibility columns for later enterprise migrations.
alter table if exists public.items add column if not exists category_id uuid;
alter table if exists public.items add column if not exists costing_method text;
alter table if exists public.items add column if not exists min_stock numeric;
alter table if exists public.items add column if not exists max_stock numeric;
alter table if exists public.items add column if not exists reorder_point numeric;
alter table if exists public.items add column if not exists stock_item boolean;
alter table if exists public.items add column if not exists recipe_item boolean;
alter table if exists public.items add column if not exists sale_item boolean;
alter table if exists public.items add column if not exists status text;
alter table if exists public.items add column if not exists updated_at timestamptz;


create table if not exists public.cost_centers (
  id text primary key,
  company_id uuid references public.companies(id) on delete cascade,
  branch_id text references public.branches(id),
  code text not null,
  name_en text not null,
  name_ar text,
  budget numeric not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  unique(company_id, code)
);

create table if not exists public.chart_accounts (
  id text primary key,
  company_id uuid references public.companies(id) on delete cascade,
  code text not null,
  name_en text not null,
  name_ar text,
  account_type text not null,
  parent_code text,
  active boolean not null default true,
  require_cost_center boolean not null default false,
  created_at timestamptz not null default now(),
  unique(company_id, code)
);

-- Auto compatibility columns for later enterprise migrations.
alter table if exists public.chart_accounts add column if not exists account_code text;
alter table if exists public.chart_accounts add column if not exists parent_account_code text;
alter table if exists public.chart_accounts add column if not exists normal_balance text;
alter table if exists public.chart_accounts add column if not exists allow_posting boolean;
alter table if exists public.chart_accounts add column if not exists status text;
alter table if exists public.chart_accounts add column if not exists updated_at timestamptz;


create table if not exists public.setup_sync_batches (
  id uuid primary key default gen_random_uuid(),
  company_code text not null,
  dry_run boolean not null default true,
  status text not null default 'received',
  payload jsonb not null,
  validation jsonb not null default '[]'::jsonb,
  row_counts jsonb not null default '{}'::jsonb,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now()
);

create table if not exists public.audit_events (
  id uuid primary key default gen_random_uuid(),
  company_code text,
  action text not null,
  entity text not null,
  entity_ref text,
  actor_id uuid default auth.uid(),
  note text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

alter table public.companies enable row level security;
alter table public.branches enable row level security;
alter table public.stores enable row level security;
alter table public.suppliers enable row level security;
alter table public.items enable row level security;
alter table public.cost_centers enable row level security;
alter table public.chart_accounts enable row level security;
alter table public.setup_sync_batches enable row level security;
alter table public.audit_events enable row level security;

-- Pilot policies: authenticated users can read setup data. Tighten company membership before production.
do $$ begin
  create policy "authenticated read companies" on public.companies for select to authenticated using (true);
exception when duplicate_object then null; end $$;
do $$ begin
  create policy "authenticated read branches" on public.branches for select to authenticated using (true);
exception when duplicate_object then null; end $$;
do $$ begin
  create policy "authenticated read stores" on public.stores for select to authenticated using (true);
exception when duplicate_object then null; end $$;
do $$ begin
  create policy "authenticated read suppliers" on public.suppliers for select to authenticated using (true);
exception when duplicate_object then null; end $$;
do $$ begin
  create policy "authenticated read items" on public.items for select to authenticated using (true);
exception when duplicate_object then null; end $$;
do $$ begin
  create policy "authenticated read cost centers" on public.cost_centers for select to authenticated using (true);
exception when duplicate_object then null; end $$;
do $$ begin
  create policy "authenticated read chart accounts" on public.chart_accounts for select to authenticated using (true);
exception when duplicate_object then null; end $$;
do $$ begin
  create policy "authenticated insert setup sync" on public.setup_sync_batches for insert to authenticated with check (true);
exception when duplicate_object then null; end $$;
do $$ begin
  create policy "authenticated read own setup sync" on public.setup_sync_batches for select to authenticated using (created_by = auth.uid() or created_by is null);
exception when duplicate_object then null; end $$;
do $$ begin
  create policy "authenticated read audit" on public.audit_events for select to authenticated using (true);
exception when duplicate_object then null; end $$;
