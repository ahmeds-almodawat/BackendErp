-- v345-v348 Sales/POS + Production Live Posting Gate
-- Additive only. Does not rewrite AppShell or apply migrations automatically.

create extension if not exists pgcrypto;

create table if not exists public.live_pos_import_batches (
  id uuid primary key default gen_random_uuid(),
  batch_no text not null unique,
  branch_id text references public.branches(id) on delete set null,
  business_date date not null,
  source_system text not null default 'foodics' check (source_system in ('foodics','manual','other_pos')),
  gross_sales numeric not null default 0,
  discount_amount numeric not null default 0,
  refund_amount numeric not null default 0,
  tax_amount numeric not null default 0,
  net_sales numeric not null default 0,
  payment_total numeric not null default 0,
  payment_difference numeric not null default 0,
  status text not null default 'draft' check (status in ('draft','validated','approved','posted','blocked','cancelled','reversed')),
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  posted_at timestamptz
);

create table if not exists public.live_pos_product_lines (
  id uuid primary key default gen_random_uuid(),
  batch_id uuid not null references public.live_pos_import_batches(id) on delete cascade,
  product_code text,
  sku text,
  product_name text,
  category_code text,
  quantity numeric not null default 0,
  gross_sales numeric not null default 0,
  discount_amount numeric not null default 0,
  refund_amount numeric not null default 0,
  tax_amount numeric not null default 0,
  net_sales numeric not null default 0
);

create table if not exists public.live_pos_payment_lines (
  id uuid primary key default gen_random_uuid(),
  batch_id uuid not null references public.live_pos_import_batches(id) on delete cascade,
  payment_method text not null,
  amount numeric not null default 0,
  reference text
);

create table if not exists public.live_sales_posting_runs (
  id uuid primary key default gen_random_uuid(),
  batch_id uuid references public.live_pos_import_batches(id) on delete set null,
  branch_id text references public.branches(id) on delete set null,
  business_date date not null,
  post_cogs boolean not null default false,
  status text not null default 'draft' check (status in ('draft','validated','approved','posted','blocked','cancelled','reversed')),
  journal_id uuid references public.finance_journal_entries_backend(id) on delete set null,
  memo text,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  posted_at timestamptz
);

