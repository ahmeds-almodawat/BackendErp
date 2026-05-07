-- V29 Foodics sales import engine design
-- Backend-ready structure for Supabase/PostgreSQL.

create table if not exists public.pos_import_batches (
  id uuid primary key default gen_random_uuid(),
  source text not null default 'foodics',
  batch_ref text not null unique,
  business_date_from date,
  business_date_to date,
  status text not null default 'uploaded',
  uploaded_by uuid,
  validated_at timestamptz,
  posted_at timestamptz,
  reversed_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.pos_import_files (
  id uuid primary key default gen_random_uuid(),
  batch_id uuid references public.pos_import_batches(id) on delete cascade,
  file_name text not null,
  detected_type text not null,
  row_count integer not null default 0,
  headers jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.pos_branch_mappings (
  id uuid primary key default gen_random_uuid(),
  source text not null default 'foodics',
  external_branch_reference text not null,
  external_branch_name text,
  branch_id uuid,
  active boolean not null default true,
  unique(source, external_branch_reference)
);

create table if not exists public.pos_item_mappings (
  id uuid primary key default gen_random_uuid(),
  source text not null default 'foodics',
  external_sku text not null,
  external_name text,
  menu_item_id uuid,
  active boolean not null default true,
  unique(source, external_sku)
);

create table if not exists public.pos_payment_method_mappings (
  id uuid primary key default gen_random_uuid(),
  source text not null default 'foodics',
  external_payment_method text not null,
  debit_account_code text not null,
  active boolean not null default true,
  unique(source, external_payment_method)
);

create table if not exists public.pos_import_validation_errors (
  id uuid primary key default gen_random_uuid(),
  batch_id uuid references public.pos_import_batches(id) on delete cascade,
  severity text not null,
  code text not null,
  message text not null,
  row_reference text,
  created_at timestamptz not null default now()
);

create table if not exists public.pos_orders_staging (
  id uuid primary key default gen_random_uuid(),
  batch_id uuid references public.pos_import_batches(id) on delete cascade,
  order_reference text not null,
  order_number text,
  branch_reference text,
  status text,
  business_date date,
  subtotal numeric(14,2),
  total_price numeric(14,2),
  total_taxes numeric(14,2),
  raw jsonb not null,
  unique(batch_id, order_reference)
);

create table if not exists public.pos_order_lines_staging (
  id uuid primary key default gen_random_uuid(),
  batch_id uuid references public.pos_import_batches(id) on delete cascade,
  order_reference text,
  sku text,
  name text,
  name_localized text,
  quantity numeric(14,3),
  tax_exclusive_total_price numeric(14,2),
  total_taxes numeric(14,2),
  total_price numeric(14,2),
  status text,
  raw jsonb not null
);

create table if not exists public.pos_payments_staging (
  id uuid primary key default gen_random_uuid(),
  batch_id uuid references public.pos_import_batches(id) on delete cascade,
  order_reference text,
  payment_method_name text,
  branch_reference text,
  amount numeric(14,2),
  paid_at timestamptz,
  employee_name text,
  raw jsonb not null
);
