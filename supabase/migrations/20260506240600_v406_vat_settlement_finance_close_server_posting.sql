-- v406 VAT Settlement / Finance Close Server Posting
-- Adds backend-authoritative VAT settlement and fiscal-period close functions.
-- This migration is additive and compatible with the current foundation schema.

create extension if not exists pgcrypto;

create table if not exists public.vat_settlement_server_runs (
  id uuid primary key default gen_random_uuid(),
  period_key text not null,
  branch_id text,
  status text not null default 'draft' check (status in ('draft','validated','posted','failed','reversed')),
  output_vat_amount numeric not null default 0,
  input_vat_amount numeric not null default 0,
  net_vat_amount numeric not null default 0,
  settlement_direction text not null default 'zero' check (settlement_direction in ('payable','recoverable','zero')),
  posting_batch_id uuid,
  finance_journal_id uuid,
  source_counts jsonb not null default '{}'::jsonb,
  evidence jsonb not null default '{}'::jsonb,
  posted_by uuid,
  posted_at timestamptz,
  failed_at timestamptz,
  failure_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.vat_settlement_server_lines (
  id uuid primary key default gen_random_uuid(),
  settlement_run_id uuid not null references public.vat_settlement_server_runs(id) on delete cascade,
  line_type text not null check (line_type in ('output','input','net','posting','warning','source')),
  source_table text,
  source_id text,
  account_code text,
  debit_amount numeric not null default 0,
  credit_amount numeric not null default 0,
  vat_amount numeric not null default 0,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.finance_close_server_runs (
  id uuid primary key default gen_random_uuid(),
  period_key text not null,
  branch_id text,
  status text not null default 'running' check (status in ('running','blocked','closed','failed','reopened')),
  blocker_count integer not null default 0,
  warning_count integer not null default 0,
  close_mode text not null default 'normal' check (close_mode in ('normal','forced','dry_run')),
  evidence jsonb not null default '{}'::jsonb,
  closed_by uuid,
  closed_at timestamptz,
  failed_at timestamptz,
  failure_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.finance_close_server_checks (
  id uuid primary key default gen_random_uuid(),
  close_run_id uuid not null references public.finance_close_server_runs(id) on delete cascade,
  check_key text not null,
  check_name text not null,
  status text not null default 'pending' check (status in ('passed','warning','blocked','pending')),
  severity text not null default 'info' check (severity in ('info','warning','critical')),
  finding_count integer not null default 0,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.finance_close_server_events (
  id uuid primary key default gen_random_uuid(),
  event_scope text not null default 'finance-close',
  settlement_run_id uuid references public.vat_settlement_server_runs(id) on delete set null,
  close_run_id uuid references public.finance_close_server_runs(id) on delete set null,
  event_type text not null,
  severity text not null default 'info' check (severity in ('info','warning','critical')),
  message text,
  details jsonb not null default '{}'::jsonb,
  actor_id uuid,
  created_at timestamptz not null default now()
);

create unique index if not exists vat_settlement_server_runs_period_branch_posted_uidx
on public.vat_settlement_server_runs(period_key, coalesce(branch_id, '*'))
where status = 'posted';

create index if not exists vat_settlement_server_runs_period_idx on public.vat_settlement_server_runs(period_key, branch_id, status, created_at desc);
create index if not exists vat_settlement_server_lines_run_idx on public.vat_settlement_server_lines(settlement_run_id, line_type, created_at desc);
create index if not exists finance_close_server_runs_period_idx on public.finance_close_server_runs(period_key, branch_id, status, created_at desc);
create index if not exists finance_close_server_checks_run_idx on public.finance_close_server_checks(close_run_id, status, severity, check_key);
create index if not exists finance_close_server_events_scope_idx on public.finance_close_server_events(event_scope, event_type, created_at desc);

alter table public.vat_settlement_server_runs enable row level security;
alter table public.vat_settlement_server_lines enable row level security;
alter table public.finance_close_server_runs enable row level security;
alter table public.finance_close_server_checks enable row level security;
alter table public.finance_close_server_events enable row level security;

drop policy if exists vat_settlement_server_runs_read_authenticated_v406 on public.vat_settlement_server_runs;
create policy vat_settlement_server_runs_read_authenticated_v406 on public.vat_settlement_server_runs for select to authenticated using (true);
drop policy if exists vat_settlement_server_lines_read_authenticated_v406 on public.vat_settlement_server_lines;
create policy vat_settlement_server_lines_read_authenticated_v406 on public.vat_settlement_server_lines for select to authenticated using (true);
drop policy if exists finance_close_server_runs_read_authenticated_v406 on public.finance_close_server_runs;
create policy finance_close_server_runs_read_authenticated_v406 on public.finance_close_server_runs for select to authenticated using (true);
drop policy if exists finance_close_server_checks_read_authenticated_v406 on public.finance_close_server_checks;
create policy finance_close_server_checks_read_authenticated_v406 on public.finance_close_server_checks for select to authenticated using (true);
drop policy if exists finance_close_server_events_read_authenticated_v406 on public.finance_close_server_events;
create policy finance_close_server_events_read_authenticated_v406 on public.finance_close_server_events for select to authenticated using (true);

create or replace function public.finance_server_record_event(
  p_event_scope text,
  p_settlement_run_id uuid default null,
  p_close_run_id uuid default null,
  p_event_type text default 'event',
  p_severity text default 'info',
  p_message text default null,
  p_details jsonb default '{}'::jsonb
) returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.finance_close_server_events(event_scope, settlement_run_id, close_run_id, event_type, severity, message, details, actor_id)
  values (
    coalesce(nullif(p_event_scope, ''), 'finance-close'),
    p_settlement_run_id,
    p_close_run_id,
    coalesce(nullif(p_event_type, ''), 'event'),
    coalesce(nullif(p_severity, ''), 'info'),
    p_message,
    coalesce(p_details, '{}'::jsonb),
    auth.uid()
  );
end;
$$;

create or replace function public.finance_v406_permission_ok(p_permission text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ok boolean := true;
begin
  if to_regprocedure('public.app_current_user_has_permission(text)') is not null and auth.uid() is not null then
    execute 'select public.app_current_user_has_permission($1)' into v_ok using p_permission;
  end if;
  return coalesce(v_ok, false);
end;
$$;

create or replace function public.finance_v406_source_count(p_table text)
returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count bigint := null;
begin
  if to_regclass('public.' || p_table) is not null then
    execute format('select count(*) from public.%I', p_table) into v_count;
  end if;
  return v_count;
end;
$$;

create or replace function public.finance_post_vat_settlement_server(
  p_period_key text,
  p_branch_id text default null,
  p_output_vat_amount numeric default null,
  p_input_vat_amount numeric default null,
  p_options jsonb default '{}'::jsonb
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_run_id uuid;
  v_output numeric := coalesce(p_output_vat_amount, 0);
  v_input numeric := coalesce(p_input_vat_amount, 0);
  v_net numeric;
  v_direction text;
  v_batch_id uuid := gen_random_uuid();
  v_journal_id uuid := gen_random_uuid();
  v_sources jsonb := '{}'::jsonb;
  v_allow_manual boolean := coalesce((p_options->>'allowManualAmounts')::boolean, true);
begin
  if p_period_key is null or btrim(p_period_key) = '' then
    raise exception 'period_key is required';
  end if;

  if not public.finance_v406_permission_ok('finance.post') then
    raise exception 'permission denied: finance.post';
  end if;

  -- Prevent duplicate posting for the same period/branch.
  if exists (
    select 1
    from public.vat_settlement_server_runs
    where period_key = p_period_key
      and coalesce(branch_id, '*') = coalesce(p_branch_id, '*')
      and status = 'posted'
  ) then
    raise exception 'duplicate VAT settlement posting is blocked for period %, branch %', p_period_key, coalesce(p_branch_id, '*');
  end if;

  -- Collect source counts for evidence. This is deliberately tolerant because earlier modules may not yet exist.
  v_sources := jsonb_build_object(
    'vat_transactions', public.finance_v406_source_count('vat_transactions'),
    'vat_input_transactions', public.finance_v406_source_count('vat_input_transactions'),
    'vat_output_transactions', public.finance_v406_source_count('vat_output_transactions'),
    'finance_journal_lines_backend', public.finance_v406_source_count('finance_journal_lines_backend'),
    'sales_pos_batches', public.finance_v406_source_count('sales_pos_batches'),
    'purchase_invoices', public.finance_v406_source_count('purchase_invoices')
  );

  -- Optional automatic totals from common VAT tables if present. Manual values remain supported for early pilot.
  if to_regclass('public.vat_output_transactions') is not null and p_output_vat_amount is null then
    begin
      execute 'select coalesce(sum(vat_amount),0) from public.vat_output_transactions'
      into v_output;
    exception when undefined_column then
      v_output := coalesce(p_output_vat_amount, 0);
    end;
  end if;

  if to_regclass('public.vat_input_transactions') is not null and p_input_vat_amount is null then
    begin
      execute 'select coalesce(sum(vat_amount),0) from public.vat_input_transactions'
      into v_input;
    exception when undefined_column then
      v_input := coalesce(p_input_vat_amount, 0);
    end;
  end if;

  if not v_allow_manual and v_output = 0 and v_input = 0 then
    raise exception 'no VAT source totals found and manual amounts are disabled';
  end if;

  v_net := round(coalesce(v_output,0) - coalesce(v_input,0), 2);
  v_direction := case when v_net > 0 then 'payable' when v_net < 0 then 'recoverable' else 'zero' end;

  insert into public.vat_settlement_server_runs(period_key, branch_id, status, output_vat_amount, input_vat_amount, net_vat_amount, settlement_direction, posting_batch_id, finance_journal_id, source_counts, evidence, posted_by, posted_at)
  values (
    p_period_key,
    p_branch_id,
    'posted',
    coalesce(v_output,0),
    coalesce(v_input,0),
    v_net,
    v_direction,
    v_batch_id,
    v_journal_id,
    v_sources,
    jsonb_build_object('options', coalesce(p_options, '{}'::jsonb), 'duplicate', false, 'serverSide', true),
    auth.uid(),
    now()
  )
  returning id into v_run_id;

  insert into public.vat_settlement_server_lines(settlement_run_id, line_type, account_code, debit_amount, credit_amount, vat_amount, details)
  values
    (v_run_id, 'output', coalesce(p_options->>'vatOutputAccount', 'VAT-OUTPUT'), 0, greatest(v_output, 0), coalesce(v_output,0), jsonb_build_object('source', 'VAT output evidence')),
    (v_run_id, 'input', coalesce(p_options->>'vatInputAccount', 'VAT-INPUT'), greatest(v_input, 0), 0, coalesce(v_input,0), jsonb_build_object('source', 'VAT input evidence')),
    (v_run_id, 'net', coalesce(p_options->>'vatSettlementAccount', 'VAT-SETTLEMENT'), case when v_net < 0 then abs(v_net) else 0 end, case when v_net > 0 then v_net else 0 end, v_net, jsonb_build_object('direction', v_direction));

  -- If the generic v375/v401 style worker posting audit exists, leave an artifact there too.
  if to_regprocedure('public.worker_record_artifact(uuid, uuid, text, text, text, jsonb)') is not null then
    -- Not tied to a worker job here; main evidence is in finance_close_server_events.
    null;
  end if;

  perform public.finance_server_record_event('vat-settlement', v_run_id, null, 'vat_settlement.posted', 'info', 'VAT settlement posted by server RPC', jsonb_build_object('periodKey', p_period_key, 'branchId', p_branch_id, 'netVat', v_net, 'direction', v_direction));
  return v_run_id;
exception when others then
  insert into public.vat_settlement_server_runs(period_key, branch_id, status, output_vat_amount, input_vat_amount, net_vat_amount, settlement_direction, source_counts, evidence, failed_at, failure_reason)
  values (coalesce(p_period_key, 'UNKNOWN'), p_branch_id, 'failed', coalesce(v_output,0), coalesce(v_input,0), coalesce(v_net,0), coalesce(v_direction, 'zero'), coalesce(v_sources, '{}'::jsonb), jsonb_build_object('serverSide', true), now(), sqlerrm)
  returning id into v_run_id;
  perform public.finance_server_record_event('vat-settlement', v_run_id, null, 'vat_settlement.failed', 'critical', sqlerrm, jsonb_build_object('periodKey', p_period_key, 'branchId', p_branch_id));
  raise;
end;
$$;

create or replace function public.finance_close_period_server(
  p_period_key text,
  p_branch_id text default null,
  p_options jsonb default '{}'::jsonb
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_close_id uuid;
  v_blockers integer := 0;
  v_warnings integer := 0;
  v_force boolean := coalesce((p_options->>'force')::boolean, false);
  v_dry_run boolean := coalesce((p_options->>'dryRun')::boolean, false);
  v_mode text := case when v_dry_run then 'dry_run' when v_force then 'forced' else 'normal' end;
  v_open_jobs bigint := 0;
  v_unposted_purchase bigint := 0;
  v_unposted_pos bigint := 0;
  v_vat_settled boolean := false;
begin
  if p_period_key is null or btrim(p_period_key) = '' then
    raise exception 'period_key is required';
  end if;

  if not public.finance_v406_permission_ok('finance.post') then
    raise exception 'permission denied: finance.post';
  end if;

  insert into public.finance_close_server_runs(period_key, branch_id, status, close_mode, evidence, closed_by)
  values (p_period_key, p_branch_id, 'running', v_mode, jsonb_build_object('options', coalesce(p_options, '{}'::jsonb), 'serverSide', true), auth.uid())
  returning id into v_close_id;

  select exists (
    select 1 from public.vat_settlement_server_runs
    where period_key = p_period_key and coalesce(branch_id, '*') = coalesce(p_branch_id, '*') and status = 'posted'
  ) into v_vat_settled;

  if not v_vat_settled then
    v_blockers := v_blockers + 1;
    insert into public.finance_close_server_checks(close_run_id, check_key, check_name, status, severity, finding_count, details)
    values (v_close_id, 'vat_settlement_required', 'VAT settlement must be posted before close', 'blocked', 'critical', 1, jsonb_build_object('periodKey', p_period_key, 'branchId', p_branch_id));
  else
    insert into public.finance_close_server_checks(close_run_id, check_key, check_name, status, severity, finding_count, details)
    values (v_close_id, 'vat_settlement_required', 'VAT settlement posted', 'passed', 'info', 0, jsonb_build_object('periodKey', p_period_key, 'branchId', p_branch_id));
  end if;

  if to_regclass('public.worker_jobs') is not null then
    execute 'select count(*) from public.worker_jobs where status in (''queued'',''retry'',''running'')'
    into v_open_jobs;
    if v_open_jobs > 0 then
      v_warnings := v_warnings + 1;
      insert into public.finance_close_server_checks(close_run_id, check_key, check_name, status, severity, finding_count, details)
      values (v_close_id, 'open worker jobs', 'Open worker jobs exist', 'warning', 'warning', v_open_jobs, jsonb_build_object('count', v_open_jobs));
    else
      insert into public.finance_close_server_checks(close_run_id, check_key, check_name, status, severity, finding_count, details)
      values (v_close_id, 'open worker jobs', 'No open worker jobs', 'passed', 'info', 0, '{}'::jsonb);
    end if;
  end if;

  if to_regclass('public.purchase_invoices') is not null then
    begin
      execute 'select count(*) from public.purchase_invoices where coalesce(status, '''') not in (''posted'',''cancelled'',''rejected'')'
      into v_unposted_purchase;
      if v_unposted_purchase > 0 then
        v_blockers := v_blockers + 1;
        insert into public.finance_close_server_checks(close_run_id, check_key, check_name, status, severity, finding_count, details)
        values (v_close_id, 'unposted_purchase', 'Unposted purchase documents exist', 'blocked', 'critical', v_unposted_purchase, jsonb_build_object('count', v_unposted_purchase));
      end if;
    exception when undefined_column then
      v_warnings := v_warnings + 1;
      insert into public.finance_close_server_checks(close_run_id, check_key, check_name, status, severity, finding_count, details)
      values (v_close_id, 'unposted_purchase', 'Purchase invoice status column not available', 'warning', 'warning', 1, '{}'::jsonb);
    end;
  end if;

  if to_regclass('public.sales_pos_batches') is not null then
    begin
      execute 'select count(*) from public.sales_pos_batches where coalesce(status, '''') not in (''posted'',''cancelled'',''rejected'')'
      into v_unposted_pos;
      if v_unposted_pos > 0 then
        v_blockers := v_blockers + 1;
        insert into public.finance_close_server_checks(close_run_id, check_key, check_name, status, severity, finding_count, details)
        values (v_close_id, 'unposted_pos', 'Unposted POS batches exist', 'blocked', 'critical', v_unposted_pos, jsonb_build_object('count', v_unposted_pos));
      end if;
    exception when undefined_column then
      v_warnings := v_warnings + 1;
      insert into public.finance_close_server_checks(close_run_id, check_key, check_name, status, severity, finding_count, details)
      values (v_close_id, 'unposted_pos', 'POS batch status column not available', 'warning', 'warning', 1, '{}'::jsonb);
    end;
  end if;

  if v_blockers > 0 and not v_force then
    update public.finance_close_server_runs
    set status = 'blocked', blocker_count = v_blockers, warning_count = v_warnings, updated_at = now()
    where id = v_close_id;
    perform public.finance_server_record_event('finance-close', null, v_close_id, 'finance_close.blocked', 'critical', 'Close blocked by unresolved checks', jsonb_build_object('blockers', v_blockers, 'warnings', v_warnings));
    return v_close_id;
  end if;

  if not v_dry_run and to_regclass('public.fiscal_periods') is not null then
    begin
      update public.fiscal_periods
      set status = 'closed', closed_by = auth.uid(), closed_at = now()
      where code = p_period_key;
    exception when undefined_column then
      -- Some early schemas may not include closed_by/closed_at. Keep close evidence even if period table is basic.
      update public.fiscal_periods set status = 'closed' where code = p_period_key;
    end;
  end if;

  update public.finance_close_server_runs
  set status = case when v_dry_run then 'closed' else 'closed' end,
      blocker_count = v_blockers,
      warning_count = v_warnings,
      closed_at = now(),
      updated_at = now()
  where id = v_close_id;

  perform public.finance_server_record_event('finance-close', null, v_close_id, 'finance_close.closed', 'info', 'Finance period close completed by server RPC', jsonb_build_object('periodKey', p_period_key, 'branchId', p_branch_id, 'mode', v_mode, 'blockers', v_blockers, 'warnings', v_warnings));
  return v_close_id;
exception when others then
  update public.finance_close_server_runs
  set status = 'failed', failed_at = now(), failure_reason = sqlerrm, updated_at = now()
  where id = v_close_id;
  perform public.finance_server_record_event('finance-close', null, v_close_id, 'finance_close.failed', 'critical', sqlerrm, jsonb_build_object('periodKey', p_period_key, 'branchId', p_branch_id));
  raise;
end;
$$;

create or replace function public.finance_post_vat_settlement(
  p_period_key text,
  p_branch_id text default null,
  p_options jsonb default '{}'::jsonb
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
begin
  return public.finance_post_vat_settlement_server(p_period_key, p_branch_id, null, null, p_options);
end;
$$;

create or replace function public.finance_close_period(
  p_period_key text,
  p_branch_id text default null,
  p_options jsonb default '{}'::jsonb
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
begin
  return public.finance_close_period_server(p_period_key, p_branch_id, p_options);
end;
$$;

revoke execute on function public.finance_post_vat_settlement_server(text, text, numeric, numeric, jsonb) from public;
revoke execute on function public.finance_post_vat_settlement_server(text, text, numeric, numeric, jsonb) from authenticated;
revoke execute on function public.finance_close_period_server(text, text, jsonb) from public;
revoke execute on function public.finance_close_period_server(text, text, jsonb) from authenticated;

grant execute on function public.finance_post_vat_settlement_server(text, text, numeric, numeric, jsonb) to service_role;
grant execute on function public.finance_close_period_server(text, text, jsonb) to service_role;

grant execute on function public.finance_post_vat_settlement(text, text, jsonb) to authenticated;
grant execute on function public.finance_close_period(text, text, jsonb) to authenticated;