create table if not exists public.live_recipes (
  id uuid primary key default gen_random_uuid(),
  recipe_code text not null unique,
  name_en text not null,
  name_ar text not null,
  output_sku text,
  output_item_id text references public.items(id) on delete set null,
  base_output_quantity numeric not null check (base_output_quantity > 0),
  status text not null default 'active' check (status in ('active','inactive','archived')),
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.live_recipe_lines (
  id uuid primary key default gen_random_uuid(),
  recipe_id uuid not null references public.live_recipes(id) on delete cascade,
  ingredient_sku text,
  ingredient_item_id text references public.items(id) on delete set null,
  quantity numeric not null check (quantity > 0),
  wastage_percent numeric not null default 0 check (wastage_percent >= 0)
);

create table if not exists public.live_production_batch_runs (
  id uuid primary key default gen_random_uuid(),
  batch_no text not null unique,
  branch_id text references public.branches(id) on delete set null,
  source_store_id text references public.stores(id) on delete set null,
  destination_store_id text references public.stores(id) on delete set null,
  recipe_code text,
  recipe_id uuid references public.live_recipes(id) on delete set null,
  output_sku text,
  output_item_id text references public.items(id) on delete set null,
  planned_output_quantity numeric not null default 0,
  actual_output_quantity numeric not null check (actual_output_quantity > 0),
  production_date date not null,
  planned_input_value numeric not null default 0,
  actual_input_value numeric not null default 0,
  output_variance numeric not null default 0,
  status text not null default 'draft' check (status in ('draft','validated','approved','posted','blocked','cancelled','reversed')),
  journal_id uuid references public.finance_journal_entries_backend(id) on delete set null,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  posted_at timestamptz
);

create table if not exists public.live_production_ingredient_lines (
  id uuid primary key default gen_random_uuid(),
  batch_id uuid not null references public.live_production_batch_runs(id) on delete cascade,
  ingredient_sku text,
  ingredient_item_id text references public.items(id) on delete set null,
  planned_quantity numeric not null default 0,
  actual_quantity numeric not null default 0,
  unit_cost numeric not null default 0
);

create index if not exists idx_live_pos_import_batches_date on public.live_pos_import_batches(branch_id, business_date, status);
create index if not exists idx_live_sales_posting_runs_date on public.live_sales_posting_runs(branch_id, business_date, status);
create index if not exists idx_live_recipes_code on public.live_recipes(recipe_code, status);
create index if not exists idx_live_production_batch_runs_date on public.live_production_batch_runs(branch_id, production_date, status);

alter table public.live_pos_import_batches enable row level security;
alter table public.live_pos_product_lines enable row level security;
alter table public.live_pos_payment_lines enable row level security;
alter table public.live_sales_posting_runs enable row level security;
alter table public.live_recipes enable row level security;
alter table public.live_recipe_lines enable row level security;
alter table public.live_production_batch_runs enable row level security;
alter table public.live_production_ingredient_lines enable row level security;

create or replace function public.live_sales_register_pos_import(
  batch_payload jsonb,
  product_lines_payload jsonb,
  payment_lines_payload jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_batch_id uuid;
  v_gross numeric := 0;
  v_discount numeric := 0;
  v_refund numeric := 0;
  v_tax numeric := 0;
  v_net numeric := 0;
  v_payment numeric := 0;
begin
  select
    coalesce(sum((line_item->>'gross_sales')::numeric), 0),
    coalesce(sum((line_item->>'discount_amount')::numeric), 0),
    coalesce(sum((line_item->>'refund_amount')::numeric), 0),
    coalesce(sum((line_item->>'tax_amount')::numeric), 0),
    coalesce(sum((line_item->>'net_sales')::numeric), 0)
  into v_gross, v_discount, v_refund, v_tax, v_net
  from jsonb_array_elements(product_lines_payload) as line_item;

  select coalesce(sum((payment_item->>'amount')::numeric), 0)
  into v_payment
  from jsonb_array_elements(payment_lines_payload) as payment_item;

  insert into public.live_pos_import_batches (
    batch_no,
    branch_id,
    business_date,
    source_system,
    gross_sales,
    discount_amount,
    refund_amount,
    tax_amount,
    net_sales,
    payment_total,
    payment_difference,
    status,
    created_by
  )
  values (
    batch_payload->>'batch_no',
    nullif(batch_payload->>'branch_id',''),
    (batch_payload->>'business_date')::date,
    coalesce(batch_payload->>'source_system','foodics'),
    v_gross,
    v_discount,
    v_refund,
    v_tax,
    v_net,
    v_payment,
    (v_net + v_tax) - v_payment,
    'validated',
    auth.uid()
  )
  returning id into v_batch_id;

  insert into public.live_pos_product_lines (
    batch_id,
    product_code,
    sku,
    product_name,
    category_code,
    quantity,
    gross_sales,
    discount_amount,
    refund_amount,
    tax_amount,
    net_sales
  )
  select
    v_batch_id,
    line_item->>'product_code',
    line_item->>'sku',
    line_item->>'product_name',
    line_item->>'category_code',
    (line_item->>'quantity')::numeric,
    (line_item->>'gross_sales')::numeric,
    (line_item->>'discount_amount')::numeric,
    (line_item->>'refund_amount')::numeric,
    (line_item->>'tax_amount')::numeric,
    (line_item->>'net_sales')::numeric
  from jsonb_array_elements(product_lines_payload) as line_item;

  insert into public.live_pos_payment_lines (
    batch_id,
    payment_method,
    amount,
    reference
  )
  select
    v_batch_id,
    payment_item->>'payment_method',
    (payment_item->>'amount')::numeric,
    payment_item->>'reference'
  from jsonb_array_elements(payment_lines_payload) as payment_item;

  return jsonb_build_object('ok', true, 'message', 'POS import registered.', 'id', v_batch_id);
end;
$$;

create or replace function public.live_sales_post_pos_batch(batch_id uuid, posting_options jsonb default '{}'::jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_batch record;
  v_run_id uuid;
begin
  select * into v_batch
  from public.live_pos_import_batches
  where id = batch_id;

  if not found then
    return jsonb_build_object('ok', false, 'message', 'POS batch not found.');
  end if;

  insert into public.live_sales_posting_runs (
    batch_id,
    branch_id,
    business_date,
    post_cogs,
    status,
    memo,
    created_by,
    posted_at
  )
  values (
    batch_id,
    v_batch.branch_id,
    v_batch.business_date,
    coalesce((posting_options->>'post_cogs')::boolean, false),
    'posted',
    posting_options->>'memo',
    auth.uid(),
    now()
  )
  returning id into v_run_id;

  update public.live_pos_import_batches
  set status = 'posted',
      posted_at = now()
  where id = batch_id;

  return jsonb_build_object('ok', true, 'message', 'Sales POS batch posted foundation.', 'id', v_run_id);
end;
$$;

create or replace function public.live_production_upsert_recipe(recipe_payload jsonb, lines_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_recipe_id uuid;
begin
  insert into public.live_recipes (
    recipe_code,
    name_en,
    name_ar,
    output_sku,
    output_item_id,
    base_output_quantity,
    created_by
  )
  values (
    recipe_payload->>'recipe_code',
    recipe_payload->>'name_en',
    recipe_payload->>'name_ar',
    recipe_payload->>'output_sku',
    nullif(recipe_payload->>'output_item_id',''),
    (recipe_payload->>'base_output_quantity')::numeric,
    auth.uid()
  )
  on conflict (recipe_code) do update set
    name_en = excluded.name_en,
    name_ar = excluded.name_ar,
    output_sku = excluded.output_sku,
    output_item_id = excluded.output_item_id,
    base_output_quantity = excluded.base_output_quantity,
    updated_at = now()
  returning id into v_recipe_id;

  delete from public.live_recipe_lines where recipe_id = v_recipe_id;

  insert into public.live_recipe_lines (
    recipe_id,
    ingredient_sku,
    ingredient_item_id,
    quantity,
    wastage_percent
  )
  select
    v_recipe_id,
    line_item->>'ingredient_sku',
    nullif(line_item->>'ingredient_item_id',''),
    (line_item->>'quantity')::numeric,
    (line_item->>'wastage_percent')::numeric
  from jsonb_array_elements(lines_payload) as line_item;

  return jsonb_build_object('ok', true, 'message', 'Recipe upserted.', 'id', v_recipe_id);
end;
$$;

create or replace function public.live_production_post_batch(batch_payload jsonb, ingredient_lines_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_batch_id uuid;
  v_planned_input_value numeric := 0;
  v_actual_input_value numeric := 0;
begin
  select
    coalesce(sum((line_item->>'planned_quantity')::numeric * (line_item->>'unit_cost')::numeric), 0),
    coalesce(sum((line_item->>'actual_quantity')::numeric * (line_item->>'unit_cost')::numeric), 0)
  into v_planned_input_value, v_actual_input_value
  from jsonb_array_elements(ingredient_lines_payload) as line_item;

  insert into public.live_production_batch_runs (
    batch_no,
    branch_id,
    source_store_id,
    destination_store_id,
    recipe_code,
    recipe_id,
    output_sku,
    output_item_id,
    planned_output_quantity,
    actual_output_quantity,
    production_date,
    planned_input_value,
    actual_input_value,
    output_variance,
    status,
    created_by,
    posted_at
  )
  values (
    batch_payload->>'batch_no',
    nullif(batch_payload->>'branch_id',''),
    nullif(batch_payload->>'source_store_id',''),
    nullif(batch_payload->>'destination_store_id',''),
    batch_payload->>'recipe_code',
    nullif(batch_payload->>'recipe_id','')::uuid,
    batch_payload->>'output_sku',
    nullif(batch_payload->>'output_item_id',''),
    (batch_payload->>'planned_output_quantity')::numeric,
    (batch_payload->>'actual_output_quantity')::numeric,
    (batch_payload->>'production_date')::date,
    v_planned_input_value,
    v_actual_input_value,
    (batch_payload->>'actual_output_quantity')::numeric - (batch_payload->>'planned_output_quantity')::numeric,
    'posted',
    auth.uid(),
    now()
  )
  returning id into v_batch_id;

  insert into public.live_production_ingredient_lines (
    batch_id,
    ingredient_sku,
    ingredient_item_id,
    planned_quantity,
    actual_quantity,
    unit_cost
  )
  select
    v_batch_id,
    line_item->>'ingredient_sku',
    nullif(line_item->>'ingredient_item_id',''),
    (line_item->>'planned_quantity')::numeric,
    (line_item->>'actual_quantity')::numeric,
    (line_item->>'unit_cost')::numeric
  from jsonb_array_elements(ingredient_lines_payload) as line_item;

  return jsonb_build_object('ok', true, 'message', 'Production batch posted foundation.', 'id', v_batch_id);
end;
$$;
do $$
begin
  if to_regprocedure('public.live_sales_register_pos_import(jsonb, jsonb, jsonb)') is not null then
    execute 'grant execute on function public.live_sales_register_pos_import(jsonb, jsonb, jsonb) to authenticated';
  end if;
end;
$$;
do $$
begin
  if to_regprocedure('public.live_sales_post_pos_batch(uuid, jsonb)') is not null then
    execute 'grant execute on function public.live_sales_post_pos_batch(uuid, jsonb) to authenticated';
  end if;
end;
$$;
do $$
begin
  if to_regprocedure('public.live_production_upsert_recipe(jsonb, jsonb)') is not null then
    execute 'grant execute on function public.live_production_upsert_recipe(jsonb, jsonb) to authenticated';
  end if;
end;
$$;
do $$
begin
  if to_regprocedure('public.live_production_post_batch(jsonb, jsonb)') is not null then
    execute 'grant execute on function public.live_production_post_batch(jsonb, jsonb) to authenticated';
  end if;
end;
$$;
