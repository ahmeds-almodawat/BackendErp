-- v404 Production Batch / Recipe Consumption Server Posting
-- Backend-authoritative production workflow:
-- Production Batch -> raw material consumption -> finished/semi-finished output -> inventory movement/balance -> GL posting batch + finance journal -> audit/evidence.
-- Additive and idempotent. It does not post sales COGS; it posts production/recipe consumption and output only.

create extension if not exists pgcrypto;

-- Evidence table for server-side production posting runs.
create table if not exists public.production_batch_server_posting_events (
  id uuid primary key default gen_random_uuid(),
  production_batch_id uuid,
  posting_batch_id uuid,
  journal_id uuid,
  event_type text not null,
  severity text not null default 'info' check (severity in ('info','warning','critical')),
  message text,
  details jsonb not null default '{}'::jsonb,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);

create index if not exists idx_production_batch_server_posting_events_batch
  on public.production_batch_server_posting_events(production_batch_id, created_at desc);

alter table public.production_batch_server_posting_events enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'production_batch_server_posting_events'
      and policyname = 'production_batch_server_posting_events_read_authenticated_v404'
  ) then
    create policy production_batch_server_posting_events_read_authenticated_v404
      on public.production_batch_server_posting_events
      for select to authenticated
      using (true);
  end if;
end;
$$;

