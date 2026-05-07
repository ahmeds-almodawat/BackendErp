-- v318 Inventory Stock Ledger Backend Cutover
-- Additive foundation for real inventory movement ledger.
-- Does not remove existing local/demo UI state.

create extension if not exists pgcrypto;

create table if not exists public.inventory_stock_movements (
  id uuid primary key default gen_random_uuid(),
  movement_no text not null unique,
  movement_date date not null default current_date,
  branch_id text not null references public.branches(id) on delete restrict,
  store_id text not null references public.stores(id) on delete restrict,
  item_id text not null references public.items(id) on delete restrict,
  movement_type text not null check (
    movement_type in (
      'opening_stock',
      'purchase_receipt',
      'sales_consumption',
      'production_consumption',
      'production_output',
      'transfer_in',
      'transfer_out',
      'adjustment_in',
      'adjustment_out',
      'wastage',
      'stock_count_variance',
      'supplier_return'
    )
  ),
  direction text not null check (direction in ('in', 'out')),
  quantity numeric not null check (quantity > 0),
  unit_cost numeric not null default 0 check (unit_cost >= 0),
  total_cost numeric generated always as (quantity * unit_cost) stored,
  source_type text,
  source_id text,
  posting_batch_id uuid references public.posting_batches(id) on delete set null,
  status text not null default 'draft' check (status in ('draft', 'validated', 'posted', 'reversed', 'cancelled')),
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);

create table if not exists public.inventory_stock_balances (
  id uuid primary key default gen_random_uuid(),
  branch_id text not null references public.branches(id) on delete restrict,
  store_id text not null references public.stores(id) on delete restrict,
  item_id text not null references public.items(id) on delete restrict,
  quantity_on_hand numeric not null default 0,
  average_unit_cost numeric not null default 0,
  total_value numeric not null default 0,
  last_movement_at timestamptz,
  updated_at timestamptz not null default now(),
  unique (store_id, item_id)
);

create table if not exists public.inventory_adjustment_requests (
  id uuid primary key default gen_random_uuid(),
  adjustment_no text not null unique,
  branch_id text not null references public.branches(id) on delete restrict,
  store_id text not null references public.stores(id) on delete restrict,
  item_id text not null references public.items(id) on delete restrict,
  direction text not null check (direction in ('in', 'out')),
  quantity numeric not null check (quantity > 0),
  unit_cost numeric not null default 0 check (unit_cost >= 0),
  reason text not null,
  status text not null default 'draft' check (status in ('draft', 'pending_approval', 'approved', 'posted', 'rejected', 'cancelled')),
  requested_by uuid references auth.users(id),
  approved_by uuid references auth.users(id),
  posted_movement_id uuid references public.inventory_stock_movements(id) on delete set null,
  created_at timestamptz not null default now(),
  approved_at timestamptz,
  posted_at timestamptz
);

create table if not exists public.inventory_stock_counts (
  id uuid primary key default gen_random_uuid(),
  count_no text not null unique,
  branch_id text not null references public.branches(id) on delete restrict,
  store_id text not null references public.stores(id) on delete restrict,
  count_date date not null default current_date,
  status text not null default 'draft' check (status in ('draft', 'counting', 'validated', 'approved', 'posted', 'cancelled')),
  created_by uuid references auth.users(id),
  approved_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  approved_at timestamptz,
  posted_at timestamptz
);

create table if not exists public.inventory_stock_count_lines (
  id uuid primary key default gen_random_uuid(),
  count_id uuid not null references public.inventory_stock_counts(id) on delete cascade,
  item_id text not null references public.items(id) on delete restrict,
  system_quantity numeric not null default 0,
  counted_quantity numeric not null default 0,
  variance_quantity numeric generated always as (counted_quantity - system_quantity) stored,
  unit_cost numeric not null default 0,
  reason text,
  unique (count_id, item_id)
);

