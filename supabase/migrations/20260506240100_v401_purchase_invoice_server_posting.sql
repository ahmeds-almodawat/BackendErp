-- v401 Purchase Invoice Server Posting
-- First backend-authoritative workflow:
-- Purchase Invoice -> Inventory movement/balance -> AP subledger -> VAT input -> GL posting batch + finance journal.
-- Additive and idempotent. It does not depend on browser/local state.

create extension if not exists pgcrypto;

-- Evidence table for server-side posting runs.
create table if not exists public.purchase_invoice_server_posting_events (
  id uuid primary key default gen_random_uuid(),
  purchase_invoice_id uuid references public.purchase_invoices(id) on delete set null,
  posting_batch_id uuid references public.posting_batches(id) on delete set null,
  journal_id uuid references public.finance_journal_entries_backend(id) on delete set null,
  event_type text not null,
  severity text not null default 'info' check (severity in ('info','warning','critical')),
  message text,
  details jsonb not null default '{}'::jsonb,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);

create index if not exists idx_purchase_invoice_server_posting_events_invoice
  on public.purchase_invoice_server_posting_events(purchase_invoice_id, created_at desc);

alter table public.purchase_invoice_server_posting_events enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'purchase_invoice_server_posting_events'
      and policyname = 'purchase_invoice_server_posting_events_read_authenticated_v401'
  ) then
    create policy purchase_invoice_server_posting_events_read_authenticated_v401
      on public.purchase_invoice_server_posting_events
      for select to authenticated
      using (true);
  end if;
end;
$$;

-- Compatibility columns for invoice posting evidence.
alter table if exists public.purchase_invoices add column if not exists fiscal_period_id uuid references public.fiscal_periods(id) on delete set null;
alter table if exists public.purchase_invoices add column if not exists posted_at timestamptz;
alter table if exists public.purchase_invoices add column if not exists validated_at timestamptz;
alter table if exists public.purchase_invoices add column if not exists approved_at timestamptz;
alter table if exists public.purchase_invoices add column if not exists metadata jsonb not null default '{}'::jsonb;
alter table if exists public.purchase_invoice_lines add column if not exists metadata jsonb not null default '{}'::jsonb;

create index if not exists idx_purchase_invoices_fiscal_period on public.purchase_invoices(fiscal_period_id);
create index if not exists idx_purchase_invoices_posting_batch on public.purchase_invoices(posting_batch_id);

