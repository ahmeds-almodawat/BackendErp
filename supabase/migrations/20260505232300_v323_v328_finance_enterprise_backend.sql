-- v323-v328 Finance Enterprise Backend
-- Combines GL backend, AP/AR subledgers, VAT, bank reconciliation, finance close,
-- and management truth pack foundations.
-- Additive only. Does not remove existing tables.

create extension if not exists pgcrypto;

create table if not exists public.finance_journal_entries_backend (
  id uuid primary key default gen_random_uuid(),
  journal_no text not null unique,
  journal_date date not null,
  branch_id text references public.branches(id) on delete set null,
  fiscal_period_id uuid references public.fiscal_periods(id) on delete set null,
  source_type text not null,
  source_id text,
  description text not null,
  status text not null default 'draft' check (status in ('draft','validated','approved','posted','reversed','cancelled')),
  posted_at timestamptz,
  reversed_at timestamptz,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);

create table if not exists public.finance_journal_lines_backend (
  id uuid primary key default gen_random_uuid(),
  journal_id uuid not null references public.finance_journal_entries_backend(id) on delete cascade,
  account_code text not null,
  branch_id text references public.branches(id) on delete set null,
  cost_center_id uuid,
  debit numeric not null default 0 check (debit >= 0),
  credit numeric not null default 0 check (credit >= 0),
  memo text,
  created_at timestamptz not null default now(),
  constraint finance_journal_line_one_side check (
    (debit > 0 and credit = 0) or (credit > 0 and debit = 0)
  )
);

create table if not exists public.ap_subledger_transactions (
  id uuid primary key default gen_random_uuid(),
  supplier_id text not null references public.suppliers(id) on delete restrict,
  branch_id text references public.branches(id) on delete set null,
  document_no text not null,
  document_date date not null,
  due_date date,
  debit numeric not null default 0,
  credit numeric not null default 0,
  balance numeric not null default 0,
  source_type text not null,
  source_id text,
  status text not null default 'open' check (status in ('open','partially_paid','paid','cancelled','reversed')),
  created_at timestamptz not null default now()
);

create table if not exists public.customers (
  id uuid primary key default gen_random_uuid(),
  customer_code text not null unique,
  name text not null,
  vat_number text,
  status text not null default 'active' check (status in ('active','inactive','archived')),
  created_at timestamptz not null default now()
);

create table if not exists public.ar_subledger_transactions (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.customers(id) on delete restrict,
  branch_id text references public.branches(id) on delete set null,
  document_no text not null,
  document_date date not null,
  due_date date,
  debit numeric not null default 0,
  credit numeric not null default 0,
  balance numeric not null default 0,
  source_type text not null,
  source_id text,
  status text not null default 'open' check (status in ('open','partially_paid','paid','cancelled','reversed')),
  created_at timestamptz not null default now()
);

create table if not exists public.vat_transactions (
  id uuid primary key default gen_random_uuid(),
  source_type text not null,
  source_id text not null,
  branch_id text references public.branches(id) on delete set null,
  tax_date date not null,
  taxable_amount numeric not null default 0,
  vat_amount numeric not null default 0,
  direction text not null check (direction in ('input','output')),
  status text not null default 'draft' check (status in ('draft','posted','settled','cancelled')),
  created_at timestamptz not null default now()
);

create table if not exists public.vat_settlement_runs (
  id uuid primary key default gen_random_uuid(),
  settlement_no text not null unique,
  period_start date not null,
  period_end date not null,
  branch_id text references public.branches(id) on delete set null,
  input_vat numeric not null default 0,
  output_vat numeric not null default 0,
  net_vat_payable numeric not null default 0,
  status text not null default 'draft' check (status in ('draft','posted','paid','cancelled')),
  posting_batch_id uuid references public.posting_batches(id) on delete set null,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);

create table if not exists public.bank_accounts (
  id uuid primary key default gen_random_uuid(),
  account_code text not null,
  bank_name text not null,
  iban text,
  currency text not null default 'SAR',
  status text not null default 'active' check (status in ('active','inactive','archived')),
  created_at timestamptz not null default now()
);

create table if not exists public.bank_statement_lines (
  id uuid primary key default gen_random_uuid(),
  bank_account_id uuid not null references public.bank_accounts(id) on delete restrict,
  statement_date date not null,
  description text not null,
  amount numeric not null,
  matched_journal_line_id uuid references public.finance_journal_lines_backend(id) on delete set null,
  status text not null default 'unmatched' check (status in ('unmatched','matched','adjustment_needed','ignored')),
  created_at timestamptz not null default now()
);

