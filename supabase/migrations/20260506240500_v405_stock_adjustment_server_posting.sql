-- v405 Stock Count / Inventory Adjustment Server Posting
-- Backend-authoritative inventory variance workflow:
-- adjustment/count -> inventory movement/balance -> GL posting batch + finance journal -> audit evidence.

create extension if not exists pgcrypto;

-- Compatibility columns on existing v318 inventory workflow tables.
alter table if exists public.inventory_adjustment_requests add column if not exists fiscal_period_id uuid references public.fiscal_periods(id) on delete set null;
alter table if exists public.inventory_adjustment_requests add column if not exists posting_batch_id uuid references public.posting_batches(id) on delete set null;
alter table if exists public.inventory_adjustment_requests add column if not exists metadata jsonb not null default '{}'::jsonb;

alter table if exists public.inventory_stock_counts add column if not exists fiscal_period_id uuid references public.fiscal_periods(id) on delete set null;
alter table if exists public.inventory_stock_counts add column if not exists posting_batch_id uuid references public.posting_batches(id) on delete set null;
alter table if exists public.inventory_stock_counts add column if not exists metadata jsonb not null default '{}'::jsonb;
alter table if exists public.inventory_stock_count_lines add column if not exists metadata jsonb not null default '{}'::jsonb;

create index if not exists idx_inventory_adjustment_requests_posting_batch on public.inventory_adjustment_requests(posting_batch_id);
create index if not exists idx_inventory_stock_counts_posting_batch on public.inventory_stock_counts(posting_batch_id);

create table if not exists public.inventory_adjustment_server_posting_events (
  id uuid primary key default gen_random_uuid(),
  adjustment_id uuid references public.inventory_adjustment_requests(id) on delete set null,
  stock_count_id uuid references public.inventory_stock_counts(id) on delete set null,
  posting_batch_id uuid references public.posting_batches(id) on delete set null,
  journal_id uuid references public.finance_journal_entries_backend(id) on delete set null,
  event_type text not null,
  severity text not null default 'info' check (severity in ('info','warning','critical')),
  message text,
  details jsonb not null default '{}'::jsonb,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);

create index if not exists idx_inventory_adjustment_server_events_adjustment
  on public.inventory_adjustment_server_posting_events(adjustment_id, created_at desc);
create index if not exists idx_inventory_adjustment_server_events_count
  on public.inventory_adjustment_server_posting_events(stock_count_id, created_at desc);

alter table public.inventory_adjustment_server_posting_events enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'inventory_adjustment_server_posting_events'
      and policyname = 'inventory_adjustment_server_events_read_authenticated_v405'
  ) then
    create policy inventory_adjustment_server_events_read_authenticated_v405
      on public.inventory_adjustment_server_posting_events
      for select to authenticated
      using (true);
  end if;
end;
$$;

create or replace function public.inventory_adjustment_server_posting_event(
  p_adjustment_id uuid,
  p_stock_count_id uuid,
  p_posting_batch_id uuid,
  p_journal_id uuid,
  p_event_type text,
  p_severity text default 'info',
  p_message text default null,
  p_details jsonb default '{}'::jsonb
) returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.inventory_adjustment_server_posting_events(
    adjustment_id,
    stock_count_id,
    posting_batch_id,
    journal_id,
    event_type,
    severity,
    message,
    details,
    created_by
  ) values (
    p_adjustment_id,
    p_stock_count_id,
    p_posting_batch_id,
    p_journal_id,
    coalesce(nullif(p_event_type, ''), 'inventory_adjustment.posting_event'),
    coalesce(nullif(p_severity, ''), 'info'),
    p_message,
    coalesce(p_details, '{}'::jsonb),
    auth.uid()
  );
end;
$$;