create or replace function public.purchase_invoice_server_posting_event(
  p_purchase_invoice_id uuid,
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
  insert into public.purchase_invoice_server_posting_events(
    purchase_invoice_id,
    posting_batch_id,
    journal_id,
    event_type,
    severity,
    message,
    details,
    created_by
  ) values (
    p_purchase_invoice_id,
    p_posting_batch_id,
    p_journal_id,
    coalesce(nullif(p_event_type, ''), 'purchase_invoice.posting_event'),
    coalesce(nullif(p_severity, ''), 'info'),
    p_message,
    coalesce(p_details, '{}'::jsonb),
    auth.uid()
  );
end;
$$;

create or replace function public.purchasing_post_purchase_invoice_server(
  p_invoice_id uuid,
  p_fiscal_period_id uuid default null,
  p_posting_date date default null,
  p_account_map jsonb default '{}'::jsonb
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_invoice public.purchase_invoices%rowtype;
  v_period_id uuid;
  v_posting_date date;
  v_batch_id uuid;
  v_journal_id uuid;
  v_lock_id uuid;
  v_line_count integer := 0;
  v_net_amount numeric := 0;
  v_line_tax_amount numeric := 0;
  v_vat_amount numeric := 0;
  v_ap_amount numeric := 0;
  v_total_debit numeric := 0;
  v_total_credit numeric := 0;
  v_inventory_account text := coalesce(nullif(p_account_map->>'inventory_account',''), '1200');
  v_vat_input_account text := coalesce(nullif(p_account_map->>'vat_input_account',''), '1310');
  v_ap_account text := coalesce(nullif(p_account_map->>'ap_account',''), '2100');
  v_validation jsonb;
  v_line record;
  v_movement_no text;
  v_journal_no text;
  v_batch_ref text;
begin
  if p_invoice_id is null then
    return jsonb_build_object('ok', false, 'message', 'invoice_id is required');
  end if;

  if not (
    coalesce(public.app_current_user_has_permission('finance.post'), false)
    or coalesce(public.app_current_user_has_permission('purchasing.approve'), false)
  ) then
    raise exception 'permission denied: finance.post or purchasing.approve required' using errcode = '42501';
  end if;

  select * into v_invoice
  from public.purchase_invoices
  where id = p_invoice_id
  for update;

  if not found then
    return jsonb_build_object('ok', false, 'message', 'Purchase invoice was not found.', 'invoiceId', p_invoice_id);
  end if;

  if v_invoice.status = 'posted' then
    return jsonb_build_object(
      'ok', true,
      'alreadyPosted', true,
      'message', 'Purchase invoice is already posted.',
      'invoiceId', v_invoice.id,
      'postingBatchId', v_invoice.posting_batch_id
    );
  end if;

  if v_invoice.status not in ('approved', 'validated') then
    return jsonb_build_object(
      'ok', false,
      'message', 'Only approved or validated purchase invoices can be server-posted.',
      'invoiceId', v_invoice.id,
      'status', v_invoice.status
    );
  end if;

  if v_invoice.branch_id is null or trim(v_invoice.branch_id) = '' then
    return jsonb_build_object('ok', false, 'message', 'Purchase invoice branch_id is required.', 'invoiceId', v_invoice.id);
  end if;

  if v_invoice.store_id is null or trim(v_invoice.store_id) = '' then
    return jsonb_build_object('ok', false, 'message', 'Purchase invoice store_id is required for inventory receipt posting.', 'invoiceId', v_invoice.id);
  end if;

  select
    count(*),
    coalesce(sum((quantity * unit_cost) - discount_amount), 0),
    coalesce(sum(tax_amount), 0)
  into v_line_count, v_net_amount, v_line_tax_amount
  from public.purchase_invoice_lines
  where invoice_id = v_invoice.id;

  if v_line_count = 0 then
    return jsonb_build_object('ok', false, 'message', 'Purchase invoice has no lines.', 'invoiceId', v_invoice.id);
  end if;

  v_vat_amount := case when coalesce(v_invoice.tax_amount, 0) > 0 then coalesce(v_invoice.tax_amount, 0) else v_line_tax_amount end;
  v_ap_amount := case when coalesce(v_invoice.total_amount, 0) > 0 then coalesce(v_invoice.total_amount, 0) else v_net_amount + v_vat_amount end;

  if abs(v_ap_amount - (v_net_amount + v_vat_amount)) > 0.05 then
    return jsonb_build_object(
      'ok', false,
      'message', 'Purchase invoice totals do not reconcile to line net amount plus VAT.',
      'invoiceId', v_invoice.id,
      'netAmount', round(v_net_amount, 2),
      'vatAmount', round(v_vat_amount, 2),
      'apAmount', round(v_ap_amount, 2),
      'difference', round(v_ap_amount - (v_net_amount + v_vat_amount), 2)
    );
  end if;

  select id into v_batch_id
  from public.posting_batches
  where source_type = 'purchase_invoice'
    and source_id = v_invoice.id::text
    and branch_id = v_invoice.branch_id
    and direction = 'normal'
    and status not in ('cancelled', 'voided')
  limit 1;

  if v_batch_id is not null then
    update public.purchase_invoices
    set status = 'posted',
        posting_batch_id = v_batch_id,
        posted_at = coalesce(posted_at, now()),
        metadata = coalesce(metadata, '{}'::jsonb) || jsonb_build_object('serverPostingRecoveredAt', now())
    where id = v_invoice.id;

    return jsonb_build_object(
      'ok', true,
      'alreadyPosted', true,
      'message', 'Existing posting batch found and linked to invoice.',
      'invoiceId', v_invoice.id,
      'postingBatchId', v_batch_id
    );
  end if;

  v_posting_date := coalesce(p_posting_date, v_invoice.invoice_date, current_date);
  v_period_id := coalesce(p_fiscal_period_id, v_invoice.fiscal_period_id);

  if v_period_id is null then
    select id into v_period_id
    from public.fiscal_periods
    where v_posting_date between starts_at and ends_at
      and status = 'open'
    order by starts_at desc
    limit 1;
  end if;

  if v_period_id is null then
    return jsonb_build_object(
      'ok', false,
      'message', 'No open fiscal period found for the purchase invoice posting date.',
      'invoiceId', v_invoice.id,
      'postingDate', v_posting_date
    );
  end if;

  if not public.finance_can_post_to_period(v_period_id) then
    return jsonb_build_object(
      'ok', false,
      'message', 'Fiscal period is not open for posting.',
      'invoiceId', v_invoice.id,
      'fiscalPeriodId', v_period_id
    );
  end if;

  v_lock_id := public.finance_lock_posting_source('purchase_invoice', v_invoice.id::text, v_invoice.branch_id);
  v_batch_ref := 'PINV-' || regexp_replace(coalesce(v_invoice.invoice_no, left(v_invoice.id::text, 8)), '[^A-Za-z0-9_-]+', '-', 'g') || '-' || to_char(now(), 'YYYYMMDDHH24MISS');

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
    currency_code,
    description,
    metadata,
    created_by
  ) values (
    v_batch_ref,
    'purchase_invoice',
    v_invoice.id::text,
    v_invoice.invoice_no,
    'purchasing',
    v_invoice.branch_id,
    v_period_id,
    v_posting_date,
    'draft',
    'SAR',
    'Server posting for purchase invoice ' || v_invoice.invoice_no,
    jsonb_build_object(
      'serverPostingVersion', 'v401',
      'supplierId', v_invoice.supplier_id,
      'storeId', v_invoice.store_id,
      'sourceLockId', v_lock_id,
      'accountMap', jsonb_build_object('inventory', v_inventory_account, 'vatInput', v_vat_input_account, 'ap', v_ap_account)
    ),
    auth.uid()
  ) returning id into v_batch_id;

  insert into public.posting_batch_lines(batch_id, line_no, account_code, description, branch_id, debit, credit, source_line_id, dimensions)
  values
    (v_batch_id, 1, v_inventory_account, 'Inventory/AP receipt from purchase invoice ' || v_invoice.invoice_no, v_invoice.branch_id, round(v_net_amount, 2), 0, v_invoice.id::text, jsonb_build_object('supplierId', v_invoice.supplier_id, 'storeId', v_invoice.store_id)),
    (v_batch_id, 2, v_ap_account, 'Supplier payable for purchase invoice ' || v_invoice.invoice_no, v_invoice.branch_id, 0, round(v_ap_amount, 2), v_invoice.id::text, jsonb_build_object('supplierId', v_invoice.supplier_id));

  if round(v_vat_amount, 2) > 0 then
    insert into public.posting_batch_lines(batch_id, line_no, account_code, description, branch_id, debit, credit, source_line_id, dimensions)
    values (v_batch_id, 3, v_vat_input_account, 'Input VAT for purchase invoice ' || v_invoice.invoice_no, v_invoice.branch_id, round(v_vat_amount, 2), 0, v_invoice.id::text, jsonb_build_object('supplierId', v_invoice.supplier_id));
  end if;

  v_validation := public.finance_validate_posting_batch(v_batch_id);
  if not coalesce((v_validation->>'ok')::boolean, false) then
    perform public.purchase_invoice_server_posting_event(v_invoice.id, v_batch_id, null, 'purchase_invoice.validation_failed', 'critical', 'Posting batch validation failed.', v_validation);
    raise exception 'Purchase invoice posting batch validation failed: %', v_validation::text;
  end if;

  update public.posting_batches
  set status = 'posted',
      posted_at = now(),
      total_debit = round(v_ap_amount, 2),
      total_credit = round(v_ap_amount, 2),
      metadata = coalesce(metadata, '{}'::jsonb) || jsonb_build_object('postedByRpc', 'purchasing_post_purchase_invoice_server')
  where id = v_batch_id;

  update public.posting_source_locks
  set batch_id = v_batch_id,
      metadata = coalesce(metadata, '{}'::jsonb) || jsonb_build_object('postedAt', now())
  where id = v_lock_id;

  v_journal_no := 'J-PINV-' || regexp_replace(coalesce(v_invoice.invoice_no, left(v_invoice.id::text, 8)), '[^A-Za-z0-9_-]+', '-', 'g') || '-' || to_char(now(), 'YYYYMMDDHH24MISS');

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
    v_invoice.branch_id,
    v_period_id,
    'purchase_invoice',
    v_invoice.id::text,
    'Server-posted purchase invoice ' || v_invoice.invoice_no,
    'posted',
    now(),
    auth.uid()
  ) returning id into v_journal_id;

  insert into public.finance_journal_lines_backend(journal_id, account_code, branch_id, debit, credit, memo)
  values
    (v_journal_id, v_inventory_account, v_invoice.branch_id, round(v_net_amount, 2), 0, 'Inventory/AP receipt from purchase invoice ' || v_invoice.invoice_no),
    (v_journal_id, v_ap_account, v_invoice.branch_id, 0, round(v_ap_amount, 2), 'Supplier payable for purchase invoice ' || v_invoice.invoice_no);

  if round(v_vat_amount, 2) > 0 then
    insert into public.finance_journal_lines_backend(journal_id, account_code, branch_id, debit, credit, memo)
    values (v_journal_id, v_vat_input_account, v_invoice.branch_id, round(v_vat_amount, 2), 0, 'Input VAT for purchase invoice ' || v_invoice.invoice_no);
  end if;

  insert into public.ap_subledger_transactions(
    supplier_id,
    branch_id,
    document_no,
    document_date,
    due_date,
    debit,
    credit,
    balance,
    source_type,
    source_id,
    status
  ) values (
    v_invoice.supplier_id,
    v_invoice.branch_id,
    v_invoice.invoice_no,
    v_invoice.invoice_date,
    v_invoice.due_date,
    0,
    round(v_ap_amount, 2),
    round(v_ap_amount, 2),
    'purchase_invoice',
    v_invoice.id::text,
    'open'
  );

  if round(v_vat_amount, 2) > 0 then
    insert into public.vat_transactions(
      source_type,
      source_id,
      branch_id,
      tax_date,
      taxable_amount,
      vat_amount,
      direction,
      status
    ) values (
      'purchase_invoice',
      v_invoice.id::text,
      v_invoice.branch_id,
      v_posting_date,
      round(v_net_amount, 2),
      round(v_vat_amount, 2),
      'input',
      'posted'
    );
  end if;

  for v_line in
    select id, item_id, quantity, unit_cost, discount_amount
    from public.purchase_invoice_lines
    where invoice_id = v_invoice.id
    order by created_at, id
  loop
    v_movement_no := 'PINV-' || left(v_invoice.id::text, 8) || '-' || left(v_line.id::text, 8);

    insert into public.inventory_stock_movements(
      movement_no,
      movement_date,
      branch_id,
      store_id,
      item_id,
      movement_type,
      direction,
      quantity,
      unit_cost,
      source_type,
      source_id,
      posting_batch_id,
      status,
      created_by
    ) values (
      v_movement_no,
      v_posting_date,
      v_invoice.branch_id,
      v_invoice.store_id,
      v_line.item_id,
      'purchase_receipt',
      'in',
      v_line.quantity,
      v_line.unit_cost,
      'purchase_invoice',
      v_invoice.id::text,
      v_batch_id,
      'posted',
      auth.uid()
    )
    on conflict (movement_no) do nothing;

    insert into public.inventory_stock_balances(
      branch_id,
      store_id,
      item_id,
      quantity_on_hand,
      average_unit_cost,
      total_value,
      last_movement_at,
      updated_at
    ) values (
      v_invoice.branch_id,
      v_invoice.store_id,
      v_line.item_id,
      v_line.quantity,
      v_line.unit_cost,
      v_line.quantity * v_line.unit_cost,
      now(),
      now()
    )
    on conflict (store_id, item_id) do update
    set quantity_on_hand = public.inventory_stock_balances.quantity_on_hand + excluded.quantity_on_hand,
        total_value = public.inventory_stock_balances.total_value + excluded.total_value,
        average_unit_cost = case
          when (public.inventory_stock_balances.quantity_on_hand + excluded.quantity_on_hand) > 0
          then (public.inventory_stock_balances.total_value + excluded.total_value) / (public.inventory_stock_balances.quantity_on_hand + excluded.quantity_on_hand)
          else 0
        end,
        branch_id = excluded.branch_id,
        last_movement_at = now(),
        updated_at = now();
  end loop;

  update public.purchase_invoices
  set status = 'posted',
      posting_batch_id = v_batch_id,
      fiscal_period_id = v_period_id,
      posted_at = now(),
      metadata = coalesce(metadata, '{}'::jsonb) || jsonb_build_object(
        'serverPostingVersion', 'v401',
        'postingBatchId', v_batch_id,
        'journalId', v_journal_id,
        'netAmount', round(v_net_amount, 2),
        'vatAmount', round(v_vat_amount, 2),
        'apAmount', round(v_ap_amount, 2)
      )
  where id = v_invoice.id;

  perform public.purchase_invoice_server_posting_event(
    v_invoice.id,
    v_batch_id,
    v_journal_id,
    'purchase_invoice.server_posted',
    'info',
    'Purchase invoice was server-posted to inventory, AP, VAT, and GL.',
    jsonb_build_object(
      'netAmount', round(v_net_amount, 2),
      'vatAmount', round(v_vat_amount, 2),
      'apAmount', round(v_ap_amount, 2),
      'lineCount', v_line_count,
      'fiscalPeriodId', v_period_id
    )
  );

  return jsonb_build_object(
    'ok', true,
    'message', 'Purchase invoice server-posted to inventory, AP, VAT, posting batch, and finance journal.',
    'invoiceId', v_invoice.id,
    'postingBatchId', v_batch_id,
    'journalId', v_journal_id,
    'fiscalPeriodId', v_period_id,
    'totals', jsonb_build_object(
      'netAmount', round(v_net_amount, 2),
      'vatAmount', round(v_vat_amount, 2),
      'apAmount', round(v_ap_amount, 2),
      'lineCount', v_line_count
    )
  );
end;
$$;

-- Replace the old foundation wrapper so existing callers use real server-side posting.
create or replace function public.purchasing_post_purchase_invoice(invoice_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  return public.purchasing_post_purchase_invoice_server(invoice_id, null, null, '{}'::jsonb);
end;
$$;

do $$
begin
  if to_regprocedure('public.purchasing_post_purchase_invoice_server(uuid, uuid, date, jsonb)') is not null then
    execute 'grant execute on function public.purchasing_post_purchase_invoice_server(uuid, uuid, date, jsonb) to authenticated';
  end if;
  if to_regprocedure('public.purchasing_post_purchase_invoice(uuid)') is not null then
    execute 'grant execute on function public.purchasing_post_purchase_invoice(uuid) to authenticated';
  end if;
  if to_regprocedure('public.purchase_invoice_server_posting_event(uuid, uuid, uuid, text, text, text, jsonb)') is not null then
    execute 'grant execute on function public.purchase_invoice_server_posting_event(uuid, uuid, uuid, text, text, text, jsonb) to service_role';
  end if;
end;
$$;