create table if not exists public.bank_reconciliation_runs (
  id uuid primary key default gen_random_uuid(),
  bank_account_id uuid not null references public.bank_accounts(id) on delete restrict,
  period_start date not null,
  period_end date not null,
  statement_balance numeric not null default 0,
  book_balance numeric not null default 0,
  difference numeric generated always as (statement_balance - book_balance) stored,
  status text not null default 'draft' check (status in ('draft','matched','has_differences','posted','cancelled')),
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);

create table if not exists public.finance_close_runs (
  id uuid primary key default gen_random_uuid(),
  fiscal_period_id uuid not null references public.fiscal_periods(id) on delete restrict,
  branch_id text references public.branches(id) on delete set null,
  status text not null default 'draft' check (status in ('draft','checking','ready','blocked','closed','cancelled')),
  critical_count int not null default 0,
  warning_count int not null default 0,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);

create table if not exists public.finance_close_findings (
  id uuid primary key default gen_random_uuid(),
  close_run_id uuid not null references public.finance_close_runs(id) on delete cascade,
  severity text not null check (severity in ('warning','critical')),
  check_key text not null,
  message text not null,
  action text,
  created_at timestamptz not null default now()
);

create table if not exists public.management_truth_packs (
  id uuid primary key default gen_random_uuid(),
  period_start date not null,
  period_end date not null,
  branch_id text references public.branches(id) on delete set null,
  truth_score int not null default 0 check (truth_score between 0 and 100),
  status text not null default 'incomplete' check (status in ('trusted','warning','critical','incomplete')),
  kpis jsonb not null default '[]'::jsonb,
  findings jsonb not null default '[]'::jsonb,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);

create index if not exists idx_finance_journal_entries_date on public.finance_journal_entries_backend(journal_date, status);
create index if not exists idx_finance_journal_lines_account on public.finance_journal_lines_backend(account_code);
create index if not exists idx_ap_subledger_supplier on public.ap_subledger_transactions(supplier_id, status, due_date);
create index if not exists idx_ar_subledger_customer on public.ar_subledger_transactions(customer_id, status, due_date);
create index if not exists idx_vat_transactions_date on public.vat_transactions(tax_date, direction, status);
create index if not exists idx_bank_statement_lines_account on public.bank_statement_lines(bank_account_id, statement_date, status);
create index if not exists idx_finance_close_runs_period on public.finance_close_runs(fiscal_period_id, branch_id);
create index if not exists idx_management_truth_packs_period on public.management_truth_packs(period_start, period_end, branch_id);

alter table public.finance_journal_entries_backend enable row level security;
alter table public.finance_journal_lines_backend enable row level security;
alter table public.ap_subledger_transactions enable row level security;
alter table public.customers enable row level security;
alter table public.ar_subledger_transactions enable row level security;
alter table public.vat_transactions enable row level security;
alter table public.vat_settlement_runs enable row level security;
alter table public.bank_accounts enable row level security;
alter table public.bank_statement_lines enable row level security;
alter table public.bank_reconciliation_runs enable row level security;
alter table public.finance_close_runs enable row level security;
alter table public.finance_close_findings enable row level security;
alter table public.management_truth_packs enable row level security;