create or replace function public.inventory_post_adjustment_server(
  p_adjustment_id uuid,
  p_fiscal_period_id uuid default null,
  p_posting_date date default null,
  p_account_map jsonb default '{}'::jsonb,
  p_options jsonb default '{}'::jsonb
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_adjustment public.inventory_adjustment_requests%rowtype;
  v_period_id uuid;
  v_posting_date date;
  v_batch_id uuid;
  v_journal_id uuid;
  v_existing_movement_id uuid;
  v_balance_qty numeric := 0;
  v_balance_value numeric := 0;
  v_old_avg numeric := 0;
  v_qty numeric := 0;
  v_delta_qty numeric := 0;
  v_unit_cost numeric := 0;
  v_amount numeric := 0;
  v_new_qty numeric := 0;
  v_new_value numeric := 0;
  v_inventory_account text := coalesce(nullif(p_account_map->>'inventory_account',''), '1200');
  v_gain_account text := coalesce(nullif(p_account_map->>'inventory_gain_account',''), '4810');
  v_loss_account text := coalesce(nullif(p_account_map->>'inventory_loss_account',''), '5810');
  v_allow_negative boolean := coalesce((p_options->>'allowNegativeStock')::boolean, false);
  v_movement_no text;
  v_journal_no text;
  v_batch_ref text;
begin
  if p_adjustment_id is null then
    return jsonb_build_object('ok', false, 'message', 'adjustment_id is required');
  end if;

  if not (
    coalesce(public.app_current_user_has_permission('inventory.adjust'), false)
    or coalesce(public.app_current_user_has_permission('finance.post'), false)
    or coalesce(public.app_current_user_has_permission('inventory.post_adjustment'), false)
  ) then
    raise exception 'permission denied: inventory.adjust or finance.post required' using errcode = '42501';
  end if;

  select * into v_adjustment
  from public.inventory_adjustment_requests
  where id = p_adjustment_id
  for update;

  if not found then
    return jsonb_build_object('ok', false, 'message', 'Inventory adjustment was not found.', 'adjustmentId', p_adjustment_id);
  end if;

  if v_adjustment.status = 'posted' then
    return jsonb_build_object('ok', true, 'alreadyPosted', true, 'message', 'Inventory adjustment is already posted.', 'adjustmentId', v_adjustment.id, 'postingBatchId', v_adjustment.posting_batch_id);
  end if;

  if v_adjustment.status not in ('approved', 'validated') then
    return jsonb_build_object('ok', false, 'message', 'Only approved or validated inventory adjustments can be server-posted.', 'adjustmentId', v_adjustment.id, 'status', v_adjustment.status);
  end if;

  if v_adjustment.branch_id is null or trim(v_adjustment.branch_id) = '' then
    return jsonb_build_object('ok', false, 'message', 'Adjustment branch_id is required.', 'adjustmentId', v_adjustment.id);
  end if;

  if v_adjustment.store_id is null or trim(v_adjustment.store_id) = '' then
    return jsonb_build_object('ok', false, 'message', 'Adjustment store_id is required.', 'adjustmentId', v_adjustment.id);
  end if;

  if v_adjustment.item_id is null or trim(v_adjustment.item_id) = '' then
    return jsonb_build_object('ok', false, 'message', 'Adjustment item_id is required.', 'adjustmentId', v_adjustment.id);
  end if;

  v_qty := coalesce(v_adjustment.quantity, 0);
  if v_qty <= 0 then
    return jsonb_build_object('ok', false, 'message', 'Adjustment quantity must be greater than zero.', 'adjustmentId', v_adjustment.id);
  end if;

  select quantity_on_hand, total_value, average_unit_cost
  into v_balance_qty, v_balance_value, v_old_avg
  from public.inventory_stock_balances
  where store_id = v_adjustment.store_id and item_id = v_adjustment.item_id
  for update;

  v_balance_qty := coalesce(v_balance_qty, 0);
  v_balance_value := coalesce(v_balance_value, 0);
  v_old_avg := coalesce(v_old_avg, 0);
  v_unit_cost := coalesce(nullif(v_adjustment.unit_cost, 0), nullif(v_old_avg, 0), 0);
  v_delta_qty := case when v_adjustment.direction = 'in' then v_qty else -v_qty end;
  v_amount := round(abs(v_delta_qty) * v_unit_cost, 2);

  if v_adjustment.direction not in ('in', 'out') then
    return jsonb_build_object('ok', false, 'message', 'Adjustment direction must be in or out.', 'adjustmentId', v_adjustment.id, 'direction', v_adjustment.direction);
  end if;

  if v_adjustment.direction = 'out' and not v_allow_negative and v_qty > v_balance_qty then
    return jsonb_build_object('ok', false, 'message', 'Outbound adjustment exceeds available stock.', 'adjustmentId', v_adjustment.id, 'availableQuantity', v_balance_qty, 'requestedQuantity', v_qty);
  end if;

  select id into v_batch_id
  from public.posting_batches
  where source_type = 'inventory_adjustment'
    and source_id = v_adjustment.id::text
    and direction = 'normal'
    and status not in ('cancelled', 'voided')
  limit 1;

  if v_batch_id is not null then
    update public.inventory_adjustment_requests
    set status = 'posted', posting_batch_id = v_batch_id, posted_at = coalesce(posted_at, now()), metadata = coalesce(metadata, '{}'::jsonb) || jsonb_build_object('serverPostingRecoveredAt', now())
    where id = v_adjustment.id;
    return jsonb_build_object('ok', true, 'alreadyPosted', true, 'message', 'Existing posting batch found and linked to adjustment.', 'adjustmentId', v_adjustment.id, 'postingBatchId', v_batch_id);
  end if;

  select id into v_period_id
  from public.fiscal_periods
  where id = coalesce(p_fiscal_period_id, v_adjustment.fiscal_period_id)
    and status = 'open'
  limit 1;

  if v_period_id is null then
    select id into v_period_id
    from public.fiscal_periods
    where status = 'open'
      and coalesce(p_posting_date, current_date) between starts_at and ends_at
    order by starts_at desc
    limit 1;
  end if;

  if v_period_id is null then
    return jsonb_build_object('ok', false, 'message', 'No open fiscal period found for adjustment posting.', 'adjustmentId', v_adjustment.id);
  end if;

  v_posting_date := coalesce(p_posting_date, current_date);
  v_batch_ref := 'INV-ADJ-' || to_char(now(), 'YYYYMMDDHH24MISSMS') || '-' || substring(v_adjustment.id::text, 1, 8);
  v_journal_no := 'JE-' || v_batch_ref;

  insert into public.posting_batches(batch_ref, source_type, source_id, source_document_no, source_module, branch_id, fiscal_period_id, posting_date, status, direction, description, total_debit, total_credit, validation_snapshot, metadata, created_by, posted_at, last_validated_at)
  values (v_batch_ref, 'inventory_adjustment', v_adjustment.id::text, v_adjustment.adjustment_no, 'inventory', v_adjustment.branch_id, v_period_id, v_posting_date, 'posted', 'normal', 'Inventory adjustment server posting ' || coalesce(v_adjustment.adjustment_no, v_adjustment.id::text), v_amount, v_amount, jsonb_build_object('ok', true, 'source', 'v405'), jsonb_build_object('workflow', 'inventory_adjustment_server_posting', 'direction', v_adjustment.direction, 'quantity', v_qty, 'unitCost', v_unit_cost), auth.uid(), now(), now())
  returning id into v_batch_id;

  if v_adjustment.direction = 'in' then
    insert into public.posting_batch_lines(batch_id, line_no, account_code, description, branch_id, debit, credit, source_line_id, dimensions)
    values
      (v_batch_id, 1, v_inventory_account, 'Inventory adjustment in', v_adjustment.branch_id, v_amount, 0, v_adjustment.id::text, jsonb_build_object('storeId', v_adjustment.store_id, 'itemId', v_adjustment.item_id)),
      (v_batch_id, 2, v_gain_account, 'Inventory adjustment gain', v_adjustment.branch_id, 0, v_amount, v_adjustment.id::text, jsonb_build_object('storeId', v_adjustment.store_id, 'itemId', v_adjustment.item_id));
  else
    insert into public.posting_batch_lines(batch_id, line_no, account_code, description, branch_id, debit, credit, source_line_id, dimensions)
    values
      (v_batch_id, 1, v_loss_account, 'Inventory adjustment loss', v_adjustment.branch_id, v_amount, 0, v_adjustment.id::text, jsonb_build_object('storeId', v_adjustment.store_id, 'itemId', v_adjustment.item_id)),
      (v_batch_id, 2, v_inventory_account, 'Inventory adjustment out', v_adjustment.branch_id, 0, v_amount, v_adjustment.id::text, jsonb_build_object('storeId', v_adjustment.store_id, 'itemId', v_adjustment.item_id));
  end if;

  insert into public.finance_journal_entries_backend(journal_no, journal_date, branch_id, fiscal_period_id, source_type, source_id, description, status, posted_at, created_by)
  values (v_journal_no, v_posting_date, v_adjustment.branch_id, v_period_id, 'inventory_adjustment', v_adjustment.id::text, 'Inventory adjustment server posting ' || coalesce(v_adjustment.adjustment_no, v_adjustment.id::text), 'posted', now(), auth.uid())
  returning id into v_journal_id;

  insert into public.finance_journal_lines_backend(journal_id, account_code, branch_id, debit, credit, memo)
  select v_journal_id, account_code, branch_id, debit, credit, description
  from public.posting_batch_lines
  where batch_id = v_batch_id
  order by line_no;

  v_movement_no := 'MOV-ADJ-' || to_char(now(), 'YYYYMMDDHH24MISSMS') || '-' || substring(v_adjustment.id::text, 1, 8);
  insert into public.inventory_stock_movements(movement_no, movement_date, branch_id, store_id, item_id, movement_type, direction, quantity, unit_cost, source_type, source_id, posting_batch_id, status, created_by)
  values (v_movement_no, v_posting_date, v_adjustment.branch_id, v_adjustment.store_id, v_adjustment.item_id, case when v_adjustment.direction = 'in' then 'adjustment_in' else 'adjustment_out' end, v_adjustment.direction, v_qty, v_unit_cost, 'inventory_adjustment', v_adjustment.id::text, v_batch_id, 'posted', auth.uid())
  returning id into v_existing_movement_id;

  v_new_qty := v_balance_qty + v_delta_qty;
  v_new_value := v_balance_value + case when v_adjustment.direction = 'in' then v_amount else -v_amount end;
  if abs(v_new_qty) < 0.000001 then
    v_new_value := 0;
  end if;

  insert into public.inventory_stock_balances(branch_id, store_id, item_id, quantity_on_hand, average_unit_cost, total_value, last_movement_at, updated_at)
  values (v_adjustment.branch_id, v_adjustment.store_id, v_adjustment.item_id, v_new_qty, case when v_new_qty <> 0 then round(v_new_value / v_new_qty, 6) else 0 end, v_new_value, now(), now())
  on conflict (store_id, item_id) do update set
    quantity_on_hand = v_new_qty,
    total_value = v_new_value,
    average_unit_cost = case when v_new_qty <> 0 then round(v_new_value / v_new_qty, 6) else 0 end,
    last_movement_at = now(),
    updated_at = now();

  update public.inventory_adjustment_requests
  set status = 'posted', fiscal_period_id = v_period_id, posting_batch_id = v_batch_id, posted_movement_id = v_existing_movement_id, posted_at = now(), metadata = coalesce(metadata, '{}'::jsonb) || jsonb_build_object('serverPostedAt', now(), 'journalId', v_journal_id, 'postingBatchId', v_batch_id)
  where id = v_adjustment.id;

  perform public.inventory_adjustment_server_posting_event(v_adjustment.id, null, v_batch_id, v_journal_id, 'inventory_adjustment.posted', 'info', 'Inventory adjustment posted server-side.', jsonb_build_object('quantityDelta', v_delta_qty, 'amount', v_amount, 'movementId', v_existing_movement_id));

  return jsonb_build_object('ok', true, 'message', 'Inventory adjustment posted server-side.', 'adjustmentId', v_adjustment.id, 'postingBatchId', v_batch_id, 'journalId', v_journal_id, 'movementId', v_existing_movement_id, 'quantityDelta', v_delta_qty, 'amount', v_amount);
exception when others then
  perform public.inventory_adjustment_server_posting_event(p_adjustment_id, null, null, null, 'inventory_adjustment.post_failed', 'critical', SQLERRM, jsonb_build_object('sqlstate', SQLSTATE));
  raise;
end;
$$;

create or replace function public.inventory_post_stock_count_server(
  p_count_id uuid,
  p_fiscal_period_id uuid default null,
  p_posting_date date default null,
  p_account_map jsonb default '{}'::jsonb,
  p_options jsonb default '{}'::jsonb
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count public.inventory_stock_counts%rowtype;
  v_period_id uuid;
  v_posting_date date;
  v_batch_id uuid;
  v_journal_id uuid;
  v_positive_amount numeric := 0;
  v_negative_amount numeric := 0;
  v_total_debit numeric := 0;
  v_total_credit numeric := 0;
  v_line_count integer := 0;
  v_movement_count integer := 0;
  v_inventory_account text := coalesce(nullif(p_account_map->>'inventory_account',''), '1200');
  v_gain_account text := coalesce(nullif(p_account_map->>'inventory_gain_account',''), '4810');
  v_loss_account text := coalesce(nullif(p_account_map->>'inventory_loss_account',''), '5810');
  v_allow_negative boolean := coalesce((p_options->>'allowNegativeStock')::boolean, false);
  v_batch_ref text;
  v_journal_no text;
  v_line record;
  v_balance_qty numeric;
  v_balance_value numeric;
  v_old_avg numeric;
  v_delta_qty numeric;
  v_unit_cost numeric;
  v_amount numeric;
  v_new_qty numeric;
  v_new_value numeric;
  v_line_no integer := 1;
begin
  if p_count_id is null then
    return jsonb_build_object('ok', false, 'message', 'count_id is required');
  end if;

  if not (
    coalesce(public.app_current_user_has_permission('inventory.adjust'), false)
    or coalesce(public.app_current_user_has_permission('finance.post'), false)
    or coalesce(public.app_current_user_has_permission('inventory.post_adjustment'), false)
  ) then
    raise exception 'permission denied: inventory.adjust or finance.post required' using errcode = '42501';
  end if;

  select * into v_count
  from public.inventory_stock_counts
  where id = p_count_id
  for update;

  if not found then
    return jsonb_build_object('ok', false, 'message', 'Stock count was not found.', 'countId', p_count_id);
  end if;

  if v_count.status = 'posted' then
    return jsonb_build_object('ok', true, 'alreadyPosted', true, 'message', 'Stock count is already posted.', 'countId', v_count.id, 'postingBatchId', v_count.posting_batch_id);
  end if;

  if v_count.status not in ('approved', 'validated') then
    return jsonb_build_object('ok', false, 'message', 'Only approved or validated stock counts can be server-posted.', 'countId', v_count.id, 'status', v_count.status);
  end if;

  if v_count.branch_id is null or trim(v_count.branch_id) = '' or v_count.store_id is null or trim(v_count.store_id) = '' then
    return jsonb_build_object('ok', false, 'message', 'Stock count branch_id and store_id are required.', 'countId', v_count.id);
  end if;

  select count(*) into v_line_count
  from public.inventory_stock_count_lines
  where count_id = v_count.id;

  if v_line_count = 0 then
    return jsonb_build_object('ok', false, 'message', 'Stock count has no lines.', 'countId', v_count.id);
  end if;

  for v_line in
    select l.*, coalesce(b.quantity_on_hand, 0) as balance_qty, coalesce(b.total_value, 0) as balance_value, coalesce(b.average_unit_cost, 0) as balance_avg
    from public.inventory_stock_count_lines l
    left join public.inventory_stock_balances b on b.store_id = v_count.store_id and b.item_id = l.item_id
    where l.count_id = v_count.id
    order by l.item_id
  loop
    if coalesce(v_line.counted_quantity, 0) < 0 then
      return jsonb_build_object('ok', false, 'message', 'Stock count contains a negative counted quantity.', 'countId', v_count.id, 'itemId', v_line.item_id);
    end if;

    v_delta_qty := coalesce(v_line.counted_quantity, 0) - coalesce(v_line.system_quantity, v_line.balance_qty, 0);
    v_unit_cost := coalesce(nullif(v_line.unit_cost, 0), nullif(v_line.balance_avg, 0), 0);
    v_amount := round(abs(v_delta_qty) * v_unit_cost, 2);

    if v_delta_qty < 0 and not v_allow_negative and abs(v_delta_qty) > v_line.balance_qty then
      return jsonb_build_object('ok', false, 'message', 'Stock count negative variance exceeds available stock.', 'countId', v_count.id, 'itemId', v_line.item_id, 'availableQuantity', v_line.balance_qty, 'varianceQuantity', v_delta_qty);
    end if;

    if v_delta_qty > 0 then
      v_positive_amount := v_positive_amount + v_amount;
    elsif v_delta_qty < 0 then
      v_negative_amount := v_negative_amount + v_amount;
    end if;
  end loop;

  if v_positive_amount = 0 and v_negative_amount = 0 then
    update public.inventory_stock_counts
    set status = 'posted', posted_at = now(), metadata = coalesce(metadata, '{}'::jsonb) || jsonb_build_object('serverPostedAt', now(), 'zeroVariance', true)
    where id = v_count.id;
    perform public.inventory_adjustment_server_posting_event(null, v_count.id, null, null, 'stock_count.zero_variance_posted', 'info', 'Stock count has zero variance and was closed as posted.', '{}'::jsonb);
    return jsonb_build_object('ok', true, 'zeroVariance', true, 'message', 'Stock count has zero variance and was closed as posted.', 'countId', v_count.id);
  end if;

  select id into v_batch_id
  from public.posting_batches
  where source_type = 'inventory_adjustment'
    and source_id = v_count.id::text
    and direction = 'normal'
    and status not in ('cancelled', 'voided')
  limit 1;

  if v_batch_id is not null then
    update public.inventory_stock_counts
    set status = 'posted', posting_batch_id = v_batch_id, posted_at = coalesce(posted_at, now()), metadata = coalesce(metadata, '{}'::jsonb) || jsonb_build_object('serverPostingRecoveredAt', now())
    where id = v_count.id;
    return jsonb_build_object('ok', true, 'alreadyPosted', true, 'message', 'Existing posting batch found and linked to stock count.', 'countId', v_count.id, 'postingBatchId', v_batch_id);
  end if;

  select id into v_period_id
  from public.fiscal_periods
  where id = coalesce(p_fiscal_period_id, v_count.fiscal_period_id)
    and status = 'open'
  limit 1;

  if v_period_id is null then
    select id into v_period_id
    from public.fiscal_periods
    where status = 'open'
      and coalesce(p_posting_date, v_count.count_date, current_date) between starts_at and ends_at
    order by starts_at desc
    limit 1;
  end if;

  if v_period_id is null then
    return jsonb_build_object('ok', false, 'message', 'No open fiscal period found for stock count posting.', 'countId', v_count.id);
  end if;

  v_posting_date := coalesce(p_posting_date, v_count.count_date, current_date);
  v_total_debit := v_positive_amount + v_negative_amount;
  v_total_credit := v_positive_amount + v_negative_amount;
  v_batch_ref := 'INV-CNT-' || to_char(now(), 'YYYYMMDDHH24MISSMS') || '-' || substring(v_count.id::text, 1, 8);
  v_journal_no := 'JE-' || v_batch_ref;

  insert into public.posting_batches(batch_ref, source_type, source_id, source_document_no, source_module, branch_id, fiscal_period_id, posting_date, status, direction, description, total_debit, total_credit, validation_snapshot, metadata, created_by, posted_at, last_validated_at)
  values (v_batch_ref, 'inventory_adjustment', v_count.id::text, v_count.count_no, 'inventory', v_count.branch_id, v_period_id, v_posting_date, 'posted', 'normal', 'Stock count variance server posting ' || coalesce(v_count.count_no, v_count.id::text), v_total_debit, v_total_credit, jsonb_build_object('ok', true, 'source', 'v405'), jsonb_build_object('workflow', 'stock_count_server_posting', 'positiveAmount', v_positive_amount, 'negativeAmount', v_negative_amount), auth.uid(), now(), now())
  returning id into v_batch_id;

  if v_positive_amount > 0 then
    insert into public.posting_batch_lines(batch_id, line_no, account_code, description, branch_id, debit, credit, source_line_id, dimensions)
    values (v_batch_id, v_line_no, v_inventory_account, 'Stock count surplus inventory increase', v_count.branch_id, v_positive_amount, 0, v_count.id::text, jsonb_build_object('storeId', v_count.store_id));
    v_line_no := v_line_no + 1;
    insert into public.posting_batch_lines(batch_id, line_no, account_code, description, branch_id, debit, credit, source_line_id, dimensions)
    values (v_batch_id, v_line_no, v_gain_account, 'Stock count surplus gain', v_count.branch_id, 0, v_positive_amount, v_count.id::text, jsonb_build_object('storeId', v_count.store_id));
    v_line_no := v_line_no + 1;
  end if;

  if v_negative_amount > 0 then
    insert into public.posting_batch_lines(batch_id, line_no, account_code, description, branch_id, debit, credit, source_line_id, dimensions)
    values (v_batch_id, v_line_no, v_loss_account, 'Stock count shortage loss', v_count.branch_id, v_negative_amount, 0, v_count.id::text, jsonb_build_object('storeId', v_count.store_id));
    v_line_no := v_line_no + 1;
    insert into public.posting_batch_lines(batch_id, line_no, account_code, description, branch_id, debit, credit, source_line_id, dimensions)
    values (v_batch_id, v_line_no, v_inventory_account, 'Stock count shortage inventory decrease', v_count.branch_id, 0, v_negative_amount, v_count.id::text, jsonb_build_object('storeId', v_count.store_id));
  end if;

  insert into public.finance_journal_entries_backend(journal_no, journal_date, branch_id, fiscal_period_id, source_type, source_id, description, status, posted_at, created_by)
  values (v_journal_no, v_posting_date, v_count.branch_id, v_period_id, 'inventory_adjustment', v_count.id::text, 'Stock count variance server posting ' || coalesce(v_count.count_no, v_count.id::text), 'posted', now(), auth.uid())
  returning id into v_journal_id;

  insert into public.finance_journal_lines_backend(journal_id, account_code, branch_id, debit, credit, memo)
  select v_journal_id, account_code, branch_id, debit, credit, description
  from public.posting_batch_lines
  where batch_id = v_batch_id
  order by line_no;

  for v_line in
    select l.*, coalesce(b.quantity_on_hand, 0) as balance_qty, coalesce(b.total_value, 0) as balance_value, coalesce(b.average_unit_cost, 0) as balance_avg
    from public.inventory_stock_count_lines l
    left join public.inventory_stock_balances b on b.store_id = v_count.store_id and b.item_id = l.item_id
    where l.count_id = v_count.id
    order by l.item_id
  loop
    v_delta_qty := coalesce(v_line.counted_quantity, 0) - coalesce(v_line.system_quantity, v_line.balance_qty, 0);
    if v_delta_qty = 0 then
      continue;
    end if;

    v_unit_cost := coalesce(nullif(v_line.unit_cost, 0), nullif(v_line.balance_avg, 0), 0);
    v_amount := round(abs(v_delta_qty) * v_unit_cost, 2);

    insert into public.inventory_stock_movements(movement_no, movement_date, branch_id, store_id, item_id, movement_type, direction, quantity, unit_cost, source_type, source_id, posting_batch_id, status, created_by)
    values ('MOV-CNT-' || to_char(clock_timestamp(), 'YYYYMMDDHH24MISSMS') || '-' || substring(v_line.id::text, 1, 8), v_posting_date, v_count.branch_id, v_count.store_id, v_line.item_id, 'stock_count_variance', case when v_delta_qty > 0 then 'in' else 'out' end, abs(v_delta_qty), v_unit_cost, 'stock_count', v_count.id::text, v_batch_id, 'posted', auth.uid());

    v_new_qty := coalesce(v_line.balance_qty, 0) + v_delta_qty;
    v_new_value := coalesce(v_line.balance_value, 0) + case when v_delta_qty > 0 then v_amount else -v_amount end;
    if abs(v_new_qty) < 0.000001 then
      v_new_value := 0;
    end if;

    insert into public.inventory_stock_balances(branch_id, store_id, item_id, quantity_on_hand, average_unit_cost, total_value, last_movement_at, updated_at)
    values (v_count.branch_id, v_count.store_id, v_line.item_id, v_new_qty, case when v_new_qty <> 0 then round(v_new_value / v_new_qty, 6) else 0 end, v_new_value, now(), now())
    on conflict (store_id, item_id) do update set
      quantity_on_hand = v_new_qty,
      total_value = v_new_value,
      average_unit_cost = case when v_new_qty <> 0 then round(v_new_value / v_new_qty, 6) else 0 end,
      last_movement_at = now(),
      updated_at = now();

    v_movement_count := v_movement_count + 1;
  end loop;

  update public.inventory_stock_counts
  set status = 'posted', fiscal_period_id = v_period_id, posting_batch_id = v_batch_id, posted_at = now(), metadata = coalesce(metadata, '{}'::jsonb) || jsonb_build_object('serverPostedAt', now(), 'journalId', v_journal_id, 'postingBatchId', v_batch_id, 'movementCount', v_movement_count)
  where id = v_count.id;

  perform public.inventory_adjustment_server_posting_event(null, v_count.id, v_batch_id, v_journal_id, 'stock_count.posted', 'info', 'Stock count variance posted server-side.', jsonb_build_object('positiveAmount', v_positive_amount, 'negativeAmount', v_negative_amount, 'movementCount', v_movement_count));

  return jsonb_build_object('ok', true, 'message', 'Stock count variance posted server-side.', 'countId', v_count.id, 'postingBatchId', v_batch_id, 'journalId', v_journal_id, 'positiveAmount', v_positive_amount, 'negativeAmount', v_negative_amount, 'movementCount', v_movement_count);
exception when others then
  perform public.inventory_adjustment_server_posting_event(null, p_count_id, null, null, 'stock_count.post_failed', 'critical', SQLERRM, jsonb_build_object('sqlstate', SQLSTATE));
  raise;
end;
$$;

-- Compatibility wrappers for existing/future callers.
create or replace function public.inventory_post_adjustment(adjustment_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  return public.inventory_post_adjustment_server(adjustment_id, null, null, '{}'::jsonb, '{}'::jsonb);
end;
$$;

create or replace function public.inventory_post_stock_count(count_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  return public.inventory_post_stock_count_server(count_id, null, null, '{}'::jsonb, '{}'::jsonb);
end;
$$;

create or replace function public.stock_count_post_count(count_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  return public.inventory_post_stock_count_server(count_id, null, null, '{}'::jsonb, '{}'::jsonb);
end;
$$;

revoke all on function public.inventory_post_adjustment_server(uuid, uuid, date, jsonb, jsonb) from public;
revoke all on function public.inventory_post_stock_count_server(uuid, uuid, date, jsonb, jsonb) from public;
revoke all on function public.inventory_post_adjustment(uuid) from public;
revoke all on function public.inventory_post_stock_count(uuid) from public;
revoke all on function public.stock_count_post_count(uuid) from public;

grant execute on function public.inventory_post_adjustment_server(uuid, uuid, date, jsonb, jsonb) to authenticated;
grant execute on function public.inventory_post_stock_count_server(uuid, uuid, date, jsonb, jsonb) to authenticated;
grant execute on function public.inventory_post_adjustment(uuid) to authenticated;
grant execute on function public.inventory_post_stock_count(uuid) to authenticated;
grant execute on function public.stock_count_post_count(uuid) to authenticated;
