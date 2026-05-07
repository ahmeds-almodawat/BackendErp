-- v340-v344 Inventory + Purchasing Live Posting Gate
-- Additive only. Does not rewrite AppShell or apply migrations automatically.

create extension if not exists pgcrypto;

create table if not exists public.live_opening_stock_batches (
  id uuid primary key default gen_random_uuid(),
  batch_no text not null unique,
  branch_id text references public.branches(id) on delete set null,
  store_id text references public.stores(id) on delete set null,
  fiscal_period_id uuid references public.fiscal_periods(id) on delete set null,
  opening_date date not null,
  status text not null default 'draft' check (status in ('draft','validated','approved','posted','blocked','cancelled','reversed')),
  total_quantity numeric not null default 0,
  total_value numeric not null default 0,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  posted_at timestamptz
);

create table if not exists public.live_opening_stock_lines (
  id uuid primary key default gen_random_uuid(),
  batch_id uuid not null references public.live_opening_stock_batches(id) on delete cascade,
  item_id text references public.items(id) on delete restrict,
  sku text,
  store_id text references public.stores(id) on delete set null,
  quantity numeric not null check (quantity >= 0),
  unit_cost numeric not null default 0 check (unit_cost >= 0),
  lot_no text,
  expiry_date date,
  memo text
);

create table if not exists public.live_purchase_receipts (
  id uuid primary key default gen_random_uuid(),
  receipt_no text not null unique,
  supplier_id text references public.suppliers(id) on delete set null,
  branch_id text references public.branches(id) on delete set null,
  store_id text references public.stores(id) on delete set null,
  receipt_date date not null,
  purchase_invoice_id uuid references public.purchase_invoices(id) on delete set null,
  status text not null default 'draft' check (status in ('draft','validated','approved','posted','blocked','cancelled','reversed')),
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  posted_at timestamptz
);

create table if not exists public.live_purchase_receipt_lines (
  id uuid primary key default gen_random_uuid(),
  receipt_id uuid not null references public.live_purchase_receipts(id) on delete cascade,
  item_id text references public.items(id) on delete restrict,
  sku text,
  quantity numeric not null check (quantity > 0),
  unit_cost numeric not null default 0 check (unit_cost >= 0),
  lot_no text,
  expiry_date date
);

create table if not exists public.live_stock_count_runs (
  id uuid primary key default gen_random_uuid(),
  count_no text not null unique,
  branch_id text references public.branches(id) on delete set null,
  store_id text references public.stores(id) on delete set null,
  count_date date not null,
  status text not null default 'draft' check (status in ('draft','validated','approved','posted','blocked','cancelled','reversed')),
  total_variance_quantity numeric not null default 0,
  total_variance_value numeric not null default 0,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  posted_at timestamptz
);

create table if not exists public.live_stock_count_lines (
  id uuid primary key default gen_random_uuid(),
  count_id uuid not null references public.live_stock_count_runs(id) on delete cascade,
  item_id text references public.items(id) on delete restrict,
  sku text,
  system_quantity numeric not null default 0,
  counted_quantity numeric not null default 0,
  unit_cost numeric not null default 0,
  reason text
);

create table if not exists public.live_purchase_invoice_posting_runs (
  id uuid primary key default gen_random_uuid(),
  invoice_no text not null,
  supplier_id text references public.suppliers(id) on delete set null,
  branch_id text references public.branches(id) on delete set null,
  store_id text references public.stores(id) on delete set null,
  invoice_date date not null,
  due_date date,
  subtotal numeric not null default 0,
  discount_amount numeric not null default 0,
  tax_amount numeric not null default 0,
  total_amount numeric not null default 0,
  purchase_invoice_id uuid references public.purchase_invoices(id) on delete set null,
  journal_id uuid references public.finance_journal_entries_backend(id) on delete set null,
  status text not null default 'draft' check (status in ('draft','validated','approved','posted','blocked','cancelled','reversed')),
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  posted_at timestamptz
);

create table if not exists public.live_supplier_payment_posting_runs (
  id uuid primary key default gen_random_uuid(),
  payment_no text not null unique,
  supplier_id text references public.suppliers(id) on delete set null,
  branch_id text references public.branches(id) on delete set null,
  payment_date date not null,
  amount numeric not null check (amount > 0),
  method text not null,
  account_code text not null,
  supplier_payment_id uuid references public.supplier_payments(id) on delete set null,
  journal_id uuid references public.finance_journal_entries_backend(id) on delete set null,
  status text not null default 'draft' check (status in ('draft','validated','approved','posted','blocked','cancelled','reversed')),
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  posted_at timestamptz
);

