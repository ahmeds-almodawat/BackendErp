-- v379 Report Snapshot Worker
-- Generates durable report snapshots through the v375 worker runtime so heavy
-- dashboards and management packs do not block the browser.
-- Idempotency is enforced through worker_enqueue_job idempotency keys.

create extension if not exists pgcrypto;

create table if not exists public.report_snapshot_runs (
  id uuid primary key default gen_random_uuid(),
  job_id uuid references public.worker_jobs(id) on delete set null,
  worker_run_id uuid references public.worker_job_runs(id) on delete set null,
  report_key text not null,
  report_name text,
  module text,
  period_start date,
  period_end date,
  branch_id text,
  store_id text,
  status text not null default 'queued',
  source_count integer not null default 0,
  total_row_count integer not null default 0,
  freshness_at timestamptz,
  snapshot_payload jsonb not null default '{}'::jsonb,
  findings jsonb not null default '[]'::jsonb,
  artifact_id uuid,
  started_at timestamptz,
  completed_at timestamptz,
  failed_at timestamptz,
  error_message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.report_snapshot_sources (
  id uuid primary key default gen_random_uuid(),
  snapshot_run_id uuid not null references public.report_snapshot_runs(id) on delete cascade,
  source_table text not null,
  source_module text,
  row_count integer not null default 0,
  freshness_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.report_snapshot_artifacts (
  id uuid primary key default gen_random_uuid(),
  snapshot_run_id uuid not null references public.report_snapshot_runs(id) on delete cascade,
  artifact_type text not null default 'snapshot',
  artifact_name text,
  artifact_url text,
  payload jsonb not null default '{}'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.report_snapshot_events (
  id uuid primary key default gen_random_uuid(),
  snapshot_run_id uuid references public.report_snapshot_runs(id) on delete set null,
  job_id uuid references public.worker_jobs(id) on delete set null,
  event_type text not null,
  severity text not null default 'info',
  message text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create unique index if not exists report_snapshot_runs_job_uidx on public.report_snapshot_runs(job_id) where job_id is not null;
create index if not exists report_snapshot_runs_lookup_idx on public.report_snapshot_runs(report_key, period_start, period_end, branch_id, status, created_at desc);
create index if not exists report_snapshot_sources_run_idx on public.report_snapshot_sources(snapshot_run_id, source_table);
create index if not exists report_snapshot_artifacts_run_idx on public.report_snapshot_artifacts(snapshot_run_id, artifact_type, created_at desc);
create index if not exists report_snapshot_events_run_idx on public.report_snapshot_events(snapshot_run_id, event_type, created_at desc);

alter table public.report_snapshot_runs enable row level security;
alter table public.report_snapshot_sources enable row level security;
alter table public.report_snapshot_artifacts enable row level security;
alter table public.report_snapshot_events enable row level security;

do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'report_snapshot_runs' and policyname = 'report_snapshot_runs_read_authenticated_v379') then
    execute 'create policy report_snapshot_runs_read_authenticated_v379 on public.report_snapshot_runs for select to authenticated using (true)';
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'report_snapshot_sources' and policyname = 'report_snapshot_sources_read_authenticated_v379') then
    execute 'create policy report_snapshot_sources_read_authenticated_v379 on public.report_snapshot_sources for select to authenticated using (true)';
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'report_snapshot_artifacts' and policyname = 'report_snapshot_artifacts_read_authenticated_v379') then
    execute 'create policy report_snapshot_artifacts_read_authenticated_v379 on public.report_snapshot_artifacts for select to authenticated using (true)';
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'report_snapshot_events' and policyname = 'report_snapshot_events_read_authenticated_v379') then
    execute 'create policy report_snapshot_events_read_authenticated_v379 on public.report_snapshot_events for select to authenticated using (true)';
  end if;
end $$;

