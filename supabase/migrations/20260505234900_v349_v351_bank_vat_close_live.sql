-- v349-v351 Bank, VAT, and Period Close Live Gate
-- Additive only. Does not rewrite AppShell or apply migrations automatically.

create extension if not exists pgcrypto;

create table if not exists public.live_bank_statement_imports (
  id uuid primary key default gen_random_uuid(),
  import_no text not null unique,
  bank_account_id uuid references public.bank_accounts(id) on delete set null,
  account_code text,
  period_start date not null,
  period_end date not null,
  status text not null default 'draft' check (status in ('draft','validated','posted','reconciled','blocked','cancelled')),
  total_amount numeric not null default 0,
  line_count int not null default 0,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  posted_at timestamptz
);

create table if not exists public.live_bank_statement_import_lines (
  id uuid primary key default gen_random_uuid(),
  import_id uuid not null references public.live_bank_statement_imports(id) on delete cascade,
  bank_account_id uuid references public.bank_accounts(id) on delete set null,
  account_code text,
  statement_date date not null,
  description text not null,
  amount numeric not null,
  reference text,
  matched_journal_line_id uuid references public.finance_journal_lines_backend(id) on delete set null,
  status text not null default 'unmatched' check (status in ('unmatched','matched','adjustment_needed','ignored'))
);

create table if not exists public.live_bank_reconciliation_runs (
  id uuid primary key default gen_random_uuid(),
  bank_account_id uuid references public.bank_accounts(id) on delete set null,
  period_start date not null,
  period_end date not null,
  matched_amount numeric not null default 0,
  unmatched_amount numeric not null default 0,
  difference_amount numeric not null default 0,
  status text not null default 'draft' check (status in ('draft','matched','has_differences','posted','cancelled')),
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  posted_at timestamptz
);

create table if not exists public.live_vat_settlement_runs (
  id uuid primary key default gen_random_uuid(),
  settlement_no text not null unique,
  period_start date not null,
  period_end date not null,
  branch_id text references public.branches(id) on delete set null,
  input_vat numeric not null default 0,
  output_vat numeric not null default 0,
  net_vat_payable numeric not null default 0,
  reviewed_by_note text,
  status text not null default 'draft' check (status in ('draft','validated','posted','paid','blocked','cancelled')),
  journal_id uuid references public.finance_journal_entries_backend(id) on delete set null,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  posted_at timestamptz
);

create table if not exists public.live_vat_adjustments (
  id uuid primary key default gen_random_uuid(),
  source_id text,
  direction text not null check (direction in ('input','output')),
  taxable_amount numeric not null default 0,
  vat_amount numeric not null default 0,
  reason text not null,
  status text not null default 'posted' check (status in ('draft','posted','cancelled','reversed')),
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);

create table if not exists public.live_period_close_requests (
  id uuid primary key default gen_random_uuid(),
  close_no text not null unique,
  fiscal_period_id uuid references public.fiscal_periods(id) on delete restrict,
  branch_id text references public.branches(id) on delete set null,
  requested_by_note text,
  backup_confirmed boolean not null default false,
  trial_balance_balanced boolean not null default false,
  inventory_reconciled boolean not null default false,
  ap_reconciled boolean not null default false,
  ar_reconciled boolean not null default false,
  bank_reconciled boolean not null default false,
  vat_reviewed boolean not null default false,
  critical_count int not null default 0,
  warning_count int not null default 0,
  status text not null default 'draft' check (status in ('draft','validated','approved','closed','blocked','cancelled')),
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  closed_at timestamptz
);

create index if not exists idx_live_bank_statement_imports_period on public.live_bank_statement_imports(period_start, period_end, status);
create index if not exists idx_live_bank_statement_import_lines_import on public.live_bank_statement_import_lines(import_id, status);
create index if not exists idx_live_bank_reconciliation_runs_period on public.live_bank_reconciliation_runs(bank_account_id, period_start, period_end);
create index if not exists idx_live_vat_settlement_runs_period on public.live_vat_settlement_runs(period_start, period_end, branch_id);
create index if not exists idx_live_period_close_requests_period on public.live_period_close_requests(fiscal_period_id, branch_id, status);

alter table public.live_bank_statement_imports enable row level security;
alter table public.live_bank_statement_import_lines enable row level security;
alter table public.live_bank_reconciliation_runs enable row level security;
alter table public.live_vat_settlement_runs enable row level security;
alter table public.live_vat_adjustments enable row level security;
alter table public.live_period_close_requests enable row level security;