create index if not exists idx_live_opening_stock_batches_status on public.live_opening_stock_batches(status, opening_date);
create index if not exists idx_live_purchase_receipts_status on public.live_purchase_receipts(status, receipt_date);
create index if not exists idx_live_stock_count_runs_status on public.live_stock_count_runs(status, count_date);
create index if not exists idx_live_purchase_invoice_posting_runs_status on public.live_purchase_invoice_posting_runs(status, invoice_date);
create index if not exists idx_live_supplier_payment_posting_runs_status on public.live_supplier_payment_posting_runs(status, payment_date);

alter table public.live_opening_stock_batches enable row level security;
alter table public.live_opening_stock_lines enable row level security;
alter table public.live_purchase_receipts enable row level security;
alter table public.live_purchase_receipt_lines enable row level security;
alter table public.live_stock_count_runs enable row level security;
alter table public.live_stock_count_lines enable row level security;
alter table public.live_purchase_invoice_posting_runs enable row level security;
alter table public.live_supplier_payment_posting_runs enable row level security;

create or replace function public.live_inventory_post_opening_stock(batch_payload jsonb, lines_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_batch_id uuid;
  v_total_quantity numeric := 0;
  v_total_value numeric := 0;
begin
  select
    coalesce(sum((line_item->>'quantity')::numeric), 0),
    coalesce(sum((line_item->>'quantity')::numeric * (line_item->>'unit_cost')::numeric), 0)
  into v_total_quantity, v_total_value
  from jsonb_array_elements(lines_payload) as line_item;

  insert into public.live_opening_stock_batches (
    batch_no,
    branch_id,
    store_id,
    fiscal_period_id,
    opening_date,
    status,
    total_quantity,
    total_value,
    created_by,
    posted_at
  )
  values (
    batch_payload->>'batch_no',
    nullif(batch_payload->>'branch_id',''),
    nullif(batch_payload->>'store_id',''),
    nullif(batch_payload->>'fiscal_period_id','')::uuid,
    (batch_payload->>'opening_date')::date,
    'posted',
    v_total_quantity,
    v_total_value,
    auth.uid(),
    now()
  )
  returning id into v_batch_id;

  insert into public.live_opening_stock_lines (
    batch_id,
    item_id,
    sku,
    store_id,
    quantity,
    unit_cost,
    lot_no,
    expiry_date,
    memo
  )
  select
    v_batch_id,
    nullif(line_item->>'item_id',''),
    line_item->>'sku',
    nullif(line_item->>'store_id',''),
    (line_item->>'quantity')::numeric,
    (line_item->>'unit_cost')::numeric,
    line_item->>'lot_no',
    nullif(line_item->>'expiry_date','')::date,
    line_item->>'memo'
  from jsonb_array_elements(lines_payload) as line_item;

  return jsonb_build_object('ok', true, 'message', 'Opening stock posted foundation.', 'id', v_batch_id);
end;
$$;

create or replace function public.live_inventory_post_purchase_receipt(receipt_payload jsonb, lines_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_receipt_id uuid;
begin
  insert into public.live_purchase_receipts (
    receipt_no,
    supplier_id,
    branch_id,
    store_id,
    receipt_date,
    purchase_invoice_id,
    status,
    created_by,
    posted_at
  )
  values (
    receipt_payload->>'receipt_no',
    nullif(receipt_payload->>'supplier_id',''),
    nullif(receipt_payload->>'branch_id',''),
    nullif(receipt_payload->>'store_id',''),
    (receipt_payload->>'receipt_date')::date,
    nullif(receipt_payload->>'purchase_invoice_id','')::uuid,
    'posted',
    auth.uid(),
    now()
  )
  returning id into v_receipt_id;

  insert into public.live_purchase_receipt_lines (
    receipt_id,
    item_id,
    sku,
    quantity,
    unit_cost,
    lot_no,
    expiry_date
  )
  select
    v_receipt_id,
    nullif(line_item->>'item_id',''),
    line_item->>'sku',
    (line_item->>'quantity')::numeric,
    (line_item->>'unit_cost')::numeric,
    line_item->>'lot_no',
    nullif(line_item->>'expiry_date','')::date
  from jsonb_array_elements(lines_payload) as line_item;

  return jsonb_build_object('ok', true, 'message', 'Purchase receipt posted foundation.', 'id', v_receipt_id);
end;
$$;

create or replace function public.live_inventory_post_stock_count(count_payload jsonb, lines_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count_id uuid;
  v_total_variance_quantity numeric := 0;
  v_total_variance_value numeric := 0;
begin
  select
    coalesce(sum((line_item->>'counted_quantity')::numeric - (line_item->>'system_quantity')::numeric), 0),
    coalesce(sum(((line_item->>'counted_quantity')::numeric - (line_item->>'system_quantity')::numeric) * (line_item->>'unit_cost')::numeric), 0)
  into v_total_variance_quantity, v_total_variance_value
  from jsonb_array_elements(lines_payload) as line_item;

  insert into public.live_stock_count_runs (
    count_no,
    branch_id,
    store_id,
    count_date,
    status,
    total_variance_quantity,
    total_variance_value,
    created_by,
    posted_at
  )
  values (
    count_payload->>'count_no',
    nullif(count_payload->>'branch_id',''),
    nullif(count_payload->>'store_id',''),
    (count_payload->>'count_date')::date,
    'posted',
    v_total_variance_quantity,
    v_total_variance_value,
    auth.uid(),
    now()
  )
  returning id into v_count_id;

  insert into public.live_stock_count_lines (
    count_id,
    item_id,
    sku,
    system_quantity,
    counted_quantity,
    unit_cost,
    reason
  )
  select
    v_count_id,
    nullif(line_item->>'item_id',''),
    line_item->>'sku',
    (line_item->>'system_quantity')::numeric,
    (line_item->>'counted_quantity')::numeric,
    (line_item->>'unit_cost')::numeric,
    line_item->>'reason'
  from jsonb_array_elements(lines_payload) as line_item;

  return jsonb_build_object('ok', true, 'message', 'Stock count posted foundation.', 'id', v_count_id);
end;
$$;

create or replace function public.live_purchasing_post_purchase_invoice(invoice_payload jsonb, lines_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_run_id uuid;
  v_subtotal numeric := 0;
  v_discount numeric := 0;
  v_tax numeric := 0;
begin
  select
    coalesce(sum((line_item->>'quantity')::numeric * (line_item->>'unit_cost')::numeric), 0),
    coalesce(sum((line_item->>'discount_amount')::numeric), 0),
    coalesce(sum((line_item->>'tax_amount')::numeric), 0)
  into v_subtotal, v_discount, v_tax
  from jsonb_array_elements(lines_payload) as line_item;

  insert into public.live_purchase_invoice_posting_runs (
    invoice_no,
    supplier_id,
    branch_id,
    store_id,
    invoice_date,
    due_date,
    subtotal,
    discount_amount,
    tax_amount,
    total_amount,
    status,
    created_by,
    posted_at
  )
  values (
    invoice_payload->>'invoice_no',
    nullif(invoice_payload->>'supplier_id',''),
    nullif(invoice_payload->>'branch_id',''),
    nullif(invoice_payload->>'store_id',''),
    (invoice_payload->>'invoice_date')::date,
    nullif(invoice_payload->>'due_date','')::date,
    v_subtotal,
    v_discount,
    v_tax,
    v_subtotal - v_discount + v_tax,
    'posted',
    auth.uid(),
    now()
  )
  returning id into v_run_id;

  return jsonb_build_object('ok', true, 'message', 'Purchase invoice live posting foundation completed.', 'id', v_run_id);
end;
$$;

create or replace function public.live_purchasing_post_supplier_payment(payment_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_run_id uuid;
begin
  insert into public.live_supplier_payment_posting_runs (
    payment_no,
    supplier_id,
    branch_id,
    payment_date,
    amount,
    method,
    account_code,
    status,
    created_by,
    posted_at
  )
  values (
    payment_payload->>'payment_no',
    nullif(payment_payload->>'supplier_id',''),
    nullif(payment_payload->>'branch_id',''),
    (payment_payload->>'payment_date')::date,
    (payment_payload->>'amount')::numeric,
    payment_payload->>'method',
    payment_payload->>'account_code',
    'posted',
    auth.uid(),
    now()
  )
  returning id into v_run_id;

  return jsonb_build_object('ok', true, 'message', 'Supplier payment live posting foundation completed.', 'id', v_run_id);
end;
$$;
do $$
begin
  if to_regprocedure('public.live_inventory_post_opening_stock(jsonb, jsonb)') is not null then
    execute 'grant execute on function public.live_inventory_post_opening_stock(jsonb, jsonb) to authenticated';
  end if;
end;
$$;
do $$
begin
  if to_regprocedure('public.live_inventory_post_purchase_receipt(jsonb, jsonb)') is not null then
    execute 'grant execute on function public.live_inventory_post_purchase_receipt(jsonb, jsonb) to authenticated';
  end if;
end;
$$;
do $$
begin
  if to_regprocedure('public.live_inventory_post_stock_count(jsonb, jsonb)') is not null then
    execute 'grant execute on function public.live_inventory_post_stock_count(jsonb, jsonb) to authenticated';
  end if;
end;
$$;
do $$
begin
  if to_regprocedure('public.live_purchasing_post_purchase_invoice(jsonb, jsonb)') is not null then
    execute 'grant execute on function public.live_purchasing_post_purchase_invoice(jsonb, jsonb) to authenticated';
  end if;
end;
$$;
do $$
begin
  if to_regprocedure('public.live_purchasing_post_supplier_payment(jsonb)') is not null then
    execute 'grant execute on function public.live_purchasing_post_supplier_payment(jsonb) to authenticated';
  end if;
end;
$$;
