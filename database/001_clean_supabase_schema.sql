-- Restaurant ERP Clean Schema Draft v9
-- Backend-ready relational structure for Supabase/PostgreSQL.

create table if not exists branches (
  id uuid primary key default gen_random_uuid(),
  code text unique not null,
  name_en text not null,
  name_ar text not null,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists stores (
  id uuid primary key default gen_random_uuid(),
  code text unique not null,
  name_en text not null,
  name_ar text not null,
  branch_id uuid references branches(id),
  is_main boolean not null default false,
  store_type text not null default 'branch',
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists suppliers (
  id uuid primary key default gen_random_uuid(),
  code text unique not null,
  name text not null,
  vat_no text,
  payment_terms text,
  created_at timestamptz not null default now()
);

create table if not exists items (
  id uuid primary key default gen_random_uuid(),
  sku text unique not null,
  name_en text not null,
  name_ar text not null,
  category text,
  unit text not null,
  standard_cost numeric(18,4) not null default 0,
  min_stock numeric(18,4) not null default 0,
  is_semi_finished boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists menu_items (
  id uuid primary key default gen_random_uuid(),
  code text unique not null,
  name_en text not null,
  name_ar text not null,
  selling_price numeric(18,4) not null default 0,
  vat_rate numeric(8,4) not null default 15,
  active boolean not null default true
);

create table if not exists recipe_lines (
  id uuid primary key default gen_random_uuid(),
  menu_item_id uuid references menu_items(id) on delete cascade,
  item_id uuid references items(id),
  qty numeric(18,6) not null,
  unit text not null,
  wastage_pct numeric(8,4) not null default 0
);

create table if not exists stock_movements (
  id uuid primary key default gen_random_uuid(),
  movement_date date not null,
  movement_type text not null,
  store_id uuid references stores(id),
  item_id uuid references items(id),
  direction text not null check (direction in ('in','out')),
  qty numeric(18,6) not null,
  unit_cost numeric(18,4) not null,
  reference_no text not null,
  note text,
  created_at timestamptz not null default now()
);

create table if not exists journal_entries (
  id uuid primary key default gen_random_uuid(),
  entry_date date not null,
  reference_no text not null,
  source_module text not null,
  created_at timestamptz not null default now()
);

create table if not exists journal_lines (
  id uuid primary key default gen_random_uuid(),
  journal_entry_id uuid references journal_entries(id) on delete cascade,
  account text not null,
  debit numeric(18,4) not null default 0,
  credit numeric(18,4) not null default 0,
  dimension text,
  memo text,
  check (debit >= 0 and credit >= 0)
);

create table if not exists purchases (
  id uuid primary key default gen_random_uuid(),
  purchase_date date not null,
  reference_no text not null unique,
  supplier_id uuid references suppliers(id),
  store_id uuid references stores(id),
  item_id uuid references items(id),
  qty numeric(18,6) not null,
  unit_cost numeric(18,4) not null,
  vat_rate numeric(8,4) not null default 15,
  payment_type text not null,
  paid_amount numeric(18,4) not null default 0,
  posted boolean not null default false
);

create table if not exists sales (
  id uuid primary key default gen_random_uuid(),
  sales_date date not null,
  reference_no text not null unique,
  branch_id uuid references branches(id),
  store_id uuid references stores(id),
  menu_item_id uuid references menu_items(id),
  qty numeric(18,6) not null,
  payment_method text not null,
  posted boolean not null default false
);

create table if not exists productions (
  id uuid primary key default gen_random_uuid(),
  production_date date not null,
  reference_no text not null unique,
  store_id uuid references stores(id),
  output_item_id uuid references items(id),
  output_qty numeric(18,6) not null,
  ingredient_item_id uuid references items(id),
  ingredient_qty numeric(18,6) not null,
  posted boolean not null default false
);

create table if not exists cost_centers (
  id uuid primary key default gen_random_uuid(),
  code text unique not null,
  name_en text not null,
  name_ar text not null,
  branch_id uuid references branches(id),
  budget numeric(18,4) not null default 0
);

create table if not exists employees (
  id uuid primary key default gen_random_uuid(),
  code text unique not null,
  name text not null,
  branch_id uuid references branches(id),
  department text,
  job_title text,
  salary numeric(18,4) not null default 0
);

create table if not exists roles (
  id uuid primary key default gen_random_uuid(),
  name_en text not null,
  name_ar text not null,
  description text
);

create table if not exists permissions (
  key text primary key,
  module_en text not null,
  module_ar text not null,
  label_en text not null,
  label_ar text not null
);

create table if not exists role_permissions (
  role_id uuid references roles(id) on delete cascade,
  permission_key text references permissions(key) on delete cascade,
  primary key (role_id, permission_key)
);

create table if not exists user_access_scopes (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid references employees(id) on delete cascade,
  role_id uuid references roles(id) on delete cascade,
  scope_type text not null check (scope_type in ('all','branch','store','cost_center')),
  scope_id uuid,
  created_at timestamptz not null default now()
);

create table if not exists audit_logs (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  action text not null,
  entity text not null,
  reference_no text,
  actor text,
  note text
);
