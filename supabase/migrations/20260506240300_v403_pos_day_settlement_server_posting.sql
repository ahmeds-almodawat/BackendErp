-- v403 POS Day Settlement Server Posting
-- Backend-authoritative POS day settlement workflow:
-- POS Day Batch -> payment settlement -> sales revenue -> VAT output -> GL posting batch + finance journal -> audit/evidence.
-- Additive and idempotent. It does not depend on browser/local state.
-- Note: COGS / recipe inventory deduction is intentionally left to the production/COGS server workflow.

create extension if not exists pgcrypto;

-- Evidence table for server-side POS day settlement posting runs.
create table if not exists public.pos_day_server_posting_events (
  id uuid primary key default gen_random_uuid(),
  source_table text not null default 'sales_pos_batches',
  pos_batch_id uuid,
  posting_batch_id uuid references public.posting_batches(id) on delete set null,
  journal_id uuid references public.finance_journal_entries_backend(id) on delete set null,
  event_type text not null,
  severity text not null default 'info' check (severity in ('info','warning','critical')),
  message text,
  details jsonb not null default '{}'::jsonb,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);

create index if not exists idx_pos_day_server_posting_events_batch
  on public.pos_day_server_posting_events(source_table, pos_batch_id, created_at desc);

alter table public.pos_day_server_posting_events enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'pos_day_server_posting_events'
      and policyname = 'pos_day_server_posting_events_read_authenticated_v403'
  ) then
    create policy pos_day_server_posting_events_read_authenticated_v403
      on public.pos_day_server_posting_events
      for select to authenticated
      using (true);
  end if;
end;
$$;

-- Compatibility columns for old and live POS batch tables.
alter table if exists public.sales_pos_batches add column if not exists fiscal_period_id uuid references public.fiscal_periods(id) on delete set null;
alter table if exists public.sales_pos_batches add column if not exists posted_at timestamptz;
alter table if exists public.sales_pos_batches add column if not exists validated_at timestamptz;
alter table if exists public.sales_pos_batches add column if not exists approved_at timestamptz;
alter table if exists public.sales_pos_batches add column if not exists metadata jsonb not null default '{}'::jsonb;
alter table if exists public.sales_pos_batches add column if not exists updated_at timestamptz not null default now();

alter table if exists public.live_pos_import_batches add column if not exists fiscal_period_id uuid references public.fiscal_periods(id) on delete set null;
alter table if exists public.live_pos_import_batches add column if not exists posting_batch_id uuid references public.posting_batches(id) on delete set null;
alter table if exists public.live_pos_import_batches add column if not exists validated_at timestamptz;
alter table if exists public.live_pos_import_batches add column if not exists approved_at timestamptz;
alter table if exists public.live_pos_import_batches add column if not exists metadata jsonb not null default '{}'::jsonb;
alter table if exists public.live_pos_import_batches add column if not exists updated_at timestamptz not null default now();

create index if not exists idx_sales_pos_batches_fiscal_period on public.sales_pos_batches(fiscal_period_id);
create index if not exists idx_sales_pos_batches_posting_batch on public.sales_pos_batches(posting_batch_id);
create index if not exists idx_live_pos_import_batches_fiscal_period on public.live_pos_import_batches(fiscal_period_id);
create index if not exists idx_live_pos_import_batches_posting_batch on public.live_pos_import_batches(posting_batch_id);