create or replace function public.finance_create_journal_with_lines(
  journal_payload jsonb,
  lines_payload jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_journal_id uuid;
  v_debit numeric := 0;
  v_credit numeric := 0;
begin
  select
    coalesce(sum((line_item->>'debit')::numeric), 0),
    coalesce(sum((line_item->>'credit')::numeric), 0)
  into v_debit, v_credit
  from jsonb_array_elements(lines_payload) as line_item;

  if abs(v_debit - v_credit) > 0.01 then
    return jsonb_build_object(
      'ok', false,
      'message', 'Journal is not balanced.',
      'debit', v_debit,
      'credit', v_credit
    );
  end if;

  insert into public.finance_journal_entries_backend (
    journal_no,
    journal_date,
    branch_id,
    fiscal_period_id,
    source_type,
    source_id,
    description,
    status,
    created_by
  )
  values (
    journal_payload->>'journal_no',
    (journal_payload->>'journal_date')::date,
    nullif(journal_payload->>'branch_id',''),
    nullif(journal_payload->>'fiscal_period_id','')::uuid,
    journal_payload->>'source_type',
    journal_payload->>'source_id',
    coalesce(journal_payload->>'description', 'Journal'),
    'draft',
    auth.uid()
  )
  returning id into v_journal_id;

  insert into public.finance_journal_lines_backend (
    journal_id,
    account_code,
    branch_id,
    debit,
    credit,
    memo
  )
  select
    v_journal_id,
    line_item->>'account_code',
    nullif(line_item->>'branch_id',''),
    coalesce((line_item->>'debit')::numeric, 0),
    coalesce((line_item->>'credit')::numeric, 0),
    line_item->>'memo'
  from jsonb_array_elements(lines_payload) as line_item;

  return jsonb_build_object('ok', true, 'message', 'Journal created.', 'id', v_journal_id);
end;
$$;

create or replace function public.finance_post_journal(journal_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_debit numeric := 0;
  v_credit numeric := 0;
begin
  select coalesce(sum(debit), 0), coalesce(sum(credit), 0)
  into v_debit, v_credit
  from public.finance_journal_lines_backend
  where finance_journal_lines_backend.journal_id = finance_post_journal.journal_id;

  if abs(v_debit - v_credit) > 0.01 then
    return jsonb_build_object('ok', false, 'message', 'Journal is not balanced.', 'debit', v_debit, 'credit', v_credit);
  end if;

  update public.finance_journal_entries_backend
  set status = 'posted',
      posted_at = now()
  where id = journal_id
    and status in ('draft','validated','approved');

  return jsonb_build_object('ok', true, 'message', 'Journal posted.', 'id', journal_id);
end;
$$;

create or replace function public.finance_reverse_journal(journal_id uuid, reversal_reason text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_original record;
  v_reversal_id uuid;
begin
  select * into v_original
  from public.finance_journal_entries_backend
  where id = journal_id;

  if not found then
    return jsonb_build_object('ok', false, 'message', 'Journal not found.');
  end if;

  if v_original.status <> 'posted' then
    return jsonb_build_object('ok', false, 'message', 'Only posted journals can be reversed.');
  end if;

  insert into public.finance_journal_entries_backend (
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
  )
  values (
    v_original.journal_no || '-REV',
    current_date,
    v_original.branch_id,
    v_original.fiscal_period_id,
    v_original.source_type,
    v_original.id::text,
    'Reversal: ' || coalesce(reversal_reason, v_original.description),
    'posted',
    now(),
    auth.uid()
  )
  returning id into v_reversal_id;

  insert into public.finance_journal_lines_backend (
    journal_id,
    account_code,
    branch_id,
    cost_center_id,
    debit,
    credit,
    memo
  )
  select
    v_reversal_id,
    account_code,
    branch_id,
    cost_center_id,
    credit,
    debit,
    'Reversal line'
  from public.finance_journal_lines_backend
  where finance_journal_lines_backend.journal_id = finance_reverse_journal.journal_id;

  update public.finance_journal_entries_backend
  set status = 'reversed',
      reversed_at = now()
  where id = journal_id;

  return jsonb_build_object('ok', true, 'message', 'Journal reversed.', 'id', v_reversal_id);
end;
$$;

create or replace function public.finance_get_supplier_aging(as_of_date date, branch_id text default null)
returns jsonb
language sql
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'ok', true,
    'message', 'Supplier aging foundation generated.',
    'as_of_date', as_of_date,
    'rows', coalesce(jsonb_agg(row_to_json(t)), '[]'::jsonb)
  )
  from (
    select
      supplier_id,
      sum(balance) as total_balance,
      sum(case when coalesce(due_date, document_date) <= as_of_date then balance else 0 end) as overdue_amount
    from public.ap_subledger_transactions
    where status in ('open','partially_paid')
      and (finance_get_supplier_aging.branch_id is null or ap_subledger_transactions.branch_id = finance_get_supplier_aging.branch_id)
    group by supplier_id
  ) t;
$$;

create or replace function public.finance_get_customer_aging(as_of_date date, branch_id text default null)
returns jsonb
language sql
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'ok', true,
    'message', 'Customer aging foundation generated.',
    'as_of_date', as_of_date,
    'rows', coalesce(jsonb_agg(row_to_json(t)), '[]'::jsonb)
  )
  from (
    select
      customer_id,
      sum(balance) as total_balance,
      sum(case when coalesce(due_date, document_date) <= as_of_date then balance else 0 end) as overdue_amount
    from public.ar_subledger_transactions
    where status in ('open','partially_paid')
      and (finance_get_customer_aging.branch_id is null or ar_subledger_transactions.branch_id = finance_get_customer_aging.branch_id)
    group by customer_id
  ) t;
$$;

create or replace function public.finance_get_vat_summary(period_start date, period_end date, branch_id text default null)
returns jsonb
language sql
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'ok', true,
    'message', 'VAT summary generated.',
    'input_vat', coalesce(sum(vat_amount) filter (where direction = 'input'), 0),
    'output_vat', coalesce(sum(vat_amount) filter (where direction = 'output'), 0),
    'net_vat_payable',
      coalesce(sum(vat_amount) filter (where direction = 'output'), 0)
      - coalesce(sum(vat_amount) filter (where direction = 'input'), 0)
  )
  from public.vat_transactions
  where status = 'posted'
    and tax_date between period_start and period_end
    and (finance_get_vat_summary.branch_id is null or vat_transactions.branch_id = finance_get_vat_summary.branch_id);