create or replace function public.live_bank_import_statement(statement_payload jsonb, lines_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_import_id uuid;
  v_total numeric := 0;
  v_line_count int := 0;
begin
  select coalesce(sum((line_item->>'amount')::numeric), 0), count(*)
  into v_total, v_line_count
  from jsonb_array_elements(lines_payload) as line_item;

  insert into public.live_bank_statement_imports (
    import_no,
    bank_account_id,
    account_code,
    period_start,
    period_end,
    status,
    total_amount,
    line_count,
    created_by,
    posted_at
  )
  values (
    statement_payload->>'import_no',
    nullif(statement_payload->>'bank_account_id','')::uuid,
    statement_payload->>'account_code',
    (statement_payload->>'period_start')::date,
    (statement_payload->>'period_end')::date,
    'posted',
    v_total,
    v_line_count,
    auth.uid(),
    now()
  )
  returning id into v_import_id;

  insert into public.live_bank_statement_import_lines (
    import_id,
    bank_account_id,
    account_code,
    statement_date,
    description,
    amount,
    reference
  )
  select
    v_import_id,
    nullif(line_item->>'bank_account_id','')::uuid,
    line_item->>'account_code',
    (line_item->>'statement_date')::date,
    line_item->>'description',
    (line_item->>'amount')::numeric,
    line_item->>'reference'
  from jsonb_array_elements(lines_payload) as line_item;

  return jsonb_build_object('ok', true, 'message', 'Bank statement imported foundation.', 'id', v_import_id);
end;
$$;

create or replace function public.live_bank_match_statement_line(
  statement_line_id uuid,
  journal_line_id uuid,
  matched_amount numeric,
  notes text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.live_bank_statement_import_lines
  set matched_journal_line_id = journal_line_id,
      status = 'matched'
  where id = statement_line_id;

  return jsonb_build_object(
    'ok', true,
    'message', 'Bank statement line matched foundation.',
    'statement_line_id', statement_line_id,
    'journal_line_id', journal_line_id,
    'matched_amount', matched_amount
  );
end;
$$;

create or replace function public.live_bank_create_reconciliation_run(
  bank_account_id uuid,
  period_start date,
  period_end date
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_run_id uuid;
  v_matched numeric := 0;
  v_unmatched numeric := 0;
begin
  select
    coalesce(sum(amount) filter (where status = 'matched'), 0),
    coalesce(sum(amount) filter (where status = 'unmatched'), 0)
  into v_matched, v_unmatched
  from public.live_bank_statement_import_lines
  where live_bank_statement_import_lines.bank_account_id = live_bank_create_reconciliation_run.bank_account_id;

  insert into public.live_bank_reconciliation_runs (
    bank_account_id,
    period_start,
    period_end,
    matched_amount,
    unmatched_amount,
    difference_amount,
    status,
    created_by
  )
  values (
    bank_account_id,
    period_start,
    period_end,
    v_matched,
    v_unmatched,
    v_unmatched,
    case when abs(v_unmatched) <= 0.01 then 'matched' else 'has_differences' end,
    auth.uid()
  )
  returning id into v_run_id;

  return jsonb_build_object('ok', true, 'message', 'Bank reconciliation run created foundation.', 'id', v_run_id);
end;
$$;

create or replace function public.live_vat_create_settlement(settlement_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
  v_input numeric := 0;
  v_output numeric := 0;
begin
  select
    coalesce(sum(vat_amount) filter (where direction = 'input'), 0),
    coalesce(sum(vat_amount) filter (where direction = 'output'), 0)
  into v_input, v_output
  from public.vat_transactions
  where status = 'posted'
    and tax_date between (settlement_payload->>'period_start')::date and (settlement_payload->>'period_end')::date
    and (
      nullif(settlement_payload->>'branch_id','') is null
      or vat_transactions.branch_id = nullif(settlement_payload->>'branch_id','')
    );

  insert into public.live_vat_settlement_runs (
    settlement_no,
    period_start,
    period_end,
    branch_id,
    input_vat,
    output_vat,
    net_vat_payable,
    reviewed_by_note,
    status,
    created_by,
    posted_at
  )
  values (
    settlement_payload->>'settlement_no',
    (settlement_payload->>'period_start')::date,
    (settlement_payload->>'period_end')::date,
    nullif(settlement_payload->>'branch_id',''),
    v_input,
    v_output,
    v_output - v_input,
    settlement_payload->>'reviewed_by_note',
    'posted',
    auth.uid(),
    now()
  )
  returning id into v_id;

  return jsonb_build_object('ok', true, 'message', 'VAT settlement created foundation.', 'id', v_id);
end;
$$;

create or replace function public.live_vat_post_adjustment(adjustment_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  insert into public.live_vat_adjustments (
    source_id,
    direction,
    taxable_amount,
    vat_amount,
    reason,
    status,
    created_by
  )
  values (
    adjustment_payload->>'source_id',
    adjustment_payload->>'direction',
    (adjustment_payload->>'taxable_amount')::numeric,
    (adjustment_payload->>'vat_amount')::numeric,
    adjustment_payload->>'reason',
    'posted',
    auth.uid()
  )
  returning id into v_id;

  return jsonb_build_object('ok', true, 'message', 'VAT adjustment posted foundation.', 'id', v_id);
end;
$$;

create or replace function public.live_finance_request_period_close(close_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
  v_critical int := 0;
begin
  if coalesce((close_payload->>'backup_confirmed')::boolean, false) = false then v_critical := v_critical + 1; end if;
  if coalesce((close_payload->>'trial_balance_balanced')::boolean, false) = false then v_critical := v_critical + 1; end if;
  if coalesce((close_payload->>'inventory_reconciled')::boolean, false) = false then v_critical := v_critical + 1; end if;
  if coalesce((close_payload->>'ap_reconciled')::boolean, false) = false then v_critical := v_critical + 1; end if;
  if coalesce((close_payload->>'ar_reconciled')::boolean, false) = false then v_critical := v_critical + 1; end if;
  if coalesce((close_payload->>'bank_reconciled')::boolean, false) = false then v_critical := v_critical + 1; end if;
  if coalesce((close_payload->>'vat_reviewed')::boolean, false) = false then v_critical := v_critical + 1; end if;

  insert into public.live_period_close_requests (
    close_no,
    fiscal_period_id,
    branch_id,
    requested_by_note,
    backup_confirmed,
    trial_balance_balanced,
    inventory_reconciled,
    ap_reconciled,
    ar_reconciled,
    bank_reconciled,
    vat_reviewed,
    critical_count,
    status,
    created_by,
    closed_at
  )
  values (
    close_payload->>'close_no',
    nullif(close_payload->>'fiscal_period_id','')::uuid,
    nullif(close_payload->>'branch_id',''),
    close_payload->>'requested_by_note',
    coalesce((close_payload->>'backup_confirmed')::boolean, false),
    coalesce((close_payload->>'trial_balance_balanced')::boolean, false),
    coalesce((close_payload->>'inventory_reconciled')::boolean, false),
    coalesce((close_payload->>'ap_reconciled')::boolean, false),
    coalesce((close_payload->>'ar_reconciled')::boolean, false),
    coalesce((close_payload->>'bank_reconciled')::boolean, false),
    coalesce((close_payload->>'vat_reviewed')::boolean, false),
    v_critical,
    case when v_critical = 0 then 'closed' else 'blocked' end,
    auth.uid(),
    case when v_critical = 0 then now() else null end
  )
  returning id into v_id;

  return jsonb_build_object(
    'ok', v_critical = 0,
    'message', case when v_critical = 0 then 'Period close completed foundation.' else 'Period close blocked by critical checks.' end,
    'id', v_id,
    'critical_count', v_critical
  );
end;
$$;
do $$
begin
  if to_regprocedure('public.live_bank_import_statement(jsonb, jsonb)') is not null then
    execute 'grant execute on function public.live_bank_import_statement(jsonb, jsonb) to authenticated';
  end if;
end;
$$;
do $$
begin
  if to_regprocedure('public.live_bank_match_statement_line(uuid, uuid, numeric, text)') is not null then
    execute 'grant execute on function public.live_bank_match_statement_line(uuid, uuid, numeric, text) to authenticated';
  end if;
end;
$$;
do $$
begin
  if to_regprocedure('public.live_bank_create_reconciliation_run(uuid, date, date)') is not null then
    execute 'grant execute on function public.live_bank_create_reconciliation_run(uuid, date, date) to authenticated';
  end if;
end;
$$;
do $$
begin
  if to_regprocedure('public.live_vat_create_settlement(jsonb)') is not null then
    execute 'grant execute on function public.live_vat_create_settlement(jsonb) to authenticated';
  end if;
end;
$$;
do $$
begin
  if to_regprocedure('public.live_vat_post_adjustment(jsonb)') is not null then
    execute 'grant execute on function public.live_vat_post_adjustment(jsonb) to authenticated';
  end if;
end;
$$;
do $$
begin
  if to_regprocedure('public.live_finance_request_period_close(jsonb)') is not null then
    execute 'grant execute on function public.live_finance_request_period_close(jsonb) to authenticated';
  end if;
end;
$$;
