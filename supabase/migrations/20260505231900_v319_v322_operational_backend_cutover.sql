-- v319-v322 Operational Backend Cutover
-- Combines purchasing/AP, sales/POS, production/recipe, and operational posting bridge foundations.
-- Additive only. Does not remove existing local/demo UI state.

create extension if not exists pgcrypto;

create table if not exists public.purchase_invoices (
  id uuid primary key default gen_random_uuid(),
  invoice_no text not null,
  supplier_id text not null references public.suppliers(id) on delete restrict,
  branch_id text not null references public.branches(id) on delete restrict,
  store_id text references public.stores(id) on delete set null,
  invoice_date date not null,
  due_date date,
  subtotal_amount numeric not null default 0,
  tax_amount numeric not null default 0,
  discount_amount numeric not null default 0,
  total_amount numeric not null default 0 check (total_amount >= 0),
  status text not null default 'draft' check (status in ('draft','pending_approval','approved','posted','cancelled','reversed')),
  posting_batch_id uuid references public.posting_batches(id) on delete set null,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  unique (supplier_id, invoice_no)
);

create table if not exists public.purchase_invoice_lines (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid not null references public.purchase_invoices(id) on delete cascade,
  item_id text not null references public.items(id) on delete restrict,
  quantity numeric not null check (quantity > 0),
  unit_cost numeric not null default 0 check (unit_cost >= 0),
  discount_amount numeric not null default 0,
  tax_amount numeric not null default 0,
  total_amount numeric generated always as ((quantity * unit_cost) - discount_amount + tax_amount) stored
);

create table if not exists public.supplier_payments (
  id uuid primary key default gen_random_uuid(),
  payment_no text not null unique,
  supplier_id text not null references public.suppliers(id) on delete restrict,
  branch_id text not null references public.branches(id) on delete restrict,
  payment_date date not null,
  amount numeric not null check (amount > 0),
  method text not null check (method in ('cash','bank','card','transfer')),
  account_code text not null,
  status text not null default 'draft' check (status in ('draft','pending_approval','approved','posted','cancelled','reversed')),
  posting_batch_id uuid references public.posting_batches(id) on delete set null,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);

create table if not exists public.sales_pos_batches (
  id uuid primary key default gen_random_uuid(),
  batch_no text not null unique,
  branch_id text not null references public.branches(id) on delete restrict,
  business_date date not null,
  source_system text not null default 'manual' check (source_system in ('manual','foodics','other_pos')),
  total_sales numeric not null default 0,
  total_tax numeric not null default 0,
  total_discount numeric not null default 0,
  total_refunds numeric not null default 0,
  total_payments numeric not null default 0,
  status text not null default 'draft' check (status in ('draft','validated','approved','posted','reconciled','cancelled','reversed')),
  posting_batch_id uuid references public.posting_batches(id) on delete set null,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  unique (branch_id, business_date, source_system, batch_no)
);

create table if not exists public.sales_pos_payments (
  id uuid primary key default gen_random_uuid(),
  batch_id uuid not null references public.sales_pos_batches(id) on delete cascade,
  payment_method text not null,
  amount numeric not null default 0 check (amount >= 0)
);

create table if not exists public.production_recipes_backend (
  id uuid primary key default gen_random_uuid(),
  recipe_code text not null unique,
  name_en text not null,
  name_ar text not null,
  output_item_id text not null references public.items(id) on delete restrict,
  base_output_quantity numeric not null check (base_output_quantity > 0),
  status text not null default 'active' check (status in ('active','inactive','archived')),
  created_at timestamptz not null default now()
);

create table if not exists public.production_recipe_lines_backend (
  id uuid primary key default gen_random_uuid(),
  recipe_id uuid not null references public.production_recipes_backend(id) on delete cascade,
  ingredient_item_id text not null references public.items(id) on delete restrict,
  quantity numeric not null check (quantity > 0),
  wastage_percent numeric not null default 0 check (wastage_percent >= 0)
);

create table if not exists public.production_batches (
  id uuid primary key default gen_random_uuid(),
  batch_no text not null unique,
  branch_id text not null references public.branches(id) on delete restrict,
  source_store_id text not null references public.stores(id) on delete restrict,
  destination_store_id text not null references public.stores(id) on delete restrict,
  recipe_id uuid references public.production_recipes_backend(id) on delete set null,
  output_item_id text not null references public.items(id) on delete restrict,
  planned_output_quantity numeric not null default 0,
  actual_output_quantity numeric not null check (actual_output_quantity > 0),
  status text not null default 'draft' check (status in ('draft','validated','approved','posted','cancelled','reversed')),
  posting_batch_id uuid references public.posting_batches(id) on delete set null,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);