$$;

create or replace function public.finance_create_vat_settlement(period_start date, period_end date, branch_id text default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_input numeric := 0;
  v_output numeric := 0;
  v_id uuid;
begin
  select
    coalesce(sum(vat_amount) filter (where direction = 'input'), 0),
    coalesce(sum(vat_amount) filter (where direction = 'output'), 0)
  into v_input, v_output
  from public.vat_transactions
  where status = 'posted'
    and tax_date between period_start and period_end
    and (finance_create_vat_settlement.branch_id is null or vat_transactions.branch_id = finance_create_vat_settlement.branch_id);

  insert into public.vat_settlement_runs (
    settlement_no,
    period_start,
    period_end,
    branch_id,
    input_vat,
    output_vat,
    net_vat_payable,
    created_by
  )
  values (
    'VAT-' || to_char(now(), 'YYYYMMDDHH24MISS'),
    period_start,
    period_end,
    branch_id,
    v_input,
    v_output,
    v_output - v_input,
    auth.uid()
  )
  returning id into v_id;

  return jsonb_build_object('ok', true, 'message', 'VAT settlement created.', 'id', v_id);
end;
$$;

create or replace function public.finance_reconcile_bank_statement_line(statement_line_id uuid, journal_line_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.bank_statement_lines
  set matched_journal_line_id = journal_line_id,
      status = 'matched'
  where id = statement_line_id;

  return jsonb_build_object('ok', true, 'message', 'Bank statement line reconciled.', 'id', statement_line_id);
end;
$$;

create or replace function public.finance_close_period_check(period_id uuid, branch_id text default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_run_id uuid;
begin
  insert into public.finance_close_runs (
    fiscal_period_id,
    branch_id,
    status,
    created_by
  )
  values (
    period_id,
    branch_id,
    'checking',
    auth.uid()
  )
  returning id into v_run_id;

  return jsonb_build_object(
    'ok', true,
    'message', 'Finance close check run created. Populate findings from reconciliation checks before closing.',
    'id', v_run_id
  );
end;
$$;
do $$
begin
  if to_regprocedure('public.finance_create_journal_with_lines(jsonb, jsonb)') is not null then
    execute 'grant execute on function public.finance_create_journal_with_lines(jsonb, jsonb) to authenticated';
  end if;
end;
$$;
do $$
begin
  if to_regprocedure('public.finance_post_journal(uuid)') is not null then
    execute 'grant execute on function public.finance_post_journal(uuid) to authenticated';
  end if;
end;
$$;
do $$
begin
  if to_regprocedure('public.finance_reverse_journal(uuid, text)') is not null then
    execute 'grant execute on function public.finance_reverse_journal(uuid, text) to authenticated';
  end if;
end;
$$;
do $$
begin
  if to_regprocedure('public.finance_get_supplier_aging(date, uuid)') is not null then
    execute 'grant execute on function public.finance_get_supplier_aging(date, uuid) to authenticated';
  end if;
end;
$$;
do $$
begin
  if to_regprocedure('public.finance_get_customer_aging(date, uuid)') is not null then
    execute 'grant execute on function public.finance_get_customer_aging(date, uuid) to authenticated';
  end if;
end;
$$;
do $$
begin
  if to_regprocedure('public.finance_get_vat_summary(date, date, uuid)') is not null then
    execute 'grant execute on function public.finance_get_vat_summary(date, date, uuid) to authenticated';
  end if;
end;
$$;
do $$
begin
  if to_regprocedure('public.finance_create_vat_settlement(date, date, uuid)') is not null then
    execute 'grant execute on function public.finance_create_vat_settlement(date, date, uuid) to authenticated';
  end if;
end;
$$;
do $$
begin
  if to_regprocedure('public.finance_reconcile_bank_statement_line(uuid, uuid)') is not null then
    execute 'grant execute on function public.finance_reconcile_bank_statement_line(uuid, uuid) to authenticated';
  end if;
end;
$$;
do $$
begin
  if to_regprocedure('public.finance_close_period_check(uuid, uuid)') is not null then
    execute 'grant execute on function public.finance_close_period_check(uuid, uuid) to authenticated';
  end if;
end;
$$;