create or replace function public.worker_report_snapshot_event(
  p_snapshot_run_id uuid,
  p_job_id uuid,
  p_event_type text,
  p_severity text,
  p_message text,
  p_metadata jsonb default '{}'::jsonb
) returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.report_snapshot_events(snapshot_run_id, job_id, event_type, severity, message, metadata)
  values (
    p_snapshot_run_id,
    p_job_id,
    coalesce(nullif(p_event_type, ''), 'report_snapshot.event'),
    coalesce(nullif(p_severity, ''), 'info'),
    coalesce(nullif(p_message, ''), 'Report snapshot event.'),
    coalesce(p_metadata, '{}'::jsonb)
  );
end;
$$;

create or replace function public.worker_report_snapshot_source_counts(
  p_report_key text default null,
  p_branch_id text default null,
  p_period_start date default null,
  p_period_end date default null
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_source_tables text[] := array[
    'finance_journal_lines_backend',
    'finance_journal_entries_backend',
    'posting_batches',
    'inventory_stock_balances',
    'inventory_rebuild_balances',
    'pos_replay_applied_rows',
    'import_cutover_applied_rows',
    'sales_pos_batches',
    'purchase_invoices',
    'supplier_payments',
    'worker_jobs'
  ];
  v_table text;
  v_count integer := 0;
  v_exists boolean := false;
  v_rows jsonb := '[]'::jsonb;
begin
  foreach v_table in array v_source_tables loop
    select exists (
      select 1
      from information_schema.tables
      where table_schema = 'public'
        and table_name = v_table
    ) into v_exists;

    if v_exists then
      execute format('select count(*)::integer from public.%I', v_table) into v_count;
      v_rows := v_rows || jsonb_build_array(jsonb_build_object(
        'sourceTable', v_table,
        'rowCount', coalesce(v_count, 0),
        'freshnessAt', now(),
        'reportKey', p_report_key,
        'branchId', p_branch_id,
        'periodStart', p_period_start,
        'periodEnd', p_period_end
      ));
    end if;
  end loop;

  return v_rows;
end;
$$;

create or replace function public.worker_enqueue_report_snapshot(
  p_report_key text,
  p_report_name text default null,
  p_module text default 'reporting',
  p_period_start date default null,
  p_period_end date default null,
  p_branch_id text default null,
  p_store_id text default null,
  p_priority text default 'P2',
  p_run_after timestamptz default now()
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_payload jsonb;
  v_key text;
  v_job_id uuid;
begin
  if p_report_key is null or btrim(p_report_key) = '' then
    raise exception 'report_key is required';
  end if;

  v_payload := jsonb_build_object(
    'reportKey', p_report_key,
    'reportName', p_report_name,
    'module', coalesce(nullif(p_module, ''), 'reporting'),
    'periodStart', p_period_start,
    'periodEnd', p_period_end,
    'branchId', p_branch_id,
    'storeId', p_store_id
  );

  v_key := encode(digest('report.snapshot:' || coalesce(p_report_key, '') || ':' || coalesce(p_branch_id, '') || ':' || coalesce(p_store_id, '') || ':' || coalesce(p_period_start::text, '') || ':' || coalesce(p_period_end::text, ''), 'sha256'), 'hex');

  v_job_id := public.worker_enqueue_job(
    'report.snapshot',
    v_payload,
    v_key,
    'scheduled',
    coalesce(nullif(p_priority, ''), 'P2'),
    coalesce(nullif(p_module, ''), 'reporting'),
    coalesce(p_report_name, p_report_key),
    p_branch_id,
    p_store_id,
    3,
    coalesce(p_run_after, now())
  );

  return v_job_id;
end;
$$;

create or replace function public.worker_acquire_report_snapshot_job(
  p_worker_id text,
  p_lease_seconds integer default 300
) returns table(
  run_id uuid,
  job_id uuid,
  lease_token text,
  report_key text,
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
  v_lease_seconds integer := least(3600, greatest(30, coalesce(p_lease_seconds, 300)));
  v_checkpoint jsonb := '{}'::jsonb;
  v_expires_at timestamptz := now() + make_interval(secs => least(3600, greatest(30, coalesce(p_lease_seconds, 300))));
begin
  if p_worker_id is null or btrim(p_worker_id) = '' then
    raise exception 'worker_id is required';
  end if;

  select *
  into v_job
  from public.worker_jobs
  where status in ('queued', 'retry')
    and job_type = 'report.snapshot'
    and run_after <= now()
  order by
    case priority when 'P0' then 0 when 'P1' then 1 when 'P2' then 2 else 3 end,
    created_at
  for update skip locked
  limit 1;

  if not found then
    return;
  end if;

  select coalesce(checkpoint_value, '{}'::jsonb)
  into v_checkpoint
  from public.worker_job_checkpoints
  where job_id = v_job.id
  order by created_at desc
  limit 1;

  v_checkpoint := coalesce(v_checkpoint, '{}'::jsonb);

  update public.worker_jobs
  set status = 'running',
      locked_at = now(),
      attempt_count = coalesce(attempt_count, 0) + 1,
      updated_at = now()
  where id = v_job.id;

  insert into public.worker_job_runs(job_id, attempt_number, worker_id, lease_token, status, checkpoint, started_at, heartbeat_at)
  values (v_job.id, coalesce(v_job.attempt_count, 0) + 1, p_worker_id, v_lease_token, 'running', v_checkpoint, now(), now())
  returning id into v_run_id;

  insert into public.worker_job_leases(job_id, run_id, worker_id, lease_token, status, acquired_at, expires_at, heartbeat_at)
  values (v_job.id, v_run_id, p_worker_id, v_lease_token, 'active', now(), v_expires_at, now());

  perform public.worker_runtime_audit(v_job.id, v_run_id, 'report_snapshot.acquire', p_worker_id, jsonb_build_object('leaseExpiresAt', v_expires_at));

  return query
  select
    v_run_id,
    v_job.id,
    v_lease_token,
    coalesce(v_job.payload ->> 'reportKey', v_job.job_name, v_job.job_type),
    v_job.payload,
    coalesce(v_job.attempt_count, 0) + 1,
    v_checkpoint,
    v_expires_at;
end;
$$;

create or replace function public.worker_run_report_snapshot_batch(
  p_worker_id text,
  p_run_id uuid,
  p_lease_token text
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_job public.worker_jobs%rowtype;
  v_run public.worker_job_runs%rowtype;
  v_snapshot_run_id uuid;
  v_sources jsonb := '[]'::jsonb;
  v_source jsonb;
  v_total_rows integer := 0;
  v_source_count integer := 0;
  v_payload jsonb := '{}'::jsonb;
  v_artifact_id uuid;
  v_report_key text;
  v_period_start date;
  v_period_end date;
  v_branch_id text;
  v_store_id text;
begin
  select r.*
  into v_run
  from public.worker_job_runs r
  join public.worker_job_leases l on l.run_id = r.id
  where r.id = p_run_id
    and r.worker_id = p_worker_id
    and r.lease_token = p_lease_token
    and l.lease_token = p_lease_token
    and l.status = 'active'
    and l.expires_at > now()
  limit 1;

  if not found then
    raise exception 'active report snapshot lease not found';
  end if;

  select *
  into v_job
  from public.worker_jobs
  where id = v_run.job_id
    and job_type = 'report.snapshot'
  limit 1;

  if not found then
    raise exception 'report.snapshot job not found for run %', p_run_id;
  end if;

  v_report_key := coalesce(v_job.payload ->> 'reportKey', v_job.job_name, 'report.snapshot');
  v_period_start := nullif(v_job.payload ->> 'periodStart', '')::date;
  v_period_end := nullif(v_job.payload ->> 'periodEnd', '')::date;
  v_branch_id := nullif(v_job.payload ->> 'branchId', '');
  v_store_id := nullif(v_job.payload ->> 'storeId', '');

  insert into public.report_snapshot_runs(job_id, worker_run_id, report_key, report_name, module, period_start, period_end, branch_id, store_id, status, started_at)
  values (
    v_job.id,
    p_run_id,
    v_report_key,
    coalesce(v_job.payload ->> 'reportName', v_report_key),
    coalesce(v_job.payload ->> 'module', v_job.module, 'reporting'),
    v_period_start,
    v_period_end,
    v_branch_id,
    v_store_id,
    'running',
    now()
  )
  on conflict (job_id) where job_id is not null do update
    set worker_run_id = excluded.worker_run_id,
        status = 'running',
        started_at = coalesce(public.report_snapshot_runs.started_at, now()),
        updated_at = now()
  returning id into v_snapshot_run_id;

  perform public.worker_report_snapshot_event(v_snapshot_run_id, v_job.id, 'snapshot.started', 'info', 'Report snapshot generation started.', v_job.payload);

  v_sources := public.worker_report_snapshot_source_counts(v_report_key, v_branch_id, v_period_start, v_period_end);
  v_source_count := jsonb_array_length(v_sources);

  for v_source in select value from jsonb_array_elements(v_sources) loop
    v_total_rows := v_total_rows + coalesce((v_source ->> 'rowCount')::integer, 0);

    insert into public.report_snapshot_sources(snapshot_run_id, source_table, source_module, row_count, freshness_at, metadata)
    values (
      v_snapshot_run_id,
      coalesce(v_source ->> 'sourceTable', 'unknown'),
      coalesce(v_job.payload ->> 'module', v_job.module, 'reporting'),
      coalesce((v_source ->> 'rowCount')::integer, 0),
      now(),
      v_source
    );
  end loop;

  v_payload := jsonb_build_object(
    'reportKey', v_report_key,
    'reportName', coalesce(v_job.payload ->> 'reportName', v_report_key),
    'module', coalesce(v_job.payload ->> 'module', v_job.module, 'reporting'),
    'periodStart', v_period_start,
    'periodEnd', v_period_end,
    'branchId', v_branch_id,
    'storeId', v_store_id,
    'generatedAt', now(),
    'sourceCount', v_source_count,
    'totalRowCount', v_total_rows,
    'sources', v_sources,
    'freshnessAt', now(),
    'truthStatus', case when v_source_count = 0 then 'warning:no_sources' else 'snapshot_generated' end
  );

  insert into public.report_snapshot_artifacts(snapshot_run_id, artifact_type, artifact_name, payload, metadata)
  values (
    v_snapshot_run_id,
    'snapshot',
    v_report_key || '_snapshot.json',
    v_payload,
    jsonb_build_object('jobId', v_job.id, 'runId', p_run_id)
  )
  returning id into v_artifact_id;

  update public.report_snapshot_runs
  set status = case when v_source_count = 0 then 'completed_with_warning' else 'completed' end,
      source_count = v_source_count,
      total_row_count = v_total_rows,
      freshness_at = now(),
      snapshot_payload = v_payload,
      findings = case when v_source_count = 0 then jsonb_build_array('No report source tables were available for this snapshot.') else '[]'::jsonb end,
      artifact_id = v_artifact_id,
      completed_at = now(),
      updated_at = now()
  where id = v_snapshot_run_id;

  insert into public.worker_job_checkpoints(job_id, run_id, checkpoint_key, checkpoint_value, cursor_value, row_count)
  values (
    v_job.id,
    p_run_id,
    'report_snapshot',
    jsonb_build_object('snapshotRunId', v_snapshot_run_id, 'sourceCount', v_source_count, 'totalRowCount', v_total_rows),
    'completed',
    v_total_rows
  );

  update public.worker_job_runs
  set status = 'completed',
      progress = 100,
      checkpoint = jsonb_build_object('snapshotRunId', v_snapshot_run_id, 'artifactId', v_artifact_id),
      completed_at = now(),
      updated_at = now()
  where id = p_run_id;

  update public.worker_job_leases
  set status = 'released',
      released_at = now(),
      updated_at = now()
  where run_id = p_run_id
    and lease_token = p_lease_token
    and status = 'active';

  update public.worker_jobs
  set status = 'completed',
      completed_at = now(),
      updated_at = now()
  where id = v_job.id;

  perform public.worker_runtime_audit(v_job.id, p_run_id, 'report_snapshot.completed', p_worker_id, jsonb_build_object('snapshotRunId', v_snapshot_run_id, 'artifactId', v_artifact_id, 'sourceCount', v_source_count, 'totalRowCount', v_total_rows));
  perform public.worker_report_snapshot_event(v_snapshot_run_id, v_job.id, 'snapshot.completed', 'info', 'Report snapshot generation completed.', jsonb_build_object('sourceCount', v_source_count, 'totalRowCount', v_total_rows));

  return jsonb_build_object(
    'ok', true,
    'snapshotRunId', v_snapshot_run_id,
    'artifactId', v_artifact_id,
    'sourceCount', v_source_count,
    'totalRowCount', v_total_rows,
    'status', case when v_source_count = 0 then 'completed_with_warning' else 'completed' end
  );

exception when others then
  update public.worker_job_runs
  set status = 'failed',
      failed_at = now(),
      error_message = sqlerrm,
      updated_at = now()
  where id = p_run_id;

  update public.worker_job_leases
  set status = 'released',
      released_at = now(),
      updated_at = now()
  where run_id = p_run_id
    and lease_token = p_lease_token
    and status = 'active';

  update public.worker_jobs
  set status = case when coalesce(attempt_count, 0) >= coalesce(max_attempts, 3) then 'dead_lettered' else 'retry' end,
      last_error = sqlerrm,
      failed_at = now(),
      dead_lettered_at = case when coalesce(attempt_count, 0) >= coalesce(max_attempts, 3) then now() else dead_lettered_at end,
      run_after = case when coalesce(attempt_count, 0) >= coalesce(max_attempts, 3) then run_after else now() + interval '5 minutes' end,
      updated_at = now()
  where id = (select job_id from public.worker_job_runs where id = p_run_id);

  insert into public.worker_dead_letters(job_id, run_id, reason, payload, retryable)
  select job_id, id, sqlerrm, checkpoint, false
  from public.worker_job_runs
  where id = p_run_id
    and exists (
      select 1
      from public.worker_jobs j
      where j.id = public.worker_job_runs.job_id
        and j.status = 'dead_lettered'
    );

  perform public.worker_runtime_audit((select job_id from public.worker_job_runs where id = p_run_id), p_run_id, 'report_snapshot.failed', p_worker_id, jsonb_build_object('error', sqlerrm));

  return jsonb_build_object('ok', false, 'error', sqlerrm, 'runId', p_run_id);
end;
$$;

revoke execute on function public.worker_report_snapshot_event(uuid, uuid, text, text, text, jsonb) from public, authenticated;
revoke execute on function public.worker_report_snapshot_source_counts(text, text, date, date) from public, authenticated;
revoke execute on function public.worker_enqueue_report_snapshot(text, text, text, date, date, text, text, text, timestamptz) from public, authenticated;
revoke execute on function public.worker_acquire_report_snapshot_job(text, integer) from public, authenticated;
revoke execute on function public.worker_run_report_snapshot_batch(text, uuid, text) from public, authenticated;
do $$
begin
  if to_regprocedure('public.worker_report_snapshot_event(uuid, uuid, text, text, text, jsonb)') is not null then
    execute 'grant execute on function public.worker_report_snapshot_event(uuid, uuid, text, text, text, jsonb) to service_role';
  end if;
end;
$$;
do $$
begin
  if to_regprocedure('public.worker_report_snapshot_source_counts(text, text, date, date)') is not null then
    execute 'grant execute on function public.worker_report_snapshot_source_counts(text, text, date, date) to service_role';
  end if;
end;
$$;
do $$
begin
  if to_regprocedure('public.worker_enqueue_report_snapshot(text, text, text, date, date, text, text, text, timestamptz)') is not null then
    execute 'grant execute on function public.worker_enqueue_report_snapshot(text, text, text, date, date, text, text, text, timestamptz) to service_role';
  end if;
end;
$$;
do $$
begin
  if to_regprocedure('public.worker_acquire_report_snapshot_job(text, integer)') is not null then
    execute 'grant execute on function public.worker_acquire_report_snapshot_job(text, integer) to service_role';
  end if;
end;
$$;
do $$
begin
  if to_regprocedure('public.worker_run_report_snapshot_batch(text, uuid, text)') is not null then
    execute 'grant execute on function public.worker_run_report_snapshot_batch(text, uuid, text) to service_role';
  end if;
end;
$$;