create or replace function public.pos_day_server_posting_event(
  p_source_table text,
  p_pos_batch_id uuid,
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
  insert into public.pos_day_server_posting_events(
    source_table,
    pos_batch_id,
    posting_batch_id,
    journal_id,
    event_type,
    severity,
    message,
    details,
    created_by
  ) values (
    coalesce(nullif(p_source_table, ''), 'sales_pos_batches'),
    p_pos_batch_id,
    p_posting_batch_id,
    p_journal_id,
    coalesce(nullif(p_event_type, ''), 'pos_day.posting_event'),
    coalesce(nullif(p_severity, ''), 'info'),
    p_message,
    coalesce(p_details, '{}'::jsonb),
    auth.uid()
  );
end;
$$;

create or replace function public.pos_day_payment_account(
  p_payment_method text,
  p_account_map jsonb default '{}'::jsonb
) returns text
language plpgsql
stable
set search_path = public
as $$
declare
  v_method text := lower(coalesce(p_payment_method, 'cash'));
  v_accounts jsonb := coalesce(p_account_map->'payment_accounts', '{}'::jsonb);
  v_direct text;
begin
  v_direct := nullif(v_accounts->>coalesce(p_payment_method, ''), '');
  if v_direct is not null then
    return v_direct;
  end if;

  if v_method like '%mada%' or v_method like '%card%' or v_method like '%visa%' or v_method like '%master%' or v_method like '%credit%' then
    return coalesce(nullif(p_account_map->>'card_receivable_account',''), '1130');
  end if;

  if v_method like '%aggregator%' or v_method like '%delivery%' or v_method like '%online%' or v_method like '%talabat%' or v_method like '%hunger%' then
    return coalesce(nullif(p_account_map->>'aggregator_receivable_account',''), '1140');
  end if;

  if v_method like '%bank%' or v_method like '%transfer%' then
    return coalesce(nullif(p_account_map->>'bank_account',''), '1020');
  end if;

  return coalesce(nullif(p_account_map->>'cash_account',''), '1010');
end;
$$;

create or replace function public.sales_post_pos_day_server(
  p_batch_id uuid,
  p_source_table text default 'sales_pos_batches',
  p_fiscal_period_id uuid default null,
  p_posting_date date default null,
  p_account_map jsonb default '{}'::jsonb,
  p_allow_payment_difference boolean default false
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_source_table text := coalesce(nullif(p_source_table, ''), 'sales_pos_batches');
  v_branch_id text;
  v_batch_no text;
  v_business_date date;
  v_status text;
  v_existing_posting_batch_id uuid;
  v_period_id uuid;
  v_posting_date date;
  v_batch_id uuid;
  v_journal_id uuid;
  v_gross_sales numeric := 0;
  v_discount_amount numeric := 0;
  v_refund_amount numeric := 0;
  v_vat_amount numeric := 0;
  v_revenue_amount numeric := 0;
  v_expected_settlement numeric := 0;
  v_payment_total numeric := 0;
  v_difference numeric := 0;
  v_sales_revenue_account text := coalesce(nullif(p_account_map->>'sales_revenue_account',''), '4100');
  v_vat_output_account text := coalesce(nullif(p_account_map->>'vat_output_account',''), '2200');
  v_over_short_account text := coalesce(nullif(p_account_map->>'settlement_over_short_account',''), '6990');
  v_payment record;
  v_line_no integer := 1;
  v_batch_ref text;
  v_journal_no text;
  v_validation jsonb;
begin
  if p_batch_id is null then
    return jsonb_build_object('ok', false, 'message', 'batch_id is required');
  end if;

  if v_source_table not in ('sales_pos_batches', 'live_pos_import_batches') then
    return jsonb_build_object('ok', false, 'message', 'Unsupported POS source table for server posting.', 'sourceTable', v_source_table);
  end if;

  if not (
    coalesce(public.app_current_user_has_permission('finance.post'), false)
    or coalesce(public.app_current_user_has_permission('sales.import'), false)
  ) then
    raise exception 'permission denied: finance.post or sales.import required' using errcode = '42501';
  end if;

  if v_source_table = 'sales_pos_batches' then
    select batch_no,
           branch_id,
           business_date,
           status,
           posting_batch_id,
           coalesce(total_sales, 0),
           coalesce(total_discount, 0),
           coalesce(total_refunds, 0),
           coalesce(total_tax, 0),
           coalesce(total_payments, 0),
           coalesce(fiscal_period_id, p_fiscal_period_id)
    into v_batch_no,
         v_branch_id,
         v_business_date,
         v_status,
         v_existing_posting_batch_id,
         v_gross_sales,
         v_discount_amount,
         v_refund_amount,
         v_vat_amount,
         v_payment_total,
         v_period_id
    from public.sales_pos_batches
    where id = p_batch_id
    for update;
  else
    select batch_no,
           branch_id,
           business_date,
           status,
           posting_batch_id,
           coalesce(gross_sales, 0),
           coalesce(discount_amount, 0),
           coalesce(refund_amount, 0),
           coalesce(tax_amount, 0),
           coalesce(payment_total, 0),
           coalesce(fiscal_period_id, p_fiscal_period_id)
    into v_batch_no,
         v_branch_id,
         v_business_date,
         v_status,
         v_existing_posting_batch_id,
         v_gross_sales,
         v_discount_amount,
         v_refund_amount,
         v_vat_amount,
         v_payment_total,
         v_period_id
    from public.live_pos_import_batches
    where id = p_batch_id
    for update;
  end if;

  if v_branch_id is null then
    return jsonb_build_object('ok', false, 'message', 'POS batch was not found.', 'batchId', p_batch_id, 'sourceTable', v_source_table);
  end if;

  if v_status = 'posted' then
    return jsonb_build_object(
      'ok', true,
      'alreadyPosted', true,
      'message', 'POS day settlement is already posted.',
      'batchId', p_batch_id,
      'postingBatchId', v_existing_posting_batch_id
    );
  end if;

  if v_status not in ('approved', 'validated', 'reconciled') then
    return jsonb_build_object(
      'ok', false,
      'message', 'Only approved, validated, or reconciled POS day batches can be server-posted.',
      'batchId', p_batch_id,
      'status', v_status
    );
  end if;

  if v_branch_id is null or trim(v_branch_id) = '' then
    return jsonb_build_object('ok', false, 'message', 'POS batch branch_id is required.', 'batchId', p_batch_id);
  end if;

  v_revenue_amount := greatest(v_gross_sales - v_discount_amount - v_refund_amount - v_vat_amount, 0);
  v_expected_settlement := v_revenue_amount + v_vat_amount;

  if v_payment_total = 0 then
    if v_source_table = 'sales_pos_batches' then
      select coalesce(sum(amount), 0) into v_payment_total from public.sales_pos_payments where batch_id = p_batch_id;
    else
      select coalesce(sum(amount), 0) into v_payment_total from public.live_pos_payment_lines where batch_id = p_batch_id;
    end if;
  end if;

  if v_payment_total = 0 and v_expected_settlement > 0 then
    return jsonb_build_object('ok', false, 'message', 'POS settlement requires payment lines or total payments.', 'batchId', p_batch_id, 'expectedSettlement', round(v_expected_settlement, 2));
  end if;

  v_difference := v_payment_total - v_expected_settlement;
  if abs(v_difference) > 0.05 and not p_allow_payment_difference then
    return jsonb_build_object(
      'ok', false,
      'message', 'POS payments do not reconcile to revenue plus VAT.',
      'batchId', p_batch_id,
      'paymentTotal', round(v_payment_total, 2),
      'revenueAmount', round(v_revenue_amount, 2),
      'vatAmount', round(v_vat_amount, 2),
      'expectedSettlement', round(v_expected_settlement, 2),
      'difference', round(v_difference, 2)
    );
  end if;

  select id into v_batch_id
  from public.posting_batches
  where source_type = 'sales_pos_batch'
    and source_id = p_batch_id::text
    and branch_id = v_branch_id
    and direction = 'normal'
    and status not in ('cancelled', 'voided')
  limit 1;

  if v_batch_id is not null then
    if v_source_table = 'sales_pos_batches' then
      update public.sales_pos_batches
      set status = 'posted', posting_batch_id = v_batch_id, posted_at = coalesce(posted_at, now()), updated_at = now(), metadata = coalesce(metadata, '{}'::jsonb) || jsonb_build_object('serverPostingRecoveredAt', now())
      where id = p_batch_id;
    else
      update public.live_pos_import_batches
      set status = 'posted', posting_batch_id = v_batch_id, posted_at = coalesce(posted_at, now()), updated_at = now(), metadata = coalesce(metadata, '{}'::jsonb) || jsonb_build_object('serverPostingRecoveredAt', now())
      where id = p_batch_id;
    end if;

    return jsonb_build_object('ok', true, 'alreadyPosted', true, 'message', 'Existing posting batch found and linked to POS batch.', 'batchId', p_batch_id, 'postingBatchId', v_batch_id);
  end if;

  v_posting_date := coalesce(p_posting_date, v_business_date, current_date);

  if v_period_id is null then
    select id into v_period_id
    from public.fiscal_periods
    where v_posting_date between starts_at and ends_at
      and status = 'open'
    order by starts_at desc
    limit 1;
  end if;

  if v_period_id is null then
    return jsonb_build_object('ok', false, 'message', 'No open fiscal period found for the POS settlement date.', 'batchId', p_batch_id, 'postingDate', v_posting_date);
  end if;

  v_batch_ref := 'POS-' || coalesce(v_batch_no, replace(p_batch_id::text, '-', '')) || '-' || to_char(clock_timestamp(), 'YYYYMMDDHH24MISSMS');
  v_journal_no := 'JRN-' || v_batch_ref;

  v_validation := jsonb_build_object(
    'serverPostingVersion', 'v403',
    'sourceTable', v_source_table,
    'batchNo', v_batch_no,
    'grossSales', round(v_gross_sales, 2),
    'discountAmount', round(v_discount_amount, 2),
    'refundAmount', round(v_refund_amount, 2),
    'revenueAmount', round(v_revenue_amount, 2),
    'vatAmount', round(v_vat_amount, 2),
    'paymentTotal', round(v_payment_total, 2),
    'difference', round(v_difference, 2),
    'cogsPosted', false,
    'note', 'COGS / recipe stock deduction is intentionally handled by a later production/COGS server workflow.'
  );

  insert into public.posting_batches(
    batch_ref,
    source_type,
    source_id,
    source_document_no,
    source_module,
    branch_id,
    fiscal_period_id,
    posting_date,
    status,
    direction,
    description,
    total_debit,
    total_credit,
    validation_snapshot,
    metadata,
    created_by,
    posted_at,
    last_validated_at
  ) values (
    v_batch_ref,
    'sales_pos_batch',
    p_batch_id::text,
    v_batch_no,
    'sales',
    v_branch_id,
    v_period_id,
    v_posting_date,
    'posted',
    'normal',
    'Server-posted POS day settlement ' || coalesce(v_batch_no, p_batch_id::text),
    round(greatest(v_payment_total, v_expected_settlement), 2),
    round(greatest(v_payment_total, v_expected_settlement), 2),
    v_validation,
    jsonb_build_object('serverPostingVersion', 'v403', 'sourceTable', v_source_table, 'paymentDifferenceAllowed', p_allow_payment_difference),
    auth.uid(),
    now(),
    now()
  ) returning id into v_batch_id;

  insert into public.finance_journal_entries_backend(
    journal_no,
    journal_date,
    branch_id,
    fiscal_period_id,
    source_type,
    source_id,
    description,
    status,
    posted_at,
    created_by
  ) values (
    v_journal_no,
    v_posting_date,
    v_branch_id,
    v_period_id,
    'sales_pos_batch',
    p_batch_id::text,
    'Server-posted POS day settlement ' || coalesce(v_batch_no, p_batch_id::text),
    'posted',
    now(),
    auth.uid()
  ) returning id into v_journal_id;

  -- Debit payment settlement lines from actual payment split when available.
  if v_source_table = 'sales_pos_batches' then
    for v_payment in
      select payment_method, sum(amount) as amount
      from public.sales_pos_payments
      where batch_id = p_batch_id
      group by payment_method
      having sum(amount) > 0
      order by payment_method
    loop
      insert into public.posting_batch_lines(batch_id, line_no, account_code, description, branch_id, debit, credit, source_line_id, dimensions)
      values (v_batch_id, v_line_no, public.pos_day_payment_account(v_payment.payment_method, p_account_map), 'POS payment settlement - ' || coalesce(v_payment.payment_method, 'payment'), v_branch_id, round(v_payment.amount, 2), 0, 'payment:' || coalesce(v_payment.payment_method, 'payment'), jsonb_build_object('paymentMethod', v_payment.payment_method));

      insert into public.finance_journal_lines_backend(journal_id, account_code, branch_id, debit, credit, memo)
      values (v_journal_id, public.pos_day_payment_account(v_payment.payment_method, p_account_map), v_branch_id, round(v_payment.amount, 2), 0, 'POS payment settlement - ' || coalesce(v_payment.payment_method, 'payment'));

      v_line_no := v_line_no + 1;
    end loop;
  else
    for v_payment in
      select payment_method, sum(amount) as amount
      from public.live_pos_payment_lines
      where batch_id = p_batch_id
      group by payment_method
      having sum(amount) > 0
      order by payment_method
    loop
      insert into public.posting_batch_lines(batch_id, line_no, account_code, description, branch_id, debit, credit, source_line_id, dimensions)
      values (v_batch_id, v_line_no, public.pos_day_payment_account(v_payment.payment_method, p_account_map), 'POS payment settlement - ' || coalesce(v_payment.payment_method, 'payment'), v_branch_id, round(v_payment.amount, 2), 0, 'payment:' || coalesce(v_payment.payment_method, 'payment'), jsonb_build_object('paymentMethod', v_payment.payment_method));

      insert into public.finance_journal_lines_backend(journal_id, account_code, branch_id, debit, credit, memo)
      values (v_journal_id, public.pos_day_payment_account(v_payment.payment_method, p_account_map), v_branch_id, round(v_payment.amount, 2), 0, 'POS payment settlement - ' || coalesce(v_payment.payment_method, 'payment'));

      v_line_no := v_line_no + 1;
    end loop;
  end if;

  -- Fallback one-line payment settlement if no detailed payment rows exist but header total exists.
  if v_line_no = 1 and v_payment_total > 0 then
    insert into public.posting_batch_lines(batch_id, line_no, account_code, description, branch_id, debit, credit, source_line_id, dimensions)
    values (v_batch_id, v_line_no, public.pos_day_payment_account('cash', p_account_map), 'POS payment settlement - header total', v_branch_id, round(v_payment_total, 2), 0, 'payment:header_total', jsonb_build_object('paymentMethod', 'header_total'));

    insert into public.finance_journal_lines_backend(journal_id, account_code, branch_id, debit, credit, memo)
    values (v_journal_id, public.pos_day_payment_account('cash', p_account_map), v_branch_id, round(v_payment_total, 2), 0, 'POS payment settlement - header total');

    v_line_no := v_line_no + 1;
  end if;

  if v_revenue_amount > 0 then
    insert into public.posting_batch_lines(batch_id, line_no, account_code, description, branch_id, debit, credit, source_line_id, dimensions)
    values (v_batch_id, v_line_no, v_sales_revenue_account, 'POS sales revenue', v_branch_id, 0, round(v_revenue_amount, 2), 'revenue:' || p_batch_id::text, jsonb_build_object('grossSales', v_gross_sales, 'discountAmount', v_discount_amount, 'refundAmount', v_refund_amount));

    insert into public.finance_journal_lines_backend(journal_id, account_code, branch_id, debit, credit, memo)
    values (v_journal_id, v_sales_revenue_account, v_branch_id, 0, round(v_revenue_amount, 2), 'POS sales revenue');

    v_line_no := v_line_no + 1;
  end if;

  if v_vat_amount > 0 then
    insert into public.posting_batch_lines(batch_id, line_no, account_code, description, branch_id, debit, credit, source_line_id, dimensions)
    values (v_batch_id, v_line_no, v_vat_output_account, 'VAT output on POS sales', v_branch_id, 0, round(v_vat_amount, 2), 'vat:' || p_batch_id::text, jsonb_build_object('direction', 'output'));

    insert into public.finance_journal_lines_backend(journal_id, account_code, branch_id, debit, credit, memo)
    values (v_journal_id, v_vat_output_account, v_branch_id, 0, round(v_vat_amount, 2), 'VAT output on POS sales');

    insert into public.vat_transactions(source_type, source_id, branch_id, tax_date, taxable_amount, vat_amount, direction, status)
    values ('sales_pos_batch', p_batch_id::text, v_branch_id, v_posting_date, round(v_revenue_amount, 2), round(v_vat_amount, 2), 'output', 'posted');

    v_line_no := v_line_no + 1;
  end if;


  if abs(v_difference) > 0.05 then
    if v_difference > 0 then
      insert into public.posting_batch_lines(batch_id, line_no, account_code, description, branch_id, debit, credit, source_line_id, dimensions)
      values (v_batch_id, v_line_no, v_over_short_account, 'POS settlement over / rounding difference', v_branch_id, 0, round(abs(v_difference), 2), 'difference:' || p_batch_id::text, jsonb_build_object('difference', v_difference));

      insert into public.finance_journal_lines_backend(journal_id, account_code, branch_id, debit, credit, memo)
      values (v_journal_id, v_over_short_account, v_branch_id, 0, round(abs(v_difference), 2), 'POS settlement over / rounding difference');
    else
      insert into public.posting_batch_lines(batch_id, line_no, account_code, description, branch_id, debit, credit, source_line_id, dimensions)
      values (v_batch_id, v_line_no, v_over_short_account, 'POS settlement shortage / rounding difference', v_branch_id, round(abs(v_difference), 2), 0, 'difference:' || p_batch_id::text, jsonb_build_object('difference', v_difference));

      insert into public.finance_journal_lines_backend(journal_id, account_code, branch_id, debit, credit, memo)
      values (v_journal_id, v_over_short_account, v_branch_id, round(abs(v_difference), 2), 0, 'POS settlement shortage / rounding difference');
    end if;

    v_line_no := v_line_no + 1;
  end if;

  if v_source_table = 'sales_pos_batches' then
    update public.sales_pos_batches
    set status = 'posted',
        posting_batch_id = v_batch_id,
        fiscal_period_id = v_period_id,
        posted_at = now(),
        updated_at = now(),
        metadata = coalesce(metadata, '{}'::jsonb) || jsonb_build_object('serverPostingVersion', 'v403', 'journalId', v_journal_id, 'validation', v_validation)
    where id = p_batch_id;
  else
    update public.live_pos_import_batches
    set status = 'posted',
        posting_batch_id = v_batch_id,
        fiscal_period_id = v_period_id,
        posted_at = now(),
        updated_at = now(),
        metadata = coalesce(metadata, '{}'::jsonb) || jsonb_build_object('serverPostingVersion', 'v403', 'journalId', v_journal_id, 'validation', v_validation)
    where id = p_batch_id;
  end if;

  perform public.pos_day_server_posting_event(
    v_source_table,
    p_batch_id,
    v_batch_id,
    v_journal_id,
    'pos_day.server_posted',
    'info',
    'POS day settlement server-posted successfully.',
    v_validation
  );

  return jsonb_build_object(
    'ok', true,
    'message', 'POS day settlement server-posted successfully.',
    'batchId', p_batch_id,
    'sourceTable', v_source_table,
    'postingBatchId', v_batch_id,
    'journalId', v_journal_id,
    'fiscalPeriodId', v_period_id,
    'revenueAmount', round(v_revenue_amount, 2),
    'vatAmount', round(v_vat_amount, 2),
    'paymentTotal', round(v_payment_total, 2),
    'paymentDifference', round(v_difference, 2),
    'cogsPosted', false
  );
exception
  when others then
    perform public.pos_day_server_posting_event(v_source_table, p_batch_id, null, null, 'pos_day.server_posting_failed', 'critical', sqlerrm, jsonb_build_object('sqlstate', sqlstate));
    raise;
end;
$$;

-- Replace old wrappers so existing callers are routed into the backend-authoritative workflow.
create or replace function public.sales_post_pos_batch(batch_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  return public.sales_post_pos_day_server(batch_id, 'sales_pos_batches');
end;
$$;

create or replace function public.live_sales_post_pos_batch(batch_id uuid, posting_options jsonb default '{}'::jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  return public.sales_post_pos_day_server(
    batch_id,
    'live_pos_import_batches',
    null,
    null,
    coalesce(posting_options, '{}'::jsonb),
    coalesce((posting_options->>'allow_payment_difference')::boolean, false)
  );
end;
$$;

revoke all on function public.pos_day_server_posting_event(text, uuid, uuid, uuid, text, text, text, jsonb) from public, anon;
revoke all on function public.pos_day_payment_account(text, jsonb) from public, anon;
revoke all on function public.sales_post_pos_day_server(uuid, text, uuid, date, jsonb, boolean) from public, anon;
revoke all on function public.sales_post_pos_batch(uuid) from public, anon;
revoke all on function public.live_sales_post_pos_batch(uuid, jsonb) from public, anon;

grant execute on function public.pos_day_payment_account(text, jsonb) to authenticated;
grant execute on function public.sales_post_pos_day_server(uuid, text, uuid, date, jsonb, boolean) to authenticated;
grant execute on function public.sales_post_pos_batch(uuid) to authenticated;
grant execute on function public.live_sales_post_pos_batch(uuid, jsonb) to authenticated;
