-- V17 Live Inventory Controls Supabase design notes
create table if not exists bin_locations (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null,
  code text not null,
  zone text,
  type text,
  active boolean default true,
  unique(store_id, code)
);

create table if not exists inventory_lots (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null,
  item_id uuid not null,
  lot_no text not null,
  batch_no text,
  bin_code text,
  received_date date,
  expiry_date date,
  qty numeric not null default 0,
  unit_cost numeric not null default 0,
  status text not null default 'available',
  source_ref text,
  supplier_id uuid,
  note text
);

create table if not exists inventory_approvals (
  id uuid primary key default gen_random_uuid(),
  ref text unique not null,
  date date not null,
  request_type text not null,
  status text not null default 'pending',
  store_id uuid not null,
  item_id uuid not null,
  direction text not null,
  qty numeric not null,
  unit_cost numeric not null default 0,
  cost_center_id uuid,
  reason text,
  note text,
  requested_by uuid,
  approved_by uuid,
  posted_ref text
);

create table if not exists supplier_returns (
  id uuid primary key default gen_random_uuid(),
  ref text unique not null,
  date date not null,
  supplier_id uuid not null,
  store_id uuid not null,
  item_id uuid not null,
  qty numeric not null,
  unit_cost numeric not null,
  reason text,
  credit_type text not null default 'ap_credit',
  status text not null default 'posted'
);