-- Canonical compatibility tables for production batches if earlier migrations did not create them.
create table if not exists public.production_batches (
  id uuid primary key default gen_random_uuid(),
  batch_no text,
  branch_id text,
  store_id text,
  status text not null default 'draft',
  production_date date not null default current_date,
  fiscal_period_id uuid,
  posting_batch_id uuid,
  posted_at timestamptz,
  total_input_cost numeric not null default 0,
  total_output_cost numeric not null default 0,
  variance_amount numeric not null default 0,
  metadata jsonb not null default '{}'::jsonb,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.production_batch_inputs (
  id uuid primary key default gen_random_uuid(),
  batch_id uuid not null,
  item_id text not null,
  store_id text,
  quantity numeric not null default 0,
  unit_cost numeric not null default 0,
  amount numeric not null default 0,
  account_code text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.production_batch_outputs (
  id uuid primary key default gen_random_uuid(),
  batch_id uuid not null,
  item_id text not null,
  store_id text,
  quantity numeric not null default 0,
  unit_cost numeric not null default 0,
  amount numeric not null default 0,
  account_code text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

-- Compatibility columns for production posting.
alter table if exists public.production_batches add column if not exists batch_no text;
alter table if exists public.production_batches add column if not exists branch_id text;
alter table if exists public.production_batches add column if not exists store_id text;
alter table if exists public.production_batches add column if not exists status text not null default 'draft';
alter table if exists public.production_batches add column if not exists production_date date not null default current_date;
alter table if exists public.production_batches add column if not exists fiscal_period_id uuid;
alter table if exists public.production_batches add column if not exists posting_batch_id uuid;
alter table if exists public.production_batches add column if not exists posted_at timestamptz;
alter table if exists public.production_batches add column if not exists total_input_cost numeric not null default 0;
alter table if exists public.production_batches add column if not exists total_output_cost numeric not null default 0;
alter table if exists public.production_batches add column if not exists variance_amount numeric not null default 0;
alter table if exists public.production_batches add column if not exists metadata jsonb not null default '{}'::jsonb;
alter table if exists public.production_batches add column if not exists updated_at timestamptz not null default now();

alter table if exists public.production_batch_inputs add column if not exists batch_id uuid;
alter table if exists public.production_batch_inputs add column if not exists item_id text;
alter table if exists public.production_batch_inputs add column if not exists store_id text;
alter table if exists public.production_batch_inputs add column if not exists quantity numeric not null default 0;
alter table if exists public.production_batch_inputs add column if not exists unit_cost numeric not null default 0;
alter table if exists public.production_batch_inputs add column if not exists amount numeric not null default 0;
alter table if exists public.production_batch_inputs add column if not exists account_code text;
alter table if exists public.production_batch_inputs add column if not exists metadata jsonb not null default '{}'::jsonb;

alter table if exists public.production_batch_outputs add column if not exists batch_id uuid;
alter table if exists public.production_batch_outputs add column if not exists item_id text;
alter table if exists public.production_batch_outputs add column if not exists store_id text;
alter table if exists public.production_batch_outputs add column if not exists quantity numeric not null default 0;
alter table if exists public.production_batch_outputs add column if not exists unit_cost numeric not null default 0;
alter table if exists public.production_batch_outputs add column if not exists amount numeric not null default 0;
alter table if exists public.production_batch_outputs add column if not exists account_code text;
alter table if exists public.production_batch_outputs add column if not exists metadata jsonb not null default '{}'::jsonb;

-- Canonical inventory and finance compatibility for production posting.
create table if not exists public.inventory_stock_movements (
  id uuid primary key default gen_random_uuid(),
  movement_no text,
  source_type text not null,
  source_id text not null,
  branch_id text,
  store_id text,
  item_id text not null,
  movement_date date not null default current_date,
  quantity numeric not null default 0,
  unit_cost numeric not null default 0,
  amount numeric not null default 0,
  direction text not null default 'out',
  fiscal_period_id uuid,
  posting_batch_id uuid,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.inventory_stock_balances (
  id uuid primary key default gen_random_uuid(),
  branch_id text,
  store_id text,
  item_id text not null,
  quantity_on_hand numeric not null default 0,
  average_cost numeric not null default 0,
  inventory_value numeric not null default 0,
  updated_at timestamptz not null default now()
);

create unique index if not exists inventory_stock_balances_scope_item_uidx
  on public.inventory_stock_balances(branch_id, store_id, item_id);

create index if not exists idx_inventory_stock_movements_production_source
  on public.inventory_stock_movements(source_type, source_id, created_at desc);

alter table if exists public.posting_batches add column if not exists source_type text;
alter table if exists public.posting_batches add column if not exists source_id text;
alter table if exists public.posting_batches add column if not exists branch_id text;
alter table if exists public.posting_batches add column if not exists fiscal_period_id uuid;
alter table if exists public.posting_batches add column if not exists posting_date date;
alter table if exists public.posting_batches add column if not exists batch_no text;
alter table if exists public.posting_batches add column if not exists batch_ref text;
alter table if exists public.posting_batches add column if not exists direction text not null default 'normal';
alter table if exists public.posting_batches add column if not exists status text not null default 'posted';
alter table if exists public.posting_batches add column if not exists total_debit numeric not null default 0;
alter table if exists public.posting_batches add column if not exists total_credit numeric not null default 0;
alter table if exists public.posting_batches add column if not exists metadata jsonb not null default '{}'::jsonb;
alter table if exists public.posting_batches add column if not exists posted_at timestamptz;
alter table if exists public.posting_batches add column if not exists created_by uuid;

alter table if exists public.posting_batch_lines add column if not exists posting_batch_id uuid;
alter table if exists public.posting_batch_lines add column if not exists line_no integer;
alter table if exists public.posting_batch_lines add column if not exists account_code text;
alter table if exists public.posting_batch_lines add column if not exists description text;
alter table if exists public.posting_batch_lines add column if not exists debit numeric not null default 0;
alter table if exists public.posting_batch_lines add column if not exists credit numeric not null default 0;
alter table if exists public.posting_batch_lines add column if not exists branch_id text;
alter table if exists public.posting_batch_lines add column if not exists fiscal_period_id uuid;
alter table if exists public.posting_batch_lines add column if not exists source_type text;
alter table if exists public.posting_batch_lines add column if not exists source_id text;
alter table if exists public.posting_batch_lines add column if not exists metadata jsonb not null default '{}'::jsonb;

alter table if exists public.finance_journal_entries_backend add column if not exists journal_no text;
alter table if exists public.finance_journal_entries_backend add column if not exists posting_batch_id uuid;
alter table if exists public.finance_journal_entries_backend add column if not exists branch_id text;
alter table if exists public.finance_journal_entries_backend add column if not exists fiscal_period_id uuid;
alter table if exists public.finance_journal_entries_backend add column if not exists posting_date date;
alter table if exists public.finance_journal_entries_backend add column if not exists status text not null default 'posted';
alter table if exists public.finance_journal_entries_backend add column if not exists description text;
alter table if exists public.finance_journal_entries_backend add column if not exists total_debit numeric not null default 0;
alter table if exists public.finance_journal_entries_backend add column if not exists total_credit numeric not null default 0;
alter table if exists public.finance_journal_entries_backend add column if not exists metadata jsonb not null default '{}'::jsonb;

alter table if exists public.finance_journal_lines_backend add column if not exists journal_id uuid;
alter table if exists public.finance_journal_lines_backend add column if not exists posting_batch_id uuid;
alter table if exists public.finance_journal_lines_backend add column if not exists line_no integer;
alter table if exists public.finance_journal_lines_backend add column if not exists account_code text;
alter table if exists public.finance_journal_lines_backend add column if not exists description text;
alter table if exists public.finance_journal_lines_backend add column if not exists debit numeric not null default 0;
alter table if exists public.finance_journal_lines_backend add column if not exists credit numeric not null default 0;
alter table if exists public.finance_journal_lines_backend add column if not exists branch_id text;
alter table if exists public.finance_journal_lines_backend add column if not exists fiscal_period_id uuid;
alter table if exists public.finance_journal_lines_backend add column if not exists metadata jsonb not null default '{}'::jsonb;

create index if not exists idx_production_batches_posting_batch on public.production_batches(posting_batch_id);
create index if not exists idx_production_batch_inputs_batch on public.production_batch_inputs(batch_id);
create index if not exists idx_production_batch_outputs_batch on public.production_batch_outputs(batch_id);

create or replace function public.production_batch_server_posting_event(
  p_production_batch_id uuid,
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
  insert into public.production_batch_server_posting_events(
    production_batch_id,
    posting_batch_id,
    journal_id,
    event_type,
    severity,
    message,
    details,
    created_by
  ) values (
    p_production_batch_id,
    p_posting_batch_id,
    p_journal_id,
    coalesce(nullif(p_event_type, ''), 'production_batch.posting_event'),
    coalesce(nullif(p_severity, ''), 'info'),
    p_message,
    coalesce(p_details, '{}'::jsonb),
    auth.uid()
  );
end;
$$;

create or replace function public.production_post_batch_server(
  p_batch_id uuid,
  p_fiscal_period_id uuid default null,
  p_posting_date date default null,
  p_account_map jsonb default '{}'
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_batch public.production_batches%rowtype;
  v_period_id uuid;
  v_posting_date date;
  v_posting_batch_id uuid;
  v_journal_id uuid;
  v_input_count integer := 0;
  v_output_count integer := 0;
  v_input_amount numeric := 0;
  v_output_amount numeric := 0;
  v_variance numeric := 0;
  v_total_debit numeric := 0;
  v_total_credit numeric := 0;
  v_raw_material_account text := coalesce(nullif(p_account_map->>'raw_material_inventory_account',''), '1200');
  v_finished_goods_account text := coalesce(nullif(p_account_map->>'finished_goods_inventory_account',''), '1210');
  v_variance_account text := coalesce(nullif(p_account_map->>'production_variance_account',''), '5900');
  v_batch_ref text;
  v_journal_no text;
  v_movement_no text;
  v_line_no integer := 1;
  v_input record;
  v_output record;
  v_validation jsonb;
begin
  if p_batch_id is null then
    return jsonb_build_object('ok', false, 'message', 'batch_id is required');
  end if;

  if not (
    coalesce(public.app_current_user_has_permission('finance.post'), false)
    or coalesce(public.app_current_user_has_permission('inventory.adjust'), false)
    or coalesce(public.app_current_user_has_permission('production.post'), false)
  ) then
    raise exception 'permission denied: finance.post, inventory.adjust, or production.post required' using errcode = '42501';
  end if;

  select * into v_batch
  from public.production_batches
  where id = p_batch_id
  for update;

  if not found then
    return jsonb_build_object('ok', false, 'message', 'Production batch was not found.', 'batchId', p_batch_id);
  end if;

  if v_batch.status = 'posted' then
    return jsonb_build_object(
      'ok', true,
      'alreadyPosted', true,
      'message', 'Production batch is already posted.',
      'batchId', v_batch.id,
      'postingBatchId', v_batch.posting_batch_id
    );
  end if;

  if v_batch.status not in ('approved','validated','released','completed') then
    return jsonb_build_object(
      'ok', false,
      'message', 'Only approved, validated, released, or completed production batches can be server-posted.',
      'batchId', v_batch.id,
      'status', v_batch.status
    );
  end if;

  if v_batch.branch_id is null or trim(v_batch.branch_id) = '' then
    return jsonb_build_object('ok', false, 'message', 'Production batch branch_id is required.', 'batchId', v_batch.id);
  end if;

  if v_batch.store_id is null or trim(v_batch.store_id) = '' then
    return jsonb_build_object('ok', false, 'message', 'Production batch store_id is required.', 'batchId', v_batch.id);
  end if;

  select count(*), coalesce(sum(case when coalesce(amount,0) <> 0 then amount else quantity * unit_cost end), 0)
  into v_input_count, v_input_amount
  from public.production_batch_inputs
  where batch_id = v_batch.id;

  select count(*), coalesce(sum(case when coalesce(amount,0) <> 0 then amount else quantity * unit_cost end), 0)
  into v_output_count, v_output_amount
  from public.production_batch_outputs
  where batch_id = v_batch.id;

  if v_input_count = 0 then
    return jsonb_build_object('ok', false, 'message', 'Production batch has no raw material input lines.', 'batchId', v_batch.id);
  end if;

  if v_output_count = 0 then
    return jsonb_build_object('ok', false, 'message', 'Production batch has no output lines.', 'batchId', v_batch.id);
  end if;

  if v_input_amount <= 0 then
    return jsonb_build_object('ok', false, 'message', 'Production batch input cost must be greater than zero.', 'batchId', v_batch.id, 'inputAmount', v_input_amount);
  end if;

  if v_output_amount <= 0 then
    v_output_amount := v_input_amount;
  end if;

  v_variance := v_output_amount - v_input_amount;
  v_total_debit := v_output_amount + case when v_variance < 0 then abs(v_variance) else 0 end;
  v_total_credit := v_input_amount + case when v_variance > 0 then v_variance else 0 end;

  if abs(v_total_debit - v_total_credit) > 0.05 then
    return jsonb_build_object(
      'ok', false,
      'message', 'Production posting is not balanced.',
      'batchId', v_batch.id,
      'totalDebit', round(v_total_debit, 2),
      'totalCredit', round(v_total_credit, 2),
      'difference', round(v_total_debit - v_total_credit, 2)
    );
  end if;

  select id into v_posting_batch_id
  from public.posting_batches
  where source_type = 'production_batch'
    and source_id = v_batch.id::text
    and branch_id = v_batch.branch_id
    and direction = 'normal'
    and status not in ('cancelled', 'voided')
  limit 1;

  if v_posting_batch_id is not null then
    update public.production_batches
    set status = 'posted',
        posting_batch_id = v_posting_batch_id,
        posted_at = coalesce(posted_at, now()),
        total_input_cost = v_input_amount,
        total_output_cost = v_output_amount,
        variance_amount = v_variance,
        updated_at = now(),
        metadata = coalesce(metadata, '{}'::jsonb) || jsonb_build_object('serverPostingRecoveredAt', now())
    where id = v_batch.id;

    return jsonb_build_object(
      'ok', true,
      'alreadyPosted', true,
      'message', 'Existing production posting batch found and linked.',
      'batchId', v_batch.id,
      'postingBatchId', v_posting_batch_id
    );
  end if;

  if p_fiscal_period_id is not null then
    v_period_id := p_fiscal_period_id;
  else
    select id into v_period_id
    from public.fiscal_periods
    where status = 'open'
      and coalesce(p_posting_date, v_batch.production_date, current_date) between starts_at and ends_at
    order by starts_at desc
    limit 1;
  end if;

  if v_period_id is null then
    return jsonb_build_object('ok', false, 'message', 'No open fiscal period found for production posting date.', 'batchId', v_batch.id);
  end if;

  v_posting_date := coalesce(p_posting_date, v_batch.production_date, current_date);
  v_batch_ref := 'PROD-' || coalesce(v_batch.batch_no, v_batch.id::text);
  v_journal_no := 'JE-PROD-' || to_char(now(), 'YYYYMMDDHH24MISSMS');

  insert into public.posting_batches(
    batch_no,
    batch_ref,
    source_type,
    source_id,
    branch_id,
    fiscal_period_id,
    posting_date,
    direction,
    status,
    total_debit,
    total_credit,
    metadata,
    posted_at,
    created_by
  ) values (
    v_batch_ref,
    v_batch_ref,
    'production_batch',
    v_batch.id::text,
    v_batch.branch_id,
    v_period_id,
    v_posting_date,
    'normal',
    'posted',
    round(v_total_debit, 2),
    round(v_total_credit, 2),
    jsonb_build_object('serverPostingVersion','v404','inputAmount',v_input_amount,'outputAmount',v_output_amount,'varianceAmount',v_variance),
    now(),
    auth.uid()
  ) returning id into v_posting_batch_id;

  -- Debit finished/semi-finished goods output.
  insert into public.posting_batch_lines(posting_batch_id, line_no, account_code, description, debit, credit, branch_id, fiscal_period_id, source_type, source_id, metadata)
  values (v_posting_batch_id, v_line_no, v_finished_goods_account, 'Production output inventory value', round(v_output_amount, 2), 0, v_batch.branch_id, v_period_id, 'production_batch', v_batch.id::text, jsonb_build_object('lineType','production_output'));
  v_line_no := v_line_no + 1;

  -- Credit raw material inventory consumed.
  insert into public.posting_batch_lines(posting_batch_id, line_no, account_code, description, debit, credit, branch_id, fiscal_period_id, source_type, source_id, metadata)
  values (v_posting_batch_id, v_line_no, v_raw_material_account, 'Raw material consumption for production', 0, round(v_input_amount, 2), v_batch.branch_id, v_period_id, 'production_batch', v_batch.id::text, jsonb_build_object('lineType','raw_material_consumption'));
  v_line_no := v_line_no + 1;

  if abs(v_variance) > 0.05 then
    insert into public.posting_batch_lines(posting_batch_id, line_no, account_code, description, debit, credit, branch_id, fiscal_period_id, source_type, source_id, metadata)
    values (
      v_posting_batch_id,
      v_line_no,
      v_variance_account,
      'Production yield/cost variance',
      case when v_variance < 0 then round(abs(v_variance), 2) else 0 end,
      case when v_variance > 0 then round(v_variance, 2) else 0 end,
      v_batch.branch_id,
      v_period_id,
      'production_batch',
      v_batch.id::text,
      jsonb_build_object('lineType','production_variance')
    );
    v_line_no := v_line_no + 1;
  end if;

  insert into public.finance_journal_entries_backend(
    journal_no,
    posting_batch_id,
    branch_id,
    fiscal_period_id,
    posting_date,
    status,
    description,
    total_debit,
    total_credit,
    metadata
  ) values (
    v_journal_no,
    v_posting_batch_id,
    v_batch.branch_id,
    v_period_id,
    v_posting_date,
    'posted',
    'Server-posted production batch ' || coalesce(v_batch.batch_no, v_batch.id::text),
    round(v_total_debit, 2),
    round(v_total_credit, 2),
    jsonb_build_object('sourceType','production_batch','sourceId',v_batch.id,'serverPostingVersion','v404')
  ) returning id into v_journal_id;

  insert into public.finance_journal_lines_backend(journal_id, posting_batch_id, line_no, account_code, description, debit, credit, branch_id, fiscal_period_id, metadata)
  select v_journal_id, posting_batch_id, line_no, account_code, description, debit, credit, branch_id, fiscal_period_id, metadata
  from public.posting_batch_lines
  where posting_batch_id = v_posting_batch_id
  order by line_no;

  -- Inventory movements and balance updates for raw material consumption.
  for v_input in
    select item_id,
           coalesce(store_id, v_batch.store_id) as store_id,
           coalesce(quantity, 0) as quantity,
           case when coalesce(unit_cost,0) <> 0 then unit_cost else case when coalesce(quantity,0) <> 0 then (case when coalesce(amount,0) <> 0 then amount else quantity * unit_cost end) / nullif(quantity,0) else 0 end end as unit_cost,
           case when coalesce(amount,0) <> 0 then amount else quantity * unit_cost end as amount
    from public.production_batch_inputs
    where batch_id = v_batch.id
  loop
    v_movement_no := 'PROD-CONS-' || substr(replace(gen_random_uuid()::text,'-',''), 1, 12);

    insert into public.inventory_stock_movements(movement_no, source_type, source_id, branch_id, store_id, item_id, movement_date, quantity, unit_cost, amount, direction, fiscal_period_id, posting_batch_id, metadata)
    values (v_movement_no, 'production_batch', v_batch.id::text, v_batch.branch_id, v_input.store_id, v_input.item_id, v_posting_date, -abs(v_input.quantity), v_input.unit_cost, -abs(v_input.amount), 'out', v_period_id, v_posting_batch_id, jsonb_build_object('lineType','raw_material_consumption'));

    insert into public.inventory_stock_balances(branch_id, store_id, item_id, quantity_on_hand, average_cost, inventory_value, updated_at)
    values (v_batch.branch_id, v_input.store_id, v_input.item_id, -abs(v_input.quantity), v_input.unit_cost, -abs(v_input.amount), now())
    on conflict (branch_id, store_id, item_id) do update
      set quantity_on_hand = public.inventory_stock_balances.quantity_on_hand - abs(excluded.quantity_on_hand),
          inventory_value = public.inventory_stock_balances.inventory_value - abs(excluded.inventory_value),
          average_cost = case when abs(public.inventory_stock_balances.quantity_on_hand - abs(excluded.quantity_on_hand)) > 0 then abs((public.inventory_stock_balances.inventory_value - abs(excluded.inventory_value)) / nullif(public.inventory_stock_balances.quantity_on_hand - abs(excluded.quantity_on_hand), 0)) else public.inventory_stock_balances.average_cost end,
          updated_at = now();
  end loop;

  -- Inventory movements and balance updates for production output.
  for v_output in
    select item_id,
           coalesce(store_id, v_batch.store_id) as store_id,
           coalesce(quantity, 0) as quantity,
           case when coalesce(unit_cost,0) <> 0 then unit_cost else case when coalesce(quantity,0) <> 0 then (case when coalesce(amount,0) <> 0 then amount else quantity * unit_cost end) / nullif(quantity,0) else 0 end end as unit_cost,
           case when coalesce(amount,0) <> 0 then amount else quantity * unit_cost end as amount
    from public.production_batch_outputs
    where batch_id = v_batch.id
  loop
    v_movement_no := 'PROD-OUT-' || substr(replace(gen_random_uuid()::text,'-',''), 1, 12);

    insert into public.inventory_stock_movements(movement_no, source_type, source_id, branch_id, store_id, item_id, movement_date, quantity, unit_cost, amount, direction, fiscal_period_id, posting_batch_id, metadata)
    values (v_movement_no, 'production_batch', v_batch.id::text, v_batch.branch_id, v_output.store_id, v_output.item_id, v_posting_date, abs(v_output.quantity), v_output.unit_cost, abs(v_output.amount), 'in', v_period_id, v_posting_batch_id, jsonb_build_object('lineType','production_output'));

    insert into public.inventory_stock_balances(branch_id, store_id, item_id, quantity_on_hand, average_cost, inventory_value, updated_at)
    values (v_batch.branch_id, v_output.store_id, v_output.item_id, abs(v_output.quantity), v_output.unit_cost, abs(v_output.amount), now())
    on conflict (branch_id, store_id, item_id) do update
      set quantity_on_hand = public.inventory_stock_balances.quantity_on_hand + abs(excluded.quantity_on_hand),
          inventory_value = public.inventory_stock_balances.inventory_value + abs(excluded.inventory_value),
          average_cost = case when abs(public.inventory_stock_balances.quantity_on_hand + abs(excluded.quantity_on_hand)) > 0 then abs((public.inventory_stock_balances.inventory_value + abs(excluded.inventory_value)) / nullif(public.inventory_stock_balances.quantity_on_hand + abs(excluded.quantity_on_hand), 0)) else excluded.average_cost end,
          updated_at = now();
  end loop;

  update public.production_batches
  set status = 'posted',
      posting_batch_id = v_posting_batch_id,
      fiscal_period_id = v_period_id,
      posted_at = now(),
      total_input_cost = round(v_input_amount, 2),
      total_output_cost = round(v_output_amount, 2),
      variance_amount = round(v_variance, 2),
      updated_at = now(),
      metadata = coalesce(metadata, '{}'::jsonb) || jsonb_build_object(
        'serverPostedAt', now(),
        'serverPostingVersion', 'v404',
        'journalId', v_journal_id,
        'inputAmount', round(v_input_amount, 2),
        'outputAmount', round(v_output_amount, 2),
        'varianceAmount', round(v_variance, 2)
      )
  where id = v_batch.id;

  perform public.production_batch_server_posting_event(
    v_batch.id,
    v_posting_batch_id,
    v_journal_id,
    'production_batch.posted',
    'info',
    'Production batch server posting completed.',
    jsonb_build_object(
      'inputCount', v_input_count,
      'outputCount', v_output_count,
      'inputAmount', round(v_input_amount, 2),
      'outputAmount', round(v_output_amount, 2),
      'varianceAmount', round(v_variance, 2),
      'postingDate', v_posting_date
    )
  );

  v_validation := jsonb_build_object(
    'balanced', abs(v_total_debit - v_total_credit) <= 0.05,
    'totalDebit', round(v_total_debit, 2),
    'totalCredit', round(v_total_credit, 2),
    'inputAmount', round(v_input_amount, 2),
    'outputAmount', round(v_output_amount, 2),
    'varianceAmount', round(v_variance, 2)
  );

  return jsonb_build_object(
    'ok', true,
    'message', 'Production batch posted server-side.',
    'batchId', v_batch.id,
    'postingBatchId', v_posting_batch_id,
    'journalId', v_journal_id,
    'validation', v_validation
  );
exception when others then
  perform public.production_batch_server_posting_event(
    p_batch_id,
    null,
    null,
    'production_batch.failed',
    'critical',
    SQLERRM,
    jsonb_build_object('sqlstate', SQLSTATE)
  );
  raise;
end;
$$;

-- Compatibility wrappers for existing callers.
create or replace function public.production_post_batch(batch_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  return public.production_post_batch_server(batch_id);
end;
$$;

create or replace function public.production_post_production_batch(batch_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  return public.production_post_batch_server(batch_id);
end;
$$;

create or replace function public.live_production_post_batch(batch_id uuid, posting_options jsonb default '{}'::jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  return public.production_post_batch_server(batch_id, null, null, coalesce(posting_options, '{}'::jsonb));
end;
$$;

do $$
begin
  if to_regprocedure('public.production_post_batch_server(uuid, uuid, date, jsonb)') is not null then
    execute 'revoke execute on function public.production_post_batch_server(uuid, uuid, date, jsonb) from public';
    execute 'grant execute on function public.production_post_batch_server(uuid, uuid, date, jsonb) to authenticated';
  end if;

  if to_regprocedure('public.production_post_batch(uuid)') is not null then
    execute 'grant execute on function public.production_post_batch(uuid) to authenticated';
  end if;

  if to_regprocedure('public.production_post_production_batch(uuid)') is not null then
    execute 'grant execute on function public.production_post_production_batch(uuid) to authenticated';
  end if;

  if to_regprocedure('public.live_production_post_batch(uuid, jsonb)') is not null then
    execute 'grant execute on function public.live_production_post_batch(uuid, jsonb) to authenticated';
  end if;
end;
$$;
