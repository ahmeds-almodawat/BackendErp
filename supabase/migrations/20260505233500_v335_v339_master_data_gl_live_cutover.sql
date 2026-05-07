-- v335-v339 Master Data + GL Live Cutover Gate
-- Additive only. Does not rewrite AppShell or apply migrations automatically.

create extension if not exists pgcrypto;

create table if not exists public.live_master_data_cutover_runs (
  id uuid primary key default gen_random_uuid(),
  resource text not null,
  source_file_id text,
  status text not null default 'draft' check (status in ('draft','validated','approved','posted','blocked','cancelled')),
  approved_by_note text,
  notes text,
  critical_count int not null default 0,
  warning_count int not null default 0,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  posted_at timestamptz
);

create table if not exists public.master_data_live_import_batches (
  id uuid primary key default gen_random_uuid(),
  source_type text not null,
  file_name text not null,
  row_count int not null default 0,
  status text not null default 'draft' check (status in ('draft','validated','approved','posted','blocked','cancelled')),
  approved_by_note text,
  business_reason text,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  posted_at timestamptz
);

create table if not exists public.opening_balance_batches_live (
  id uuid primary key default gen_random_uuid(),
  batch_no text not null unique,
  fiscal_period_id uuid references public.fiscal_periods(id) on delete restrict,
  branch_id text references public.branches(id) on delete set null,
  opening_date date not null,
  status text not null default 'draft' check (status in ('draft','validated','approved','posted','blocked','cancelled','reversed')),
  journal_id uuid references public.finance_journal_entries_backend(id) on delete set null,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  posted_at timestamptz
);

create table if not exists public.opening_balance_lines_live (
  id uuid primary key default gen_random_uuid(),
  batch_id uuid not null references public.opening_balance_batches_live(id) on delete cascade,
  account_code text not null,
  branch_id text references public.branches(id) on delete set null,
  debit numeric not null default 0 check (debit >= 0),
  credit numeric not null default 0 check (credit >= 0),
  memo text,
  constraint opening_balance_line_one_side check (
    (debit > 0 and credit = 0) or (credit > 0 and debit = 0)
  )
);

