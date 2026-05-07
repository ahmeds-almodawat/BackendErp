-- v65 Mega Ultra Enterprise Suite backend design notes
-- These are design notes for the future Supabase implementation.

create table if not exists enterprise_close_runs (
  id uuid primary key default gen_random_uuid(),
  period_code text not null,
  start_date date not null,
  end_date date not null,
  readiness_score numeric not null default 0,
  status text not null default 'draft',
  created_by uuid,
  created_at timestamptz default now(),
  locked_by uuid,
  locked_at timestamptz
);

create table if not exists enterprise_close_checks (
  id uuid primary key default gen_random_uuid(),
  close_run_id uuid references enterprise_close_runs(id) on delete cascade,
  check_key text not null,
  check_label text not null,
  severity text not null default 'medium',
  status text not null default 'missing',
  source_module text,
  source_ref text,
  created_at timestamptz default now()
);

create table if not exists food_cost_variance_reports (
  id uuid primary key default gen_random_uuid(),
  close_run_id uuid references enterprise_close_runs(id) on delete cascade,
  item_id uuid,
  theoretical_qty numeric default 0,
  actual_qty numeric default 0,
  variance_qty numeric default 0,
  theoretical_value numeric default 0,
  variance_value numeric default 0,
  created_at timestamptz default now()
);

create table if not exists procurement_variance_reports (
  id uuid primary key default gen_random_uuid(),
  close_run_id uuid references enterprise_close_runs(id) on delete cascade,
  purchase_order_id uuid,
  supplier_id uuid,
  item_id uuid,
  po_qty numeric default 0,
  grn_qty numeric default 0,
  invoice_qty numeric default 0,
  po_unit_cost numeric default 0,
  invoice_unit_cost numeric default 0,
  qty_variance numeric default 0,
  price_variance numeric default 0,
  created_at timestamptz default now()
);
