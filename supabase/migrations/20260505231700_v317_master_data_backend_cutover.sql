-- v317 Real Master Data Backend Cutover
-- Additive foundation for Supabase-backed master data.
-- Does not remove existing local/demo UI state.

create extension if not exists pgcrypto;

create table if not exists public.stores (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name_en text not null,
  name_ar text not null,
  branch_id text references public.branches(id) on delete restrict,
  store_type text not null default 'main',
  status text not null default 'active' check (status in ('active', 'inactive', 'archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.suppliers (
  id uuid primary key default gen_random_uuid(),
  supplier_code text not null unique,
  name text not null,
  vat_number text,
  payment_terms text,
  default_account_code text,
  status text not null default 'active' check (status in ('active', 'inactive', 'archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.item_categories (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name_en text not null,
  name_ar text not null,
  category_kind text not null default 'item' check (category_kind in ('item', 'menu', 'expense', 'asset')),
  status text not null default 'active' check (status in ('active', 'inactive', 'archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.items (
  id uuid primary key default gen_random_uuid(),
  sku text not null unique,
  name_en text not null,
  name_ar text not null,
  category_id uuid references public.item_categories(id) on delete set null,
  purchase_unit text not null,
  consumption_unit text not null,
  conversion_factor numeric not null default 1 check (conversion_factor > 0),
  costing_method text not null default 'weighted_average' check (costing_method in ('weighted_average', 'fifo', 'standard')),
  standard_cost numeric,
  min_stock numeric,
  max_stock numeric,
  reorder_point numeric,
  stock_item boolean not null default true,
  recipe_item boolean not null default false,
  sale_item boolean not null default false,
  status text not null default 'active' check (status in ('active', 'inactive', 'archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.chart_accounts (
  id uuid primary key default gen_random_uuid(),
  account_code text not null unique,
  name_en text not null,
  name_ar text not null,
  account_type text not null check (account_type in ('asset', 'liability', 'equity', 'revenue', 'cogs', 'expense', 'other_income', 'other_expense')),
  parent_account_code text,
  normal_balance text not null check (normal_balance in ('debit', 'credit')),
  allow_posting boolean not null default true,
  require_cost_center boolean not null default false,
  status text not null default 'active' check (status in ('active', 'inactive', 'archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.master_data_cutover_runs (
  id uuid primary key default gen_random_uuid(),
  run_key text not null unique,
  status text not null default 'draft' check (status in ('draft', 'validated', 'approved', 'posted', 'rolled_back', 'cancelled')),
  source_note text,
  critical_count int not null default 0,
  warning_count int not null default 0,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);

create table if not exists public.master_data_cutover_findings (
  id uuid primary key default gen_random_uuid(),
  run_id uuid references public.master_data_cutover_runs(id) on delete cascade,
  resource text not null,
  severity text not null check (severity in ('warning', 'critical')),
  field_name text,
  message text not null,
  action text,
  created_at timestamptz not null default now()
);

create index if not exists idx_stores_branch on public.stores(branch_id);
-- master-data status compatibility repair:
-- Earlier migrations may have created master-data tables without status columns.
alter table if exists public.suppliers add column if not exists status text not null default 'active';
alter table if exists public.chart_accounts add column if not exists status text not null default 'active';
alter table if exists public.items add column if not exists status text not null default 'active';
alter table if exists public.stores add column if not exists status text not null default 'active';
alter table if exists public.branches add column if not exists status text not null default 'active';
alter table if exists public.cost_centers add column if not exists status text not null default 'active';
create index if not exists idx_suppliers_status on public.suppliers(status);
-- item category compatibility repair:
-- Earlier migrations may have created public.items without category_id.
alter table if exists public.items add column if not exists category_id text;
alter table if exists public.items add column if not exists item_category_id text;
alter table if exists public.items add column if not exists category text;
alter table if exists public.items add column if not exists status text not null default 'active';
create index if not exists idx_items_category on public.items(category_id);
create index if not exists idx_items_status on public.items(status);
create index if not exists idx_chart_accounts_type on public.chart_accounts(account_type, status);
create index if not exists idx_master_data_cutover_findings_run on public.master_data_cutover_findings(run_id, severity);

alter table public.stores enable row level security;
alter table public.suppliers enable row level security;
alter table public.item_categories enable row level security;
alter table public.items enable row level security;
alter table public.chart_accounts enable row level security;
alter table public.master_data_cutover_runs enable row level security;
alter table public.master_data_cutover_findings enable row level security;

create or replace function public.master_data_validate_cutover_run(run_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_critical int := 0;
  v_warning int := 0;
begin
  if not coalesce(public.app_current_user_has_permission('setup.manage'), false) then
    raise exception 'permission denied: setup.manage' using errcode = '42501';
  end if;

  select
    count(*) filter (where severity = 'critical'),
    count(*) filter (where severity = 'warning')
  into v_critical, v_warning
  from public.master_data_cutover_findings
  where master_data_cutover_findings.run_id = master_data_validate_cutover_run.run_id;

  update public.master_data_cutover_runs
  set critical_count = coalesce(v_critical, 0),
      warning_count = coalesce(v_warning, 0),
      status = case when coalesce(v_critical, 0) = 0 then 'validated' else 'draft' end
  where id = run_id;

  return jsonb_build_object(
    'ok', coalesce(v_critical, 0) = 0,
    'critical_count', coalesce(v_critical, 0),
    'warning_count', coalesce(v_warning, 0),
    'message', case when coalesce(v_critical, 0) = 0 then 'Master data cutover validated.' else 'Master data cutover blocked by critical findings.' end
  );
end;
$$;
do $$
begin
  if to_regprocedure('public.master_data_validate_cutover_run(uuid)') is not null then
    execute 'grant execute on function public.master_data_validate_cutover_run(uuid) to authenticated';
  end if;
end;
$$;