create table if not exists public.gl_live_report_requests (
  id uuid primary key default gen_random_uuid(),
  report_type text not null,
  period_start date not null,
  period_end date not null,
  branch_id text references public.branches(id) on delete set null,
  status text not null default 'draft' check (status in ('draft','running','completed','failed','cancelled')),
  truth_status text not null default 'incomplete',
  source_tables jsonb not null default '[]'::jsonb,
  findings jsonb not null default '[]'::jsonb,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

create index if not exists idx_live_master_data_cutover_runs_resource on public.live_master_data_cutover_runs(resource, status);
create index if not exists idx_master_data_live_import_batches_source on public.master_data_live_import_batches(source_type, status);
create index if not exists idx_opening_balance_batches_live_period on public.opening_balance_batches_live(fiscal_period_id, branch_id, status);
create index if not exists idx_gl_live_report_requests_period on public.gl_live_report_requests(report_type, period_start, period_end, branch_id);

alter table public.live_master_data_cutover_runs enable row level security;
alter table public.master_data_live_import_batches enable row level security;
alter table public.opening_balance_batches_live enable row level security;
alter table public.opening_balance_lines_live enable row level security;
alter table public.gl_live_report_requests enable row level security;

create or replace function public.live_master_data_post_cutover_run(run_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.live_master_data_cutover_runs
  set status = 'posted',
      posted_at = now()
  where id = run_id
    and status in ('validated','approved');

  return jsonb_build_object('ok', true, 'message', 'Master data cutover run posted foundation.', 'id', run_id);
end;
$$;

create or replace function public.live_finance_create_and_post_manual_journal(journal_payload jsonb, lines_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  return public.finance_create_journal_with_lines(journal_payload, lines_payload);
end;
$$;

create or replace function public.live_finance_post_opening_balance(batch_payload jsonb, lines_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_batch_id uuid;
  v_journal_result jsonb;
begin
  insert into public.opening_balance_batches_live (
    batch_no,
    fiscal_period_id,
    branch_id,
    opening_date,
    status,
    created_by
  )
  values (
    batch_payload->>'batch_no',
    nullif(batch_payload->>'fiscal_period_id','')::uuid,
    nullif(batch_payload->>'branch_id',''),
    (batch_payload->>'opening_date')::date,
    'validated',
    auth.uid()
  )
  returning id into v_batch_id;

  insert into public.opening_balance_lines_live (
    batch_id,
    account_code,
    branch_id,
    debit,
    credit,
    memo
  )
  select
    v_batch_id,
    line_item->>'account_code',
    nullif(line_item->>'branch_id',''),
    coalesce((line_item->>'debit')::numeric, 0),
    coalesce((line_item->>'credit')::numeric, 0),
    line_item->>'memo'
  from jsonb_array_elements(lines_payload) as line_item;

  v_journal_result := public.finance_create_journal_with_lines(
    jsonb_build_object(
      'journal_no', batch_payload->>'batch_no',
      'journal_date', batch_payload->>'opening_date',
      'branch_id', batch_payload->>'branch_id',
      'fiscal_period_id', batch_payload->>'fiscal_period_id',
      'source_type', 'opening_balance',
      'source_id', v_batch_id::text,
      'description', 'Opening balance'
    ),
    lines_payload
  );

  update public.opening_balance_batches_live
  set status = case when (v_journal_result->>'ok')::boolean then 'posted' else 'blocked' end,
      journal_id = nullif(v_journal_result->>'id','')::uuid,
      posted_at = case when (v_journal_result->>'ok')::boolean then now() else null end
  where id = v_batch_id;

  return jsonb_build_object('ok', (v_journal_result->>'ok')::boolean, 'message', 'Opening balance processed.', 'id', v_batch_id, 'journal', v_journal_result);
end;
$$;

create or replace function public.live_finance_run_gl_report(
  report_type text,
  period_start date,
  period_end date,
  branch_id text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_request_id uuid;
begin
  insert into public.gl_live_report_requests (
    report_type,
    period_start,
    period_end,
    branch_id,
    status,
    truth_status,
    source_tables,
    created_by,
    completed_at
  )
  values (
    report_type,
    period_start,
    period_end,
    branch_id,
    'completed',
    'warning',
    jsonb_build_array('finance_journal_entries_backend','finance_journal_lines_backend','chart_accounts'),
    auth.uid(),
    now()
  )
  returning id into v_request_id;

  return jsonb_build_object(
    'ok', true,
    'message', 'GL report request registered. Detailed reporting should read from finance journal backend tables.',
    'id', v_request_id,
    'report_type', report_type
  );
end;
$$;
do $$
begin
  if to_regprocedure('public.live_master_data_post_cutover_run(uuid)') is not null then
    execute 'grant execute on function public.live_master_data_post_cutover_run(uuid) to authenticated';
  end if;
end;
$$;
do $$
begin
  if to_regprocedure('public.live_finance_create_and_post_manual_journal(jsonb, jsonb)') is not null then
    execute 'grant execute on function public.live_finance_create_and_post_manual_journal(jsonb, jsonb) to authenticated';
  end if;
end;
$$;
do $$
begin
  if to_regprocedure('public.live_finance_post_opening_balance(jsonb, jsonb)') is not null then
    execute 'grant execute on function public.live_finance_post_opening_balance(jsonb, jsonb) to authenticated';
  end if;
end;
$$;
do $$
begin
  if to_regprocedure('public.live_finance_run_gl_report(text, date, date, uuid)') is not null then
    execute 'grant execute on function public.live_finance_run_gl_report(text, date, date, uuid) to authenticated';
  end if;
end;
$$;
