-- v402 Supplier Payment Server Posting
-- Backend-authoritative supplier payment workflow:
-- Supplier Payment -> AP settlement -> Cash/Bank credit -> GL posting batch + finance journal -> audit/evidence.
-- Additive and idempotent. It does not depend on browser/local state.

create extension if not exists pgcrypto;

-- Evidence table for server-side supplier payment posting runs.
create table if not exists public.supplier_payment_server_posting_events (
  id uuid primary key default gen_random_uuid(),
  supplier_payment_id uuid references public.supplier_payments(id) on delete set null,
  posting_batch_id uuid references public.posting_batches(id) on delete set null,
  journal_id uuid references public.finance_journal_entries_backend(id) on delete set null,
  event_type text not null,
  severity text not null default 'info' check (severity in ('info','warning','critical')),
  message text,
  details jsonb not null default '{}'::jsonb,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);

create index if not exists idx_supplier_payment_server_posting_events_payment
  on public.supplier_payment_server_posting_events(supplier_payment_id, created_at desc);

alter table public.supplier_payment_server_posting_events enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'supplier_payment_server_posting_events'
      and policyname = 'supplier_payment_server_posting_events_read_authenticated_v402'
  ) then
    create policy supplier_payment_server_posting_events_read_authenticated_v402
      on public.supplier_payment_server_posting_events
      for select to authenticated
      using (true);
  end if;
end;
$$;

-- Payment allocation evidence. This links one supplier payment to the AP open items it settled.
create table if not exists public.supplier_payment_applications (
  id uuid primary key default gen_random_uuid(),
  supplier_payment_id uuid not null references public.supplier_payments(id) on delete cascade,
  ap_transaction_id uuid references public.ap_subledger_transactions(id) on delete set null,
  supplier_id text not null references public.suppliers(id) on delete restrict,
  branch_id text references public.branches(id) on delete set null,
  applied_amount numeric not null default 0 check (applied_amount >= 0),
  status text not null default 'applied' check (status in ('applied','reversed','cancelled')),
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (supplier_payment_id, ap_transaction_id)
);

create index if not exists idx_supplier_payment_applications_payment
  on public.supplier_payment_applications(supplier_payment_id, created_at desc);
create index if not exists idx_supplier_payment_applications_ap
  on public.supplier_payment_applications(ap_transaction_id, created_at desc);

alter table public.supplier_payment_applications enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'supplier_payment_applications'
      and policyname = 'supplier_payment_applications_read_authenticated_v402'
  ) then
    create policy supplier_payment_applications_read_authenticated_v402
      on public.supplier_payment_applications
      for select to authenticated
      using (true);
  end if;
end;
$$;

-- Compatibility columns for supplier payment posting evidence.
alter table if exists public.supplier_payments add column if not exists fiscal_period_id uuid references public.fiscal_periods(id) on delete set null;
alter table if exists public.supplier_payments add column if not exists posted_at timestamptz;
alter table if exists public.supplier_payments add column if not exists approved_at timestamptz;
alter table if exists public.supplier_payments add column if not exists metadata jsonb not null default '{}'::jsonb;
alter table if exists public.supplier_payments add column if not exists updated_at timestamptz not null default now();

create index if not exists idx_supplier_payments_fiscal_period on public.supplier_payments(fiscal_period_id);
create index if not exists idx_supplier_payments_posting_batch on public.supplier_payments(posting_batch_id);

