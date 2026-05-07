-- v377 POS Replay Worker
-- Adds a resumable, idempotent POS/Foodics replay worker on top of the v375 worker lease runtime.

create extension if not exists pgcrypto;

create table if not exists public.pos_replay_runs (
  id uuid primary key default gen_random_uuid(),
  job_id uuid references public.worker_jobs(id) on delete cascade,
  run_id uuid references public.worker_job_runs(id) on delete set null,
  source_table text,
  branch_id text,
  business_date_from date,
  business_date_to date,
  batch_size integer not null default 500,
  dry_run boolean not null default true,
  status text not null default 'running',
  source_rows integer not null default 0,
  processed_rows integer not null default 0,
  applied_rows integer not null default 0,
  skipped_duplicates integer not null default 0,
  warning text,
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  failed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.pos_replay_applied_rows (
  id uuid primary key default gen_random_uuid(),
  job_id uuid references public.worker_jobs(id) on delete cascade,
  run_id uuid references public.worker_job_runs(id) on delete set null,
  source_table text not null,
  source_row_key text not null,
  replay_hash text not null,
  payload jsonb not null default '{}'::jsonb,
  status text not null default 'dry_run',
  dry_run boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.pos_replay_events (
  id uuid primary key default gen_random_uuid(),
  job_id uuid references public.worker_jobs(id) on delete set null,
  run_id uuid references public.worker_job_runs(id) on delete set null,
  event_type text not null,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create unique index if not exists pos_replay_applied_rows_source_uidx on public.pos_replay_applied_rows(source_table, source_row_key);
create unique index if not exists pos_replay_applied_rows_hash_uidx on public.pos_replay_applied_rows(replay_hash);
create index if not exists pos_replay_runs_job_idx on public.pos_replay_runs(job_id, run_id, status, created_at desc);
create index if not exists pos_replay_events_job_idx on public.pos_replay_events(job_id, run_id, created_at desc);

alter table public.pos_replay_runs enable row level security;
alter table public.pos_replay_applied_rows enable row level security;
alter table public.pos_replay_events enable row level security;

drop policy if exists pos_replay_runs_read_authenticated_v377 on public.pos_replay_runs;

create policy pos_replay_runs_read_authenticated_v377
on public.pos_replay_runs
for select to authenticated using (true)
;
drop policy if exists pos_replay_applied_rows_read_authenticated_v377 on public.pos_replay_applied_rows;

create policy pos_replay_applied_rows_read_authenticated_v377
on public.pos_replay_applied_rows
for select to authenticated using (true)
;
drop policy if exists pos_replay_events_read_authenticated_v377 on public.pos_replay_events;

create policy pos_replay_events_read_authenticated_v377
on public.pos_replay_events
for select to authenticated using (true)
;

create or replace function public.worker_pos_replay_event(
  p_job_id uuid,
  p_run_id uuid,
  p_event_type text,
  p_details jsonb default '{}'::jsonb
) returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.pos_replay_events(job_id, run_id, event_type, details)
  values (p_job_id, p_run_id, p_event_type, coalesce(p_details, '{}'::jsonb));

  perform public.worker_runtime_audit(p_job_id, p_run_id, 'pos_replay.' || p_event_type, 'pos-replay-worker', coalesce(p_details, '{}'::jsonb));
end;
$$;

create or replace function public.worker_pos_replay_source_table()
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_table text;
begin
  foreach v_table in array array[
    'pos_staging_rows',
    'foodics_staging_rows',
    'sales_pos_staging_rows',
    'foodics_orders',
    'pos_sales_rows',
    'sales_pos_batches'
  ] loop
    if exists (
      select 1
      from information_schema.tables
      where table_schema = 'public'
        and table_name = v_table
    ) then
      return v_table;
    end if;
  end loop;

  return null;
end;
$$;

create or replace function public.worker_enqueue_pos_replay(
  p_source_table text default null,
  p_branch_id text default null,
  p_business_date_from date default null,
  p_business_date_to date default null,
  p_batch_size integer default 500,
  p_dry_run boolean default true,
  p_priority text default 'P1'
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_source_table text := coalesce(nullif(p_source_table, ''), public.worker_pos_replay_source_table());
  v_payload jsonb;
  v_job_id uuid;
  v_idempotency text;
begin
  v_payload := jsonb_build_object(
    'sourceTable', v_source_table,
    'branchId', p_branch_id,
    'businessDateFrom', p_business_date_from,
    'businessDateTo', p_business_date_to,
    'batchSize', greatest(1, least(5000, coalesce(p_batch_size, 500))),
    'dryRun', coalesce(p_dry_run, true)
  );

  v_idempotency := encode(digest('pos.replay:' || coalesce(v_source_table, 'auto') || ':' || coalesce(p_branch_id, 'all') || ':' || coalesce(p_business_date_from::text, 'open') || ':' || coalesce(p_business_date_to::text, 'open') || ':' || coalesce(p_dry_run::text, 'true'), 'sha256'), 'hex');

  v_job_id := public.worker_enqueue_job(
    p_job_type => 'pos.replay',
    p_payload => v_payload,
    p_idempotency_key => v_idempotency,
    p_lane => 'background',
    p_priority => coalesce(nullif(p_priority, ''), 'P1'),
    p_module => 'sales-pos',
    p_job_name => 'POS/Foodics replay worker',
    p_branch_id => p_branch_id,
    p_store_id => null,
    p_max_attempts => 4,
    p_run_after => now()
  );

  perform public.worker_pos_replay_event(v_job_id, null, 'enqueue', v_payload);
  return v_job_id;
end;
$$;

create or replace function public.worker_acquire_pos_replay_job(
  p_worker_id text,
  p_lease_seconds integer default 180
) returns table(
  run_id uuid,
  job_id uuid,
  lease_token text,
  source_table text,
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
  v_lease_seconds integer := least(3600, greatest(30, coalesce(p_lease_seconds, 180)));
  v_expires_at timestamptz := now() + make_interval(secs => least(3600, greatest(30, coalesce(p_lease_seconds, 180))));
  v_source_table text;
  v_checkpoint jsonb := '{}'::jsonb;
begin
  if p_worker_id is null or btrim(p_worker_id) = '' then
    raise exception 'worker_id is required';
  end if;

  select * into v_job
  from public.worker_jobs
  where job_type = 'pos.replay'
    and status in ('queued', 'retry_waiting')
    and run_after <= now()
  order by case priority when 'P0' then 0 when 'P1' then 1 when 'P2' then 2 else 3 end, created_at
  for update skip locked
  limit 1;

  if not found then
    return;
  end if;

  v_source_table := coalesce(nullif(v_job.payload->>'sourceTable', ''), public.worker_pos_replay_source_table());

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

  insert into public.pos_replay_runs(job_id, run_id, source_table, branch_id, business_date_from, business_date_to, batch_size, dry_run, status)
  values (
    v_job.id,
    v_run_id,
    v_source_table,
    v_job.branch_id,
    nullif(v_job.payload->>'businessDateFrom', '')::date,
    nullif(v_job.payload->>'businessDateTo', '')::date,
    greatest(1, least(5000, coalesce((v_job.payload->>'batchSize')::integer, 500))),
    coalesce((v_job.payload->>'dryRun')::boolean, true),
    'running'
  );

  perform public.worker_pos_replay_event(v_job.id, v_run_id, 'acquire', jsonb_build_object('workerId', p_worker_id, 'sourceTable', v_source_table, 'leaseSeconds', v_lease_seconds));

  run_id := v_run_id;
  job_id := v_job.id;
  lease_token := v_lease_token;
  source_table := v_source_table;
  payload := v_job.payload;
  attempt_number := coalesce(v_job.attempt_count, 0) + 1;
  checkpoint := v_checkpoint;
  lease_expires_at := v_expires_at;
  return next;
end;
$$;

create or replace function public.worker_run_pos_replay_batch(
  p_run_id uuid,
  p_lease_token text,
  p_batch_size integer default null
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_run public.worker_job_runs%rowtype;
  v_job public.worker_jobs%rowtype;
  v_lease public.worker_job_leases%rowtype;
  v_source_table text;
  v_batch_size integer;
  v_cursor integer := 0;
  v_total integer := 0;
  v_rows jsonb := '[]'::jsonb;
  v_row jsonb;
  v_source_key text;
  v_replay_hash text;
  v_processed integer := 0;
  v_applied integer := 0;
  v_skipped integer := 0;
  v_done boolean := false;
  v_warning text;
begin
  select * into v_run from public.worker_job_runs where id = p_run_id;
  if not found then
    raise exception 'run not found';
  end if;

  select * into v_job from public.worker_jobs where id = v_run.job_id;
  if not found then
    raise exception 'job not found';
  end if;

  select * into v_lease
  from public.worker_job_leases
  where run_id = p_run_id
    and lease_token = p_lease_token
    and status = 'active'
    and expires_at > now()
  limit 1;

  if not found then
    raise exception 'active lease not found or expired';
  end if;

  v_source_table := coalesce(nullif(v_job.payload->>'sourceTable', ''), public.worker_pos_replay_source_table());
  v_batch_size := greatest(1, least(5000, coalesce(p_batch_size, (v_job.payload->>'batchSize')::integer, 500)));

  select coalesce((checkpoint_value->>'cursor')::integer, 0)
  into v_cursor
  from public.worker_job_checkpoints
  where run_id = p_run_id
    and checkpoint_key = 'pos_cursor'
  order by created_at desc
  limit 1;
  v_cursor := coalesce(v_cursor, 0);

  if v_source_table is null then
    v_warning := 'No POS/Foodics source table found. Replay completed with warning and no row effects.';

    update public.worker_jobs set status = 'completed', completed_at = now(), updated_at = now(), last_error = v_warning where id = v_job.id;
    update public.worker_job_runs set status = 'completed', completed_at = now(), heartbeat_at = now(), checkpoint = jsonb_build_object('cursor', v_cursor, 'warning', v_warning), updated_at = now() where id = p_run_id;
    update public.worker_job_leases set status = 'released', released_at = now(), updated_at = now() where id = v_lease.id;
    update public.pos_replay_runs set status = 'completed_with_warning', warning = v_warning, completed_at = now(), updated_at = now() where run_id = p_run_id;

    insert into public.worker_job_artifacts(job_id, run_id, artifact_type, artifact_name, metadata)
    values (v_job.id, p_run_id, 'warning', 'pos_replay_no_source_table', jsonb_build_object('warning', v_warning));

    perform public.worker_pos_replay_event(v_job.id, p_run_id, 'completed_with_warning', jsonb_build_object('warning', v_warning));
    return jsonb_build_object('ok', true, 'status', 'completed_with_warning', 'warning', v_warning, 'processedRows', 0, 'appliedRows', 0, 'skippedDuplicates', 0);
  end if;

  execute format('select count(*) from public.%I', v_source_table) into v_total;

  execute format(
    'select coalesce(jsonb_agg(row_to_json(t)::jsonb), ''[]''::jsonb) from (select ctid::text as _ctid, * from public.%I order by ctid limit $1 offset $2) t',
    v_source_table
  ) into v_rows using v_batch_size, v_cursor;

  for v_row in select value from jsonb_array_elements(v_rows) loop
    v_processed := v_processed + 1;
    v_source_key := coalesce(v_row->>'id', v_row->>'uuid', v_row->>'order_id', v_row->>'reference', v_row->>'invoice_no', v_row->>'_ctid');
    v_replay_hash := encode(digest(v_source_table || ':' || coalesce(v_source_key, '') || ':' || v_row::text, 'sha256'), 'hex');

    insert into public.pos_replay_applied_rows(job_id, run_id, source_table, source_row_key, replay_hash, payload, status, dry_run)
    values (v_job.id, p_run_id, v_source_table, v_source_key, v_replay_hash, v_row, case when coalesce((v_job.payload->>'dryRun')::boolean, true) then 'dry_run' else 'replayed' end, coalesce((v_job.payload->>'dryRun')::boolean, true))
    on conflict (source_table, source_row_key) do nothing;

    if found then
      v_applied := v_applied + 1;
    else
      v_skipped := v_skipped + 1;
    end if;
  end loop;

  v_cursor := v_cursor + v_processed;
  v_done := v_processed = 0 or v_cursor >= v_total;

  insert into public.worker_job_checkpoints(job_id, run_id, checkpoint_key, checkpoint_value, cursor_value, row_count)
  values (v_job.id, p_run_id, 'pos_cursor', jsonb_build_object('cursor', v_cursor, 'totalRows', v_total, 'sourceTable', v_source_table), v_cursor::text, v_processed);

  update public.pos_replay_runs
  set source_table = v_source_table,
      source_rows = v_total,
      processed_rows = processed_rows + v_processed,
      applied_rows = applied_rows + v_applied,
      skipped_duplicates = skipped_duplicates + v_skipped,
      status = case when v_done then 'completed' else 'running' end,
      completed_at = case when v_done then now() else completed_at end,
      updated_at = now()
  where run_id = p_run_id;

  insert into public.worker_job_artifacts(job_id, run_id, artifact_type, artifact_name, metadata)
  values (v_job.id, p_run_id, 'pos_replay_batch', 'pos_replay_batch_' || v_cursor::text, jsonb_build_object('sourceTable', v_source_table, 'cursor', v_cursor, 'totalRows', v_total, 'processedRows', v_processed, 'appliedRows', v_applied, 'skippedDuplicates', v_skipped, 'dryRun', coalesce((v_job.payload->>'dryRun')::boolean, true)));

  if v_done then
    update public.worker_jobs set status = 'completed', completed_at = now(), updated_at = now() where id = v_job.id;
    update public.worker_job_runs set status = 'completed', completed_at = now(), heartbeat_at = now(), progress = 100, checkpoint = jsonb_build_object('cursor', v_cursor, 'totalRows', v_total), updated_at = now() where id = p_run_id;
    update public.worker_job_leases set status = 'released', released_at = now(), updated_at = now() where id = v_lease.id;
    perform public.worker_pos_replay_event(v_job.id, p_run_id, 'completed', jsonb_build_object('sourceTable', v_source_table, 'cursor', v_cursor, 'totalRows', v_total, 'appliedRows', v_applied, 'skippedDuplicates', v_skipped));
  else
    update public.worker_job_runs set heartbeat_at = now(), progress = case when v_total > 0 then round((v_cursor::numeric / v_total::numeric) * 100, 2) else 0 end, checkpoint = jsonb_build_object('cursor', v_cursor, 'totalRows', v_total), updated_at = now() where id = p_run_id;
    update public.worker_job_leases set heartbeat_at = now(), expires_at = now() + interval '180 seconds', updated_at = now() where id = v_lease.id;
    perform public.worker_pos_replay_event(v_job.id, p_run_id, 'batch', jsonb_build_object('sourceTable', v_source_table, 'cursor', v_cursor, 'totalRows', v_total, 'processedRows', v_processed, 'appliedRows', v_applied, 'skippedDuplicates', v_skipped));
  end if;

  return jsonb_build_object('ok', true, 'status', case when v_done then 'completed' else 'running' end, 'sourceTable', v_source_table, 'cursor', v_cursor, 'totalRows', v_total, 'processedRows', v_processed, 'appliedRows', v_applied, 'skippedDuplicates', v_skipped, 'dryRun', coalesce((v_job.payload->>'dryRun')::boolean, true));
exception when others then
  update public.worker_jobs
  set status = case when coalesce(attempt_count, 0) >= coalesce(max_attempts, 3) then 'dead_lettered' else 'retry_waiting' end,
      run_after = now() + interval '5 minutes',
      failed_at = now(),
      last_error = sqlerrm,
      updated_at = now()
  where id = coalesce(v_job.id, (select job_id from public.worker_job_runs where id = p_run_id));

  update public.worker_job_runs set status = 'failed', failed_at = now(), error_message = sqlerrm, updated_at = now() where id = p_run_id;
  update public.worker_job_leases set status = 'released', released_at = now(), updated_at = now() where run_id = p_run_id and lease_token = p_lease_token;

  insert into public.worker_dead_letters(job_id, run_id, reason, payload, retryable)
  select job_id, id, sqlerrm, jsonb_build_object('worker', 'pos.replay'), false
  from public.worker_job_runs
  where id = p_run_id
    and exists (select 1 from public.worker_jobs j where j.id = public.worker_job_runs.job_id and coalesce(j.attempt_count, 0) >= coalesce(j.max_attempts, 3));

  perform public.worker_pos_replay_event(coalesce(v_job.id, null), p_run_id, 'failed', jsonb_build_object('error', sqlerrm));
  raise;
end;
$$;

revoke all on function public.worker_pos_replay_event(uuid, uuid, text, jsonb) from public, authenticated;
revoke all on function public.worker_pos_replay_source_table() from public, authenticated;
revoke all on function public.worker_enqueue_pos_replay(text, text, date, date, integer, boolean, text) from public, authenticated;
revoke all on function public.worker_acquire_pos_replay_job(text, integer) from public, authenticated;
revoke all on function public.worker_run_pos_replay_batch(uuid, text, integer) from public, authenticated;
do $$
begin
  if to_regprocedure('public.worker_pos_replay_event(uuid, uuid, text, jsonb)') is not null then
    execute 'grant execute on function public.worker_pos_replay_event(uuid, uuid, text, jsonb) to service_role';
  end if;
end;
$$;
do $$
begin
  if to_regprocedure('public.worker_pos_replay_source_table()') is not null then
    execute 'grant execute on function public.worker_pos_replay_source_table() to service_role';
  end if;
end;
$$;
do $$
begin
  if to_regprocedure('public.worker_enqueue_pos_replay(text, text, date, date, integer, boolean, text)') is not null then
    execute 'grant execute on function public.worker_enqueue_pos_replay(text, text, date, date, integer, boolean, text) to service_role';
  end if;
end;
$$;
do $$
begin
  if to_regprocedure('public.worker_acquire_pos_replay_job(text, integer)') is not null then
    execute 'grant execute on function public.worker_acquire_pos_replay_job(text, integer) to service_role';
  end if;
end;
$$;
do $$
begin
  if to_regprocedure('public.worker_run_pos_replay_batch(uuid, text, integer)') is not null then
    execute 'grant execute on function public.worker_run_pos_replay_batch(uuid, text, integer) to service_role';
  end if;
end;
$$;
