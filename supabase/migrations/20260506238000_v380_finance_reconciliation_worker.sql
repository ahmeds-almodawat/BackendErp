-- v380 Finance Reconciliation Worker
-- Adds a resumable finance reconciliation worker lane on top of the v375 worker runtime.
-- This patch records reconciliation evidence and mismatches only. It does not post,
-- reverse, or mutate accounting entries.

create extension if not exists pgcrypto;

create table if not exists public.finance_reconciliation_runs (
  id uuid primary key default gen_random_uuid(),
  job_id uuid references public.worker_jobs(id) on delete set null,
  run_id uuid references public.worker_job_runs(id) on delete set null,
  reconciliation_scope text not null default 'trial_balance',
  branch_id text,
  period_key text,
  status text not null default 'queued',
  source_counts jsonb not null default '{}'::jsonb,
  totals jsonb not null default '{}'::jsonb,
  mismatch_count integer not null default 0,
  warning_count integer not null default 0,
  evidence jsonb not null default '{}'::jsonb,
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.finance_reconciliation_checks (
  id uuid primary key default gen_random_uuid(),
  reconciliation_run_id uuid not null references public.finance_reconciliation_runs(id) on delete cascade,
  check_key text not null,
  check_name text not null,
  status text not null default 'pending',
  severity text not null default 'info',
  expected_value numeric,
  actual_value numeric,
  difference_value numeric,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.finance_reconciliation_mismatches (
  id uuid primary key default gen_random_uuid(),
  reconciliation_run_id uuid not null references public.finance_reconciliation_runs(id) on delete cascade,
  check_key text not null,
  source_table text,
  source_id text,
  branch_id text,
  period_key text,
  severity text not null default 'warning',
  message text not null,
  expected_value numeric,
  actual_value numeric,
  difference_value numeric,
  details jsonb not null default '{}'::jsonb,
  resolved_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.finance_reconciliation_events (
  id uuid primary key default gen_random_uuid(),
  reconciliation_run_id uuid references public.finance_reconciliation_runs(id) on delete set null,
  job_id uuid references public.worker_jobs(id) on delete set null,
  run_id uuid references public.worker_job_runs(id) on delete set null,
  event_type text not null,
  severity text not null default 'info',
  message text,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists finance_reconciliation_runs_job_idx on public.finance_reconciliation_runs(job_id, run_id, status, created_at desc);
create index if not exists finance_reconciliation_runs_scope_idx on public.finance_reconciliation_runs(reconciliation_scope, branch_id, period_key, created_at desc);
create index if not exists finance_reconciliation_checks_run_idx on public.finance_reconciliation_checks(reconciliation_run_id, status, severity, check_key);
create index if not exists finance_reconciliation_mismatches_run_idx on public.finance_reconciliation_mismatches(reconciliation_run_id, severity, resolved_at, created_at desc);
create index if not exists finance_reconciliation_events_run_idx on public.finance_reconciliation_events(reconciliation_run_id, event_type, created_at desc);

alter table public.finance_reconciliation_runs enable row level security;
alter table public.finance_reconciliation_checks enable row level security;
alter table public.finance_reconciliation_mismatches enable row level security;
alter table public.finance_reconciliation_events enable row level security;

drop policy if exists finance_reconciliation_runs_read_authenticated_v380 on public.finance_reconciliation_runs;

create policy finance_reconciliation_runs_read_authenticated_v380
on public.finance_reconciliation_runs
for select to authenticated using (true)
;
drop policy if exists finance_reconciliation_checks_read_authenticated_v380 on public.finance_reconciliation_checks;

create policy finance_reconciliation_checks_read_authenticated_v380
on public.finance_reconciliation_checks
for select to authenticated using (true)
;
drop policy if exists finance_reconciliation_mismatches_read_authenticated_v380 on public.finance_reconciliation_mismatches;

create policy finance_reconciliation_mismatches_read_authenticated_v380
on public.finance_reconciliation_mismatches
for select to authenticated using (true)
;
drop policy if exists finance_reconciliation_events_read_authenticated_v380 on public.finance_reconciliation_events;

create policy finance_reconciliation_events_read_authenticated_v380
on public.finance_reconciliation_events
for select to authenticated using (true)
;

create or replace function public.worker_finance_reconciliation_event(
  p_reconciliation_run_id uuid,
  p_job_id uuid,
  p_run_id uuid,
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
  insert into public.finance_reconciliation_events(reconciliation_run_id, job_id, run_id, event_type, severity, message, details)
  values (
    p_reconciliation_run_id,
    p_job_id,
    p_run_id,
    coalesce(nullif(p_event_type, ''), 'finance_reconciliation.event'),
    coalesce(nullif(p_severity, ''), 'info'),
    p_message,
    coalesce(p_details, '{}'::jsonb)
  );
end;
$$;

create or replace function public.worker_finance_reconciliation_source_counts()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_result jsonb := '{}'::jsonb;
  v_count bigint;
  v_table text;
  v_tables text[] := array[
    'finance_journal_lines_backend',
    'finance_journal_entries_backend',
    'posting_batches',
    'ap_subledger_transactions',
    'ar_subledger_transactions',
    'bank_statement_lines',
    'bank_reconciliation_runs',
    'purchase_invoices',
    'supplier_payments',
    'sales_pos_batches',
    'report_snapshot_runs'
  ];
begin
  foreach v_table in array v_tables loop
    if to_regclass('public.' || v_table) is not null then
      execute format('select count(*) from public.%I', v_table) into v_count;
      v_result := v_result || jsonb_build_object(v_table, v_count);
    else
      v_result := v_result || jsonb_build_object(v_table, null);
    end if;
  end loop;

  return v_result;
end;
$$;

create or replace function public.worker_enqueue_finance_reconciliation(
  p_reconciliation_scope text default 'trial_balance',
  p_branch_id text default null,
  p_period_key text default null,
  p_payload jsonb default '{}'::jsonb,
  p_priority text default 'P1',
  p_run_after timestamptz default now()
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_payload jsonb;
  v_job_id uuid;
  v_idempotency_key text;
begin
  v_payload := coalesce(p_payload, '{}'::jsonb)
    || jsonb_build_object(
      'reconciliationScope', coalesce(nullif(p_reconciliation_scope, ''), 'trial_balance'),
      'branchId', p_branch_id,
      'periodKey', p_period_key
    );

  v_idempotency_key := encode(digest('finance.reconciliation:' || coalesce(p_reconciliation_scope, 'trial_balance') || ':' || coalesce(p_branch_id, '*') || ':' || coalesce(p_period_key, '*') || ':' || coalesce(v_payload::text, ''), 'sha256'), 'hex');

  v_job_id := public.worker_enqueue_job(
    'finance.reconciliation',
    v_payload,
    v_idempotency_key,
    'scheduled',
    coalesce(nullif(p_priority, ''), 'P1'),
    'finance',
    'Finance reconciliation worker',
    p_branch_id,
    null,
    3,
    coalesce(p_run_after, now())
  );

  perform public.worker_runtime_audit(v_job_id, null, 'finance_reconciliation.enqueue', 'finance-reconciliation-worker', v_payload);
  return v_job_id;
end;
$$;

create or replace function public.worker_acquire_finance_reconciliation_job(
  p_worker_id text,
  p_lease_seconds integer default 600
) returns table(
  run_id uuid,
  job_id uuid,
  lease_token text,
  payload jsonb,
  attempt_number integer,
  checkpoint jsonb,
  lease_expires_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_job public.worker_jobs%rowtype;
  v_run_id uuid;
  v_lease_token text := encode(gen_random_bytes(24), 'hex');
  v_lease_seconds integer := least(3600, greatest(30, coalesce(p_lease_seconds, 600)));
  v_expires_at timestamptz := now() + make_interval(secs => least(3600, greatest(30, coalesce(p_lease_seconds, 600))));
  v_checkpoint jsonb := '{}'::jsonb;
begin
  if p_worker_id is null or btrim(p_worker_id) = '' then
    raise exception 'worker_id is required';
  end if;

  select * into v_job
  from public.worker_jobs
  where status in ('queued', 'retry')
    and job_type = 'finance.reconciliation'
    and run_after <= now()
  order by case priority when 'P0' then 0 when 'P1' then 1 when 'P2' then 2 else 3 end, created_at
  for update skip locked
  limit 1;

  if v_job.id is null then
    return;
  end if;

  select checkpoint_value into v_checkpoint
  from public.worker_job_checkpoints
  where job_id = v_job.id
  order by created_at desc
  limit 1;

  insert into public.worker_job_runs(job_id, attempt_number, worker_id, lease_token, status, heartbeat_at, checkpoint)
  values (v_job.id, v_job.attempt_count + 1, p_worker_id, v_lease_token, 'running', now(), coalesce(v_checkpoint, '{}'::jsonb))
  returning id into v_run_id;

  insert into public.worker_job_leases(job_id, run_id, worker_id, lease_token, status, acquired_at, expires_at, heartbeat_at)
  values (v_job.id, v_run_id, p_worker_id, v_lease_token, 'active', now(), v_expires_at, now());

  update public.worker_jobs
  set status = 'running', locked_at = now(), attempt_count = attempt_count + 1, updated_at = now()
  where id = v_job.id;

  insert into public.finance_reconciliation_runs(job_id, run_id, reconciliation_scope, branch_id, period_key, status, started_at, source_counts, evidence)
  values (
    v_job.id,
    v_run_id,
    coalesce(v_job.payload->>'reconciliationScope', 'trial_balance'),
    coalesce(v_job.payload->>'branchId', v_job.branch_id),
    v_job.payload->>'periodKey',
    'running',
    now(),
    public.worker_finance_reconciliation_source_counts(),
    jsonb_build_object('workerId', p_worker_id, 'leaseSeconds', v_lease_seconds)
  );

  perform public.worker_runtime_audit(v_job.id, v_run_id, 'finance_reconciliation.acquire', p_worker_id, jsonb_build_object('leaseSeconds', v_lease_seconds));

  return query select v_run_id, v_job.id, v_lease_token, v_job.payload, v_job.attempt_count + 1, coalesce(v_checkpoint, '{}'::jsonb), v_expires_at;
end;
$$;

create or replace function public.worker_run_finance_reconciliation_batch(
  p_worker_id text,
  p_run_id uuid,
  p_lease_token text,
  p_batch_limit integer default 5000
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_job_id uuid;
  v_reconciliation_run_id uuid;
  v_sources jsonb := public.worker_finance_reconciliation_source_counts();
  v_has_lines boolean := (v_sources ? 'finance_journal_lines_backend') and (v_sources->>'finance_journal_lines_backend') is not null;
  v_debit numeric := 0;
  v_credit numeric := 0;
  v_diff numeric := 0;
  v_status text := 'completed';
  v_warning_count integer := 0;
  v_mismatch_count integer := 0;
  v_result jsonb;
begin
  if p_worker_id is null or btrim(p_worker_id) = '' then
    raise exception 'worker_id is required';
  end if;

  select job_id into v_job_id
  from public.worker_job_runs
  where id = p_run_id and lease_token = p_lease_token and status = 'running'
  limit 1;

  if v_job_id is null then
    raise exception 'active run/lease not found';
  end if;

  select id into v_reconciliation_run_id
  from public.finance_reconciliation_runs
  where run_id = p_run_id
  order by created_at desc
  limit 1;

  if v_reconciliation_run_id is null then
    insert into public.finance_reconciliation_runs(job_id, run_id, status, started_at, source_counts)
    values (v_job_id, p_run_id, 'running', now(), v_sources)
    returning id into v_reconciliation_run_id;
  end if;

  if v_has_lines then
    begin
      execute 'select coalesce(sum(debit),0), coalesce(sum(credit),0) from public.finance_journal_lines_backend'
      into v_debit, v_credit;
    exception when undefined_column then
      begin
        execute 'select coalesce(sum(debit_amount),0), coalesce(sum(credit_amount),0) from public.finance_journal_lines_backend'
        into v_debit, v_credit;
      exception when undefined_column then
        v_debit := 0;
        v_credit := 0;
        v_warning_count := v_warning_count + 1;
        insert into public.finance_reconciliation_mismatches(reconciliation_run_id, check_key, source_table, severity, message, details)
        values (v_reconciliation_run_id, 'journal_line_columns', 'finance_journal_lines_backend', 'warning', 'Journal line table exists but expected debit/credit columns were not detected.', jsonb_build_object('sourceCounts', v_sources));
      end;
    end;
  else
    v_warning_count := v_warning_count + 1;
    insert into public.finance_reconciliation_mismatches(reconciliation_run_id, check_key, severity, message, details)
    values (v_reconciliation_run_id, 'missing_journal_lines_source', 'warning', 'No finance journal line source table detected. Reconciliation completed as evidence-only warning.', jsonb_build_object('sourceCounts', v_sources));
  end if;

  v_diff := coalesce(v_debit, 0) - coalesce(v_credit, 0);

  insert into public.finance_reconciliation_checks(reconciliation_run_id, check_key, check_name, status, severity, expected_value, actual_value, difference_value, details)
  values (
    v_reconciliation_run_id,
    'trial_balance_debit_credit',
    'Trial balance debit/credit equality',
    case when abs(v_diff) < 0.005 then 'passed' else 'failed' end,
    case when abs(v_diff) < 0.005 then 'info' else 'critical' end,
    coalesce(v_debit, 0),
    coalesce(v_credit, 0),
    v_diff,
    jsonb_build_object('sourceCounts', v_sources, 'batchLimit', p_batch_limit)
  );

  if abs(v_diff) >= 0.005 then
    v_mismatch_count := v_mismatch_count + 1;
    v_status := 'completed_with_mismatch';
    insert into public.finance_reconciliation_mismatches(reconciliation_run_id, check_key, source_table, severity, message, expected_value, actual_value, difference_value, details)
    values (v_reconciliation_run_id, 'trial_balance_debit_credit', 'finance_journal_lines_backend', 'critical', 'Debit and credit totals do not match.', v_debit, v_credit, v_diff, jsonb_build_object('sourceCounts', v_sources));
  end if;

  update public.finance_reconciliation_runs
  set status = v_status,
      source_counts = v_sources,
      totals = jsonb_build_object('debit', v_debit, 'credit', v_credit, 'difference', v_diff),
      mismatch_count = v_mismatch_count,
      warning_count = v_warning_count,
      completed_at = now(),
      updated_at = now(),
      evidence = coalesce(evidence, '{}'::jsonb) || jsonb_build_object('checkedAt', now(), 'workerId', p_worker_id)
  where id = v_reconciliation_run_id;

  insert into public.worker_job_checkpoints(job_id, run_id, checkpoint_key, checkpoint_value, cursor_value, row_count)
  values (v_job_id, p_run_id, 'finance_reconciliation', jsonb_build_object('status', v_status, 'difference', v_diff), 'complete', 1);

  insert into public.worker_job_artifacts(job_id, run_id, artifact_type, artifact_name, metadata)
  values (v_job_id, p_run_id, 'finance_reconciliation', 'finance_reconciliation_summary.json', jsonb_build_object('status', v_status, 'sourceCounts', v_sources, 'debit', v_debit, 'credit', v_credit, 'difference', v_diff));

  v_result := jsonb_build_object(
    'ok', true,
    'status', v_status,
    'reconciliationRunId', v_reconciliation_run_id,
    'sourceCounts', v_sources,
    'debit', v_debit,
    'credit', v_credit,
    'difference', v_diff,
    'mismatches', v_mismatch_count,
    'warnings', v_warning_count
  );

  perform public.worker_complete_job(p_worker_id, p_run_id, p_lease_token, v_result);
  perform public.worker_finance_reconciliation_event(v_reconciliation_run_id, v_job_id, p_run_id, 'finance_reconciliation.completed', case when v_mismatch_count > 0 then 'warning' else 'info' end, 'Finance reconciliation worker completed.', v_result);

  return v_result;
exception when others then
  if v_job_id is not null then
    perform public.worker_fail_job(p_worker_id, p_run_id, p_lease_token, SQLERRM, jsonb_build_object('sqlstate', SQLSTATE));
  end if;
  raise;
end;
$$;

revoke execute on function public.worker_finance_reconciliation_event(uuid, uuid, uuid, text, text, text, jsonb) from public, authenticated;
revoke execute on function public.worker_finance_reconciliation_source_counts() from public, authenticated;
revoke execute on function public.worker_enqueue_finance_reconciliation(text, text, text, jsonb, text, timestamptz) from public, authenticated;
revoke execute on function public.worker_acquire_finance_reconciliation_job(text, integer) from public, authenticated;
revoke execute on function public.worker_run_finance_reconciliation_batch(text, uuid, text, integer) from public, authenticated;
do $$
begin
  if to_regprocedure('public.worker_finance_reconciliation_event(uuid, uuid, uuid, text, text, text, jsonb)') is not null then
    execute 'grant execute on function public.worker_finance_reconciliation_event(uuid, uuid, uuid, text, text, text, jsonb) to service_role';
  end if;
end;
$$;
do $$
begin
  if to_regprocedure('public.worker_finance_reconciliation_source_counts()') is not null then
    execute 'grant execute on function public.worker_finance_reconciliation_source_counts() to service_role';
  end if;
end;
$$;
do $$
begin
  if to_regprocedure('public.worker_enqueue_finance_reconciliation(text, text, text, jsonb, text, timestamptz)') is not null then
    execute 'grant execute on function public.worker_enqueue_finance_reconciliation(text, text, text, jsonb, text, timestamptz) to service_role';
  end if;
end;
$$;
do $$
begin
  if to_regprocedure('public.worker_acquire_finance_reconciliation_job(text, integer)') is not null then
    execute 'grant execute on function public.worker_acquire_finance_reconciliation_job(text, integer) to service_role';
  end if;
end;
$$;
do $$
begin
  if to_regprocedure('public.worker_run_finance_reconciliation_batch(text, uuid, text, integer)') is not null then
    execute 'grant execute on function public.worker_run_finance_reconciliation_batch(text, uuid, text, integer) to service_role';
  end if;
end;
$$;