create or replace function public.supplier_payment_server_posting_event(
  p_supplier_payment_id uuid,
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
  insert into public.supplier_payment_server_posting_events(
    supplier_payment_id,
    posting_batch_id,
    journal_id,
    event_type,
    severity,
    message,
    details,
    created_by
  ) values (
    p_supplier_payment_id,
    p_posting_batch_id,
    p_journal_id,
    coalesce(nullif(p_event_type, ''), 'supplier_payment.posting_event'),
    coalesce(nullif(p_severity, ''), 'info'),
    p_message,
    coalesce(p_details, '{}'::jsonb),
    auth.uid()
  );
end;
$$;

create or replace function public.purchasing_post_supplier_payment_server(
  p_payment_id uuid,
  p_fiscal_period_id uuid default null,
  p_posting_date date default null,
  p_account_map jsonb default '{}'::jsonb,
  p_allow_unapplied boolean default false
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_payment public.supplier_payments%rowtype;
  v_period_id uuid;
  v_posting_date date;
  v_batch_id uuid;
  v_journal_id uuid;
  v_lock_id uuid;
  v_amount numeric := 0;
  v_open_ap_balance numeric := 0;
  v_remaining numeric := 0;
  v_apply numeric := 0;
  v_ap_account text := coalesce(nullif(p_account_map->>'ap_account',''), '2100');
  v_cash_account text;
  v_validation jsonb;
  v_ap_tx record;
  v_batch_ref text;
  v_journal_no text;
begin
  if p_payment_id is null then
    return jsonb_build_object('ok', false, 'message', 'payment_id is required');
  end if;

  if not coalesce(public.app_current_user_has_permission('finance.post'), false) then
    raise exception 'permission denied: finance.post required' using errcode = '42501';
  end if;

  select * into v_payment
  from public.supplier_payments
  where id = p_payment_id
  for update;

  if not found then
    return jsonb_build_object('ok', false, 'message', 'Supplier payment was not found.', 'paymentId', p_payment_id);
  end if;

  if v_payment.status = 'posted' then
    return jsonb_build_object(
      'ok', true,
      'alreadyPosted', true,
      'message', 'Supplier payment is already posted.',
      'paymentId', v_payment.id,
      'postingBatchId', v_payment.posting_batch_id
    );
  end if;

  if v_payment.status not in ('approved') then
    return jsonb_build_object(
      'ok', false,
      'message', 'Only approved supplier payments can be server-posted.',
      'paymentId', v_payment.id,
      'status', v_payment.status
    );
  end if;

  if v_payment.branch_id is null or trim(v_payment.branch_id) = '' then
    return jsonb_build_object('ok', false, 'message', 'Supplier payment branch_id is required.', 'paymentId', v_payment.id);
  end if;

  if v_payment.supplier_id is null or trim(v_payment.supplier_id) = '' then
    return jsonb_build_object('ok', false, 'message', 'Supplier payment supplier_id is required.', 'paymentId', v_payment.id);
  end if;

  v_amount := round(coalesce(v_payment.amount, 0), 2);
  if v_amount <= 0 then
    return jsonb_build_object('ok', false, 'message', 'Supplier payment amount must be greater than zero.', 'paymentId', v_payment.id);
  end if;

  v_cash_account := coalesce(nullif(p_account_map->>'cash_account',''), nullif(v_payment.account_code, ''), '1000');

  select coalesce(sum(balance), 0)
  into v_open_ap_balance
  from public.ap_subledger_transactions
  where supplier_id = v_payment.supplier_id
    and branch_id = v_payment.branch_id
    and status in ('open','partially_paid')
    and balance > 0;

  if v_open_ap_balance <= 0 and not p_allow_unapplied then
    return jsonb_build_object(
      'ok', false,
      'message', 'Supplier has no open AP balance to settle. Enable allow_unapplied only for controlled advance payments.',
      'paymentId', v_payment.id,
      'supplierId', v_payment.supplier_id,
      'openApBalance', round(v_open_ap_balance, 2)
    );
  end if;

  if v_amount > v_open_ap_balance + 0.05 and not p_allow_unapplied then
    return jsonb_build_object(
      'ok', false,
      'message', 'Supplier payment exceeds open AP balance.',
      'paymentId', v_payment.id,
      'supplierId', v_payment.supplier_id,
      'paymentAmount', round(v_amount, 2),
      'openApBalance', round(v_open_ap_balance, 2),
      'excessAmount', round(v_amount - v_open_ap_balance, 2)
    );
  end if;

  select id into v_batch_id
  from public.posting_batches
  where source_type = 'supplier_payment'
    and source_id = v_payment.id::text
    and branch_id = v_payment.branch_id
    and direction = 'normal'
    and status not in ('cancelled', 'voided')
  limit 1;

  if v_batch_id is not null then
    update public.supplier_payments
    set status = 'posted',
        posting_batch_id = v_batch_id,
        posted_at = coalesce(posted_at, now()),
        metadata = coalesce(metadata, '{}'::jsonb) || jsonb_build_object('serverPostingRecoveredAt', now())
    where id = v_payment.id;

    return jsonb_build_object(
      'ok', true,
      'alreadyPosted', true,
      'message', 'Existing posting batch found and linked to supplier payment.',
      'paymentId', v_payment.id,
      'postingBatchId', v_batch_id
    );
  end if;

  v_posting_date := coalesce(p_posting_date, v_payment.payment_date, current_date);
  v_period_id := coalesce(p_fiscal_period_id, v_payment.fiscal_period_id);

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
      'message', 'No open fiscal period found for the supplier payment posting date.',
      'paymentId', v_payment.id,
      'postingDate', v_posting_date
    );
  end if;

  if not public.finance_can_post_to_period(v_period_id) then
    return jsonb_build_object(
      'ok', false,
      'message', 'Fiscal period is not open for posting.',
      'paymentId', v_payment.id,
      'fiscalPeriodId', v_period_id
    );
  end if;

  v_lock_id := public.finance_lock_posting_source('supplier_payment', v_payment.id::text, v_payment.branch_id);
  v_batch_ref := 'SPAY-' || regexp_replace(coalesce(v_payment.payment_no, left(v_payment.id::text, 8)), '[^A-Za-z0-9_-]+', '-', 'g') || '-' || to_char(now(), 'YYYYMMDDHH24MISS');

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
    'supplier_payment',
    v_payment.id::text,
    v_payment.payment_no,
    'purchasing',
    v_payment.branch_id,
    v_period_id,
    v_posting_date,
    'draft',
    'SAR',
    'Server posting for supplier payment ' || v_payment.payment_no,
    jsonb_build_object(
      'serverPostingVersion', 'v402',
      'supplierId', v_payment.supplier_id,
      'paymentMethod', v_payment.method,
      'sourceLockId', v_lock_id,
      'accountMap', jsonb_build_object('ap', v_ap_account, 'cash', v_cash_account),
      'openApBalanceBeforePosting', round(v_open_ap_balance, 2),
      'allowUnapplied', p_allow_unapplied
    ),
    auth.uid()
  ) returning id into v_batch_id;

  insert into public.posting_batch_lines(batch_id, line_no, account_code, description, branch_id, debit, credit, source_line_id, dimensions)
  values
    (v_batch_id, 1, v_ap_account, 'AP settlement from supplier payment ' || v_payment.payment_no, v_payment.branch_id, v_amount, 0, v_payment.id::text, jsonb_build_object('supplierId', v_payment.supplier_id)),
    (v_batch_id, 2, v_cash_account, 'Cash/bank outflow for supplier payment ' || v_payment.payment_no, v_payment.branch_id, 0, v_amount, v_payment.id::text, jsonb_build_object('supplierId', v_payment.supplier_id, 'paymentMethod', v_payment.method));

  v_validation := public.finance_validate_posting_batch(v_batch_id);
  if not coalesce((v_validation->>'ok')::boolean, false) then
    perform public.supplier_payment_server_posting_event(v_payment.id, v_batch_id, null, 'supplier_payment.validation_failed', 'critical', 'Posting batch validation failed.', v_validation);
    raise exception 'Supplier payment posting batch validation failed: %', v_validation::text;
  end if;

  update public.posting_batches
  set status = 'posted',
      posted_at = now(),
      total_debit = v_amount,
      total_credit = v_amount,
      metadata = coalesce(metadata, '{}'::jsonb) || jsonb_build_object('postedByRpc', 'purchasing_post_supplier_payment_server')
  where id = v_batch_id;

  update public.posting_source_locks
  set batch_id = v_batch_id,
      metadata = coalesce(metadata, '{}'::jsonb) || jsonb_build_object('postedAt', now())
  where id = v_lock_id;

  v_journal_no := 'J-SPAY-' || regexp_replace(coalesce(v_payment.payment_no, left(v_payment.id::text, 8)), '[^A-Za-z0-9_-]+', '-', 'g') || '-' || to_char(now(), 'YYYYMMDDHH24MISS');

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
    v_payment.branch_id,
    v_period_id,
    'supplier_payment',
    v_payment.id::text,
    'Server-posted supplier payment ' || v_payment.payment_no,
    'posted',
    now(),
    auth.uid()
  ) returning id into v_journal_id;

  insert into public.finance_journal_lines_backend(journal_id, account_code, branch_id, debit, credit, memo)
  values
    (v_journal_id, v_ap_account, v_payment.branch_id, v_amount, 0, 'AP settlement from supplier payment ' || v_payment.payment_no),
    (v_journal_id, v_cash_account, v_payment.branch_id, 0, v_amount, 'Cash/bank outflow for supplier payment ' || v_payment.payment_no);

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
    v_payment.supplier_id,
    v_payment.branch_id,
    v_payment.payment_no,
    v_payment.payment_date,
    null,
    v_amount,
    0,
    0,
    'supplier_payment',
    v_payment.id::text,
    'paid'
  );

  v_remaining := v_amount;

  for v_ap_tx in
    select id, balance, source_type, source_id, document_no, document_date
    from public.ap_subledger_transactions
    where supplier_id = v_payment.supplier_id
      and branch_id = v_payment.branch_id
      and status in ('open','partially_paid')
      and balance > 0
      and source_type <> 'supplier_payment'
    order by document_date, created_at, id
    for update
  loop
    exit when v_remaining <= 0.005;

    v_apply := least(v_remaining, v_ap_tx.balance);

    insert into public.supplier_payment_applications(
      supplier_payment_id,
      ap_transaction_id,
      supplier_id,
      branch_id,
      applied_amount,
      status,
      details
    ) values (
      v_payment.id,
      v_ap_tx.id,
      v_payment.supplier_id,
      v_payment.branch_id,
      round(v_apply, 2),
      'applied',
      jsonb_build_object('sourceType', v_ap_tx.source_type, 'sourceId', v_ap_tx.source_id, 'documentNo', v_ap_tx.document_no)
    )
    on conflict (supplier_payment_id, ap_transaction_id) do nothing;

    update public.ap_subledger_transactions
    set balance = greatest(0, balance - v_apply),
        status = case when greatest(0, balance - v_apply) <= 0.005 then 'paid' else 'partially_paid' end
    where id = v_ap_tx.id;

    v_remaining := v_remaining - v_apply;
  end loop;

  update public.supplier_payments
  set status = 'posted',
      posting_batch_id = v_batch_id,
      fiscal_period_id = v_period_id,
      posted_at = now(),
      updated_at = now(),
      metadata = coalesce(metadata, '{}'::jsonb) || jsonb_build_object(
        'serverPostingVersion', 'v402',
        'postingBatchId', v_batch_id,
        'journalId', v_journal_id,
        'amount', v_amount,
        'openApBalanceBeforePosting', round(v_open_ap_balance, 2),
        'unappliedAmount', round(greatest(0, v_remaining), 2)
      )
  where id = v_payment.id;

  perform public.supplier_payment_server_posting_event(
    v_payment.id,
    v_batch_id,
    v_journal_id,
    case when v_remaining > 0.005 then 'supplier_payment.server_posted_with_unapplied_balance' else 'supplier_payment.server_posted' end,
    case when v_remaining > 0.005 then 'warning' else 'info' end,
    'Supplier payment was server-posted to AP, cash/bank, posting batch, and finance journal.',
    jsonb_build_object(
      'amount', v_amount,
      'openApBalanceBeforePosting', round(v_open_ap_balance, 2),
      'appliedAmount', round(v_amount - greatest(0, v_remaining), 2),
      'unappliedAmount', round(greatest(0, v_remaining), 2),
      'fiscalPeriodId', v_period_id
    )
  );

  return jsonb_build_object(
    'ok', true,
    'message', 'Supplier payment server-posted to AP, cash/bank, posting batch, and finance journal.',
    'paymentId', v_payment.id,
    'postingBatchId', v_batch_id,
    'journalId', v_journal_id,
    'fiscalPeriodId', v_period_id,
    'totals', jsonb_build_object(
      'amount', v_amount,
      'openApBalanceBeforePosting', round(v_open_ap_balance, 2),
      'appliedAmount', round(v_amount - greatest(0, v_remaining), 2),
      'unappliedAmount', round(greatest(0, v_remaining), 2)
    )
  );
end;
$$;

-- Replace the old foundation wrapper so existing callers use real server-side payment posting.
create or replace function public.purchasing_post_supplier_payment(payment_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  return public.purchasing_post_supplier_payment_server(payment_id, null, null, '{}'::jsonb, false);
end;
$$;

do $$
begin
  if to_regprocedure('public.purchasing_post_supplier_payment_server(uuid, uuid, date, jsonb, boolean)') is not null then
    execute 'grant execute on function public.purchasing_post_supplier_payment_server(uuid, uuid, date, jsonb, boolean) to authenticated';
  end if;
  if to_regprocedure('public.purchasing_post_supplier_payment(uuid)') is not null then
    execute 'grant execute on function public.purchasing_post_supplier_payment(uuid) to authenticated';
  end if;
  if to_regprocedure('public.supplier_payment_server_posting_event(uuid, uuid, uuid, text, text, text, jsonb)') is not null then
    execute 'grant execute on function public.supplier_payment_server_posting_event(uuid, uuid, uuid, text, text, text, jsonb) to service_role';
  end if;
end;
$$;