create table if not exists public.operational_posting_bridge_events (
  id uuid primary key default gen_random_uuid(),
  source_type text not null,
  source_id text not null,
  branch_id text references public.branches(id) on delete set null,
  required_rpc text not null,
  status text not null default 'planned',
  message text,
  posting_batch_id uuid references public.posting_batches(id) on delete set null,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);

create index if not exists idx_purchase_invoices_supplier_status on public.purchase_invoices(supplier_id, status);
create index if not exists idx_supplier_payments_supplier_status on public.supplier_payments(supplier_id, status);
create index if not exists idx_sales_pos_batches_branch_date on public.sales_pos_batches(branch_id, business_date);
create index if not exists idx_production_batches_branch_status on public.production_batches(branch_id, status);
create index if not exists idx_operational_posting_bridge_source on public.operational_posting_bridge_events(source_type, source_id);

alter table public.purchase_invoices enable row level security;
alter table public.purchase_invoice_lines enable row level security;
alter table public.supplier_payments enable row level security;
alter table public.sales_pos_batches enable row level security;
alter table public.sales_pos_payments enable row level security;
alter table public.production_recipes_backend enable row level security;
alter table public.production_recipe_lines_backend enable row level security;
alter table public.production_batches enable row level security;
alter table public.operational_posting_bridge_events enable row level security;

create or replace function public.purchasing_post_purchase_invoice(invoice_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  if not coalesce(public.app_current_user_has_permission('purchasing.approve'), false) then
    raise exception 'permission denied: purchasing.approve' using errcode = '42501';
  end if;

  update public.purchase_invoices
  set status = 'posted'
  where id = invoice_id and status in ('approved','validated','draft');

  return jsonb_build_object('ok', true, 'message', 'Purchase invoice marked as posted foundation.', 'id', invoice_id);
end;
$$;

create or replace function public.purchasing_post_supplier_payment(payment_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  if not coalesce(public.app_current_user_has_permission('finance.post'), false) then
    raise exception 'permission denied: finance.post' using errcode = '42501';
  end if;

  update public.supplier_payments
  set status = 'posted'
  where id = payment_id and status in ('approved','validated','draft');

  return jsonb_build_object('ok', true, 'message', 'Supplier payment marked as posted foundation.', 'id', payment_id);
end;
$$;

create or replace function public.sales_post_pos_batch(batch_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  if not coalesce(public.app_current_user_has_permission('finance.post'), false) then
    raise exception 'permission denied: finance.post' using errcode = '42501';
  end if;

  update public.sales_pos_batches
  set status = 'posted'
  where id = batch_id and status in ('approved','validated','draft');

  return jsonb_build_object('ok', true, 'message', 'Sales POS batch marked as posted foundation.', 'id', batch_id);
end;
$$;

create or replace function public.sales_reconcile_pos_batch(batch_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  if not coalesce(public.app_current_user_has_permission('finance.post'), false) then
    raise exception 'permission denied: finance.post' using errcode = '42501';
  end if;

  update public.sales_pos_batches
  set status = 'reconciled'
  where id = batch_id and status = 'posted';

  return jsonb_build_object('ok', true, 'message', 'Sales POS batch reconciled foundation.', 'id', batch_id);
end;
$$;

create or replace function public.production_post_batch(batch_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  if not coalesce(public.app_current_user_has_permission('inventory.adjust'), false) then
    raise exception 'permission denied: inventory.adjust' using errcode = '42501';
  end if;

  update public.production_batches
  set status = 'posted'
  where id = batch_id and status in ('approved','validated','draft');

  return jsonb_build_object('ok', true, 'message', 'Production batch marked as posted foundation.', 'id', batch_id);
end;
$$;
do $$
begin
  if to_regprocedure('public.purchasing_post_purchase_invoice(uuid)') is not null then
    execute 'grant execute on function public.purchasing_post_purchase_invoice(uuid) to authenticated';
  end if;
end;
$$;
do $$
begin
  if to_regprocedure('public.purchasing_post_supplier_payment(uuid)') is not null then
    execute 'grant execute on function public.purchasing_post_supplier_payment(uuid) to authenticated';
  end if;
end;
$$;
do $$
begin
  if to_regprocedure('public.sales_post_pos_batch(uuid)') is not null then
    execute 'grant execute on function public.sales_post_pos_batch(uuid) to authenticated';
  end if;
end;
$$;
do $$
begin
  if to_regprocedure('public.sales_reconcile_pos_batch(uuid)') is not null then
    execute 'grant execute on function public.sales_reconcile_pos_batch(uuid) to authenticated';
  end if;
end;
$$;
do $$
begin
  if to_regprocedure('public.production_post_batch(uuid)') is not null then
    execute 'grant execute on function public.production_post_batch(uuid) to authenticated';
  end if;
end;
$$;
