-- V18 Core ERP Stabilization backend design notes
-- These tables are Supabase-ready design scaffolds for the local-first MVP.

create table if not exists public.material_requests (
  id uuid primary key default gen_random_uuid(),
  ref text unique not null,
  date date not null,
  branch_id uuid,
  store_id uuid,
  requested_by text,
  needed_by date,
  status text not null default 'draft',
  note text,
  created_at timestamptz default now()
);

create table if not exists public.material_request_lines (
  id uuid primary key default gen_random_uuid(),
  request_id uuid references public.material_requests(id) on delete cascade,
  item_id uuid,
  qty numeric not null,
  note text
);

create table if not exists public.purchase_orders (
  id uuid primary key default gen_random_uuid(),
  ref text unique not null,
  date date not null,
  supplier_id uuid,
  branch_id uuid,
  store_id uuid,
  request_ref text,
  eta date,
  status text not null default 'draft',
  note text,
  created_at timestamptz default now()
);

create table if not exists public.purchase_order_lines (
  id uuid primary key default gen_random_uuid(),
  purchase_order_id uuid references public.purchase_orders(id) on delete cascade,
  item_id uuid,
  qty numeric not null,
  unit_cost numeric not null default 0,
  vat_rate numeric not null default 15,
  received_qty numeric not null default 0,
  invoiced_qty numeric not null default 0
);

create table if not exists public.goods_receipts (
  id uuid primary key default gen_random_uuid(),
  ref text unique not null,
  date date not null,
  po_id uuid references public.purchase_orders(id),
  supplier_id uuid,
  store_id uuid,
  status text not null default 'draft',
  created_at timestamptz default now()
);

create table if not exists public.goods_receipt_lines (
  id uuid primary key default gen_random_uuid(),
  goods_receipt_id uuid references public.goods_receipts(id) on delete cascade,
  item_id uuid,
  qty numeric not null,
  unit_cost numeric not null,
  lot_no text,
  batch_no text,
  bin_code text,
  expiry_date date
);

create table if not exists public.supplier_payments (
  id uuid primary key default gen_random_uuid(),
  ref text unique not null,
  date date not null,
  supplier_id uuid,
  amount numeric not null,
  method text not null,
  account_code text not null,
  status text not null default 'draft',
  note text,
  created_at timestamptz default now()
);
