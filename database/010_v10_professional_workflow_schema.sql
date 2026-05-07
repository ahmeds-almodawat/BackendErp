-- V10 local-to-Supabase schema expansion notes
-- Adds editable master data, supplier banking/representative fields, multi-line purchase invoices,
-- fixed assets, AR, and finance submodules.

alter table if exists suppliers
  add column if not exists bank_name text,
  add column if not exists bank_account text,
  add column if not exists representative_name text,
  add column if not exists representative_phone text,
  add column if not exists contact_name text,
  add column if not exists phone text,
  add column if not exists email text;

create table if not exists purchase_invoices (
  id uuid primary key default gen_random_uuid(),
  ref text unique not null,
  invoice_no text,
  supplier_id uuid not null,
  branch_id uuid,
  store_id uuid not null,
  invoice_date date not null,
  delivery_date date,
  payment_type text not null check (payment_type in ('credit','cash','bank','partial')),
  paid_amount numeric(14,2) default 0,
  status text not null check (status in ('draft','posted','cancelled')) default 'draft',
  created_at timestamptz default now()
);

create table if not exists purchase_invoice_lines (
  id uuid primary key default gen_random_uuid(),
  purchase_invoice_id uuid not null references purchase_invoices(id) on delete cascade,
  item_id uuid not null,
  qty numeric(14,4) not null,
  unit_cost numeric(14,4) not null,
  vat_rate numeric(5,2) default 15,
  discount numeric(14,2) default 0
);

create table if not exists fixed_assets (
  id uuid primary key default gen_random_uuid(),
  code text unique not null,
  name text not null,
  category text,
  branch_id uuid,
  cost_center_id uuid,
  purchase_date date,
  cost numeric(14,2) not null,
  useful_life_months int not null,
  salvage_value numeric(14,2) default 0,
  accumulated_depreciation numeric(14,2) default 0,
  active boolean default true
);

create table if not exists ar_invoices (
  id uuid primary key default gen_random_uuid(),
  ref text unique not null,
  customer text not null,
  invoice_date date not null,
  branch_id uuid,
  amount numeric(14,2) not null,
  vat_rate numeric(5,2) default 15,
  paid_amount numeric(14,2) default 0,
  status text default 'open'
);