create table if not exists public.inventory_lot_tracking (
  id uuid primary key default gen_random_uuid(),
  store_id text not null references public.stores(id) on delete restrict,
  item_id text not null references public.items(id) on delete restrict,
  lot_no text not null,
  batch_no text,
  expiry_date date,
  quantity numeric not null default 0,
  unit_cost numeric not null default 0,
  status text not null default 'available' check (status in ('available', 'quarantine', 'expired', 'returned', 'consumed')),
  source_movement_id uuid references public.inventory_stock_movements(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (store_id, item_id, lot_no)
);

create index if not exists idx_inventory_stock_movements_item_store on public.inventory_stock_movements(item_id, store_id, movement_date desc);
create index if not exists idx_inventory_stock_movements_source on public.inventory_stock_movements(source_type, source_id);
create index if not exists idx_inventory_stock_balances_store_item on public.inventory_stock_balances(store_id, item_id);
create index if not exists idx_inventory_adjustment_requests_status on public.inventory_adjustment_requests(status, created_at desc);
create index if not exists idx_inventory_stock_counts_store on public.inventory_stock_counts(store_id, count_date desc);
create index if not exists idx_inventory_lot_tracking_item on public.inventory_lot_tracking(item_id, store_id, expiry_date);

alter table public.inventory_stock_movements enable row level security;
alter table public.inventory_stock_balances enable row level security;
alter table public.inventory_adjustment_requests enable row level security;
alter table public.inventory_stock_counts enable row level security;
alter table public.inventory_stock_count_lines enable row level security;
alter table public.inventory_lot_tracking enable row level security;

create or replace function public.inventory_validate_adjustment(adjustment_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_adjustment record;
  v_balance numeric := 0;
  v_critical int := 0;
  v_warning int := 0;
  v_findings jsonb := '[]'::jsonb;
begin
  if not coalesce(public.app_current_user_has_permission('inventory.adjust'), false) then
    raise exception 'permission denied: inventory.adjust' using errcode = '42501';
  end if;

  select * into v_adjustment
  from public.inventory_adjustment_requests
  where id = adjustment_id;

  if not found then
    return jsonb_build_object(
      'ok', false,
      'critical_count', 1,
      'warning_count', 0,
      'message', 'Adjustment request not found.',
      'findings', jsonb_build_array(jsonb_build_object('severity','critical','message','Adjustment request not found.'))
    );
  end if;

  select quantity_on_hand into v_balance
  from public.inventory_stock_balances
  where store_id = v_adjustment.store_id and item_id = v_adjustment.item_id;

  v_balance := coalesce(v_balance, 0);

  if v_adjustment.direction = 'out' and v_adjustment.quantity > v_balance then
    v_critical := v_critical + 1;
    v_findings := v_findings || jsonb_build_array(jsonb_build_object(
      'severity','critical',
      'message','Outbound adjustment exceeds available stock.',
      'available_quantity', v_balance
    ));
  end if;

  if v_adjustment.reason is null or length(trim(v_adjustment.reason)) = 0 then
    v_critical := v_critical + 1;
    v_findings := v_findings || jsonb_build_array(jsonb_build_object(
      'severity','critical',
      'message','Adjustment reason is required.'
    ));
  end if;

  return jsonb_build_object(
    'ok', v_critical = 0,
    'critical_count', v_critical,
    'warning_count', v_warning,
    'message', case when v_critical = 0 then 'Adjustment validated.' else 'Adjustment blocked.' end,
    'findings', v_findings
  );
end;
$$;

create or replace function public.inventory_post_stock_movement(movement_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_movement record;
begin
  if not coalesce(public.app_current_user_has_permission('inventory.adjust'), false) then
    raise exception 'permission denied: inventory.adjust' using errcode = '42501';
  end if;

  select * into v_movement
  from public.inventory_stock_movements
  where id = movement_id;

  if not found then
    return jsonb_build_object('ok', false, 'message', 'Movement not found.', 'id', movement_id);
  end if;

  if v_movement.status = 'posted' then
    return jsonb_build_object('ok', true, 'message', 'Movement already posted.', 'id', movement_id);
  end if;

  update public.inventory_stock_movements
  set status = 'posted'
  where id = movement_id;

  insert into public.inventory_stock_balances (
    branch_id,
    store_id,
    item_id,
    quantity_on_hand,
    average_unit_cost,
    total_value,
    last_movement_at
  )
  values (
    v_movement.branch_id,
    v_movement.store_id,
    v_movement.item_id,
    case when v_movement.direction = 'in' then v_movement.quantity else -v_movement.quantity end,
    v_movement.unit_cost,
    case when v_movement.direction = 'in' then v_movement.total_cost else -v_movement.total_cost end,
    now()
  )
  on conflict (store_id, item_id) do update set
    quantity_on_hand = public.inventory_stock_balances.quantity_on_hand +
      case when v_movement.direction = 'in' then v_movement.quantity else -v_movement.quantity end,
    total_value = public.inventory_stock_balances.total_value +
      case when v_movement.direction = 'in' then v_movement.total_cost else -v_movement.total_cost end,
    average_unit_cost = case
      when (public.inventory_stock_balances.quantity_on_hand +
        case when v_movement.direction = 'in' then v_movement.quantity else -v_movement.quantity end) = 0
      then 0
      else greatest(0, (
        public.inventory_stock_balances.total_value +
        case when v_movement.direction = 'in' then v_movement.total_cost else -v_movement.total_cost end
      ) / nullif((
        public.inventory_stock_balances.quantity_on_hand +
        case when v_movement.direction = 'in' then v_movement.quantity else -v_movement.quantity end
      ), 0))
    end,
    last_movement_at = now(),
    updated_at = now();

  return jsonb_build_object('ok', true, 'message', 'Stock movement posted.', 'id', movement_id);
end;
$$;
do $$
begin
  if to_regprocedure('public.inventory_validate_adjustment(uuid)') is not null then
    execute 'grant execute on function public.inventory_validate_adjustment(uuid) to authenticated';
  end if;
end;
$$;
do $$
begin
  if to_regprocedure('public.inventory_post_stock_movement(uuid)') is not null then
    execute 'grant execute on function public.inventory_post_stock_movement(uuid) to authenticated';
  end if;
end;
$$;
