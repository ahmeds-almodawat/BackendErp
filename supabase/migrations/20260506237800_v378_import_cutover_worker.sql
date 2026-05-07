-- v378 Import Cutover Worker
-- Adds resumable/import-safe worker primitives for large CSV/Excel cutover jobs.
-- This is intentionally worker-runtime oriented. It validates, checkpoints, and records evidence;
-- final module posting remains owned by later finance/inventory/sales posting workers.

create extension if not exists pgcrypto;

create table if not exists public.import_cutover_runs (
  id uuid primary key default gen_random_uuid(),
  job_id uuid references public.worker_jobs(id) on delete set null,
  import_type text not null,
  source_table text,
  target_table text,
  branch_id text,
  store_id text,
  status text not null default 'queued',
  batch_size integer not null default 500,
  cursor_value integer not null default 0,
  total_rows integer not null default 0,
  processed_rows integer not null default 0,
  valid_rows integer not null default 0,
  invalid_rows integer not null default 0,
  duplicate_rows integer not null default 0,
  validation_summary jsonb not null default '{}'::jsonb,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  completed_at timestamptz
);

create table if not exists public.import_cutover_applied_rows (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null references public.import_cutover_runs(id) on delete cascade,
  job_id uuid references public.worker_jobs(id) on delete set null,
  import_type text not null,
  source_table text,
  source_row_id text not null,
  row_hash text not null,
  status text not null default 'validated',
  validation_errors jsonb not null default '[]'::jsonb,
  mapped_payload jsonb not null default '{}'::jsonb,
  target_table text,
  target_record_id text,
  created_at timestamptz not null default now(),
  applied_at timestamptz
);

create table if not exists public.import_cutover_events (
  id uuid primary key default gen_random_uuid(),
  run_id uuid references public.import_cutover_runs(id) on delete cascade,
  job_id uuid references public.worker_jobs(id) on delete set null,
  event_type text not null,
  severity text not null default 'info',
  message text not null,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create unique index if not exists import_cutover_rows_run_source_uidx
  on public.import_cutover_applied_rows(run_id, source_table, source_row_id);
create unique index if not exists import_cutover_rows_hash_uidx
  on public.import_cutover_applied_rows(import_type, source_table, row_hash);
create index if not exists import_cutover_runs_job_idx on public.import_cutover_runs(job_id, status, created_at desc);
create index if not exists import_cutover_events_run_idx on public.import_cutover_events(run_id, created_at desc);

alter table public.import_cutover_runs enable row level security;
alter table public.import_cutover_applied_rows enable row level security;
alter table public.import_cutover_events enable row level security;

do $$
begin
  drop policy if exists import_cutover_runs_read_authenticated_v378 on public.import_cutover_runs;
  create policy import_cutover_runs_read_authenticated_v378 on public.import_cutover_runs for select to authenticated using (true);
  drop policy if exists import_cutover_applied_rows_read_authenticated_v378 on public.import_cutover_applied_rows;
  create policy import_cutover_applied_rows_read_authenticated_v378 on public.import_cutover_applied_rows for select to authenticated using (true);
  drop policy if exists import_cutover_events_read_authenticated_v378 on public.import_cutover_events;
  create policy import_cutover_events_read_authenticated_v378 on public.import_cutover_events for select to authenticated using (true);
end $$;

create or replace function public.worker_import_cutover_source_table(p_import_type text default null)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_table text;
  v_candidates text[] := array[
    'import_staging_rows',
    'setup_import_staging_rows',
    'master_data_import_rows',
    'foodics_staging_rows',
    'pos_staging_rows',
    'sales_pos_staging_rows'
  ];
begin
  foreach v_table in array v_candidates loop
    if to_regclass('public.' || v_table) is not null then
      return v_table;
    end if;
  end loop;
  return null;
end;
$$;

create or replace function public.worker_enqueue_import_cutover(
  p_import_type text,
  p_source_table text default null,
  p_target_table text default null,
  p_batch_size integer default 500,
  p_branch_id text default null,
  p_store_id text default null
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_source_table text := coalesce(nullif(p_source_table, ''), public.worker_import_cutover_source_table(p_import_type));
  v_payload jsonb;
  v_job_id uuid;
  v_run_id uuid;
begin
  if p_import_type is null or btrim(p_import_type) = '' then
    raise exception 'import_type is required';
  end if;

  v_payload := jsonb_build_object(
    'importType', p_import_type,
    'sourceTable', v_source_table,
    'targetTable', p_target_table,
    'batchSize', greatest(1, coalesce(p_batch_size, 500)),
    'branchId', p_branch_id,
    'storeId', p_store_id,
    'worker', 'v378-import-cutover'
  );

  v_job_id := public.worker_enqueue_job(
    'import.cutover',
    v_payload,
    'import.cutover:' || p_import_type || ':' || coalesce(v_source_table, 'missing-source') || ':' || coalesce(p_target_table, 'validation-only') || ':' || coalesce(p_branch_id, 'all') || ':' || coalesce(p_store_id, 'all'),
    'background',
    'P1',
    'imports',
    'Import Cutover Worker',
    p_branch_id,
    p_store_id,
    5,
    now()
  );

  insert into public.import_cutover_runs(job_id, import_type, source_table, target_table, branch_id, store_id, batch_size, status)
  select v_job_id, p_import_type, v_source_table, p_target_table, p_branch_id, p_store_id, greatest(1, coalesce(p_batch_size, 500)), 'queued'
  where not exists (select 1 from public.import_cutover_runs where job_id = v_job_id)
  returning id into v_run_id;

  insert into public.import_cutover_events(run_id, job_id, event_type, severity, message, details)
  select v_run_id, v_job_id, 'enqueue.created', 'info', 'Import cutover job enqueued.', v_payload
  where v_run_id is not null;

  return v_job_id;
end;
$$;

create or replace function public.worker_acquire_import_cutover_job(
  p_worker_id text,
  p_lease_seconds integer default 300
) returns table(
  run_id uuid,
  job_id uuid,
  lease_token text,
  job_type text,
  payload jsonb,
  attempt_number integer,
  checkpoint jsonb,
  lease_expires_at timestamptz
)
language sql
security definer
set search_path = public
as $$
  select * from public.worker_acquire_job(p_worker_id, array['background','scheduled'], p_lease_seconds)
  where job_type = 'import.cutover';
$$;

create or replace function public.worker_run_import_cutover_batch(
  p_worker_id text,
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
  v_cutover_run_id uuid;
  v_source_table text;
  v_target_table text;
  v_import_type text;
  v_cursor integer := 0;
  v_batch_size integer := greatest(1, coalesce(p_batch_size, 500));
  v_processed integer := 0;
  v_valid integer := 0;
  v_invalid integer := 0;
  v_duplicate integer := 0;
  v_sql text;
  v_row record;
  v_source_row_id text;
  v_payload jsonb;
  v_hash text;
  v_done boolean := false;
begin
  select r.* into v_run
  from public.worker_job_runs r
  join public.worker_job_leases l on l.run_id = r.id and l.lease_token = r.lease_token and l.status = 'active'
  where r.lease_token = p_lease_token
    and r.worker_id = p_worker_id
    and r.status = 'running'
    and l.expires_at > now()
  limit 1;

  if v_run.id is null then
    raise exception 'active import cutover lease not found';
  end if;

  select * into v_job from public.worker_jobs where id = v_run.job_id and job_type = 'import.cutover';
  if v_job.id is null then
    raise exception 'job is not import.cutover';
  end if;

  v_import_type := coalesce(v_job.payload->>'importType', 'generic');
  v_source_table := coalesce(nullif(v_job.payload->>'sourceTable', ''), public.worker_import_cutover_source_table(v_import_type));
  v_target_table := nullif(v_job.payload->>'targetTable', '');
  v_batch_size := greatest(1, coalesce(p_batch_size, nullif(v_job.payload->>'batchSize', '')::integer, 500));
  v_cursor := greatest(0, coalesce((v_run.checkpoint->>'cursor')::integer, 0));

  select id into v_cutover_run_id from public.import_cutover_runs where job_id = v_job.id limit 1;
  if v_cutover_run_id is null then
    insert into public.import_cutover_runs(job_id, import_type, source_table, target_table, branch_id, store_id, batch_size, status)
    values (v_job.id, v_import_type, v_source_table, v_target_table, v_job.branch_id, v_job.store_id, v_batch_size, 'running')
    returning id into v_cutover_run_id;
  end if;

  if v_source_table is null or to_regclass('public.' || v_source_table) is null then
    update public.import_cutover_runs
    set status = 'completed', validation_summary = jsonb_build_object('warning', 'No import staging source table exists.'), completed_at = now(), updated_at = now()
    where id = v_cutover_run_id;

    insert into public.import_cutover_events(run_id, job_id, event_type, severity, message, details)
    values (v_cutover_run_id, v_job.id, 'source.missing', 'warning', 'No import staging source table exists; job completed with warning.', jsonb_build_object('importType', v_import_type));

    perform public.worker_record_artifact(v_job.id, v_run.id, 'warning', 'v378_import_cutover_missing_source', null, jsonb_build_object('sourceTable', v_source_table, 'importType', v_import_type));
    perform public.worker_complete_job(p_worker_id, p_lease_token, jsonb_build_object('status','completed_with_warning','processedRows',0,'sourceTable',v_source_table));
    return jsonb_build_object('ok', true, 'status', 'completed_with_warning', 'processedRows', 0, 'sourceTable', v_source_table);
  end if;

  v_sql := format('select row_number() over (order by 1) as rn, to_jsonb(t.*) as payload from public.%I t offset %s limit %s', v_source_table, v_cursor, v_batch_size);

  for v_row in execute v_sql loop
    v_processed := v_processed + 1;
    v_payload := coalesce(v_row.payload, '{}'::jsonb);
    v_source_row_id := coalesce(v_payload->>'id', v_payload->>'row_id', v_payload->>'source_id', (v_cursor + v_processed)::text);
    v_hash := encode(digest(v_source_table || ':' || v_source_row_id || ':' || v_payload::text, 'sha256'), 'hex');

    if v_payload = '{}'::jsonb then
      v_invalid := v_invalid + 1;
    else
      begin
        insert into public.import_cutover_applied_rows(run_id, job_id, import_type, source_table, source_row_id, row_hash, status, validation_errors, mapped_payload, target_table)
        values (v_cutover_run_id, v_job.id, v_import_type, v_source_table, v_source_row_id, v_hash, 'validated', '[]'::jsonb, v_payload, v_target_table);
        v_valid := v_valid + 1;
      exception when unique_violation then
        v_duplicate := v_duplicate + 1;
      end;
    end if;
  end loop;

  v_done := v_processed < v_batch_size;

  update public.import_cutover_runs
  set status = case when v_done then 'completed' else 'running' end,
      cursor_value = v_cursor + v_processed,
      processed_rows = processed_rows + v_processed,
      valid_rows = valid_rows + v_valid,
      invalid_rows = invalid_rows + v_invalid,
      duplicate_rows = duplicate_rows + v_duplicate,
      validation_summary = jsonb_build_object('lastBatchProcessed', v_processed, 'valid', v_valid, 'invalid', v_invalid, 'duplicates', v_duplicate, 'cursor', v_cursor + v_processed),
      completed_at = case when v_done then now() else completed_at end,
      updated_at = now()
  where id = v_cutover_run_id;

  insert into public.import_cutover_events(run_id, job_id, event_type, severity, message, details)
  values (v_cutover_run_id, v_job.id, case when v_done then 'batch.completed_final' else 'batch.completed' end, 'info', 'Import cutover batch processed.', jsonb_build_object('processedRows', v_processed, 'validRows', v_valid, 'invalidRows', v_invalid, 'duplicateRows', v_duplicate, 'cursor', v_cursor + v_processed));

  perform public.worker_heartbeat(p_worker_id, p_lease_token, case when v_done then 1 else least(0.99, greatest(0, (v_cursor + v_processed)::numeric / greatest(v_cursor + v_processed + v_batch_size, 1))) end, jsonb_build_object('cursor', v_cursor + v_processed, 'sourceTable', v_source_table, 'importType', v_import_type));
  perform public.worker_record_artifact(v_job.id, v_run.id, 'validation_report', 'v378_import_cutover_batch', null, jsonb_build_object('processedRows', v_processed, 'validRows', v_valid, 'invalidRows', v_invalid, 'duplicateRows', v_duplicate, 'done', v_done));

  if v_done then
    perform public.worker_complete_job(p_worker_id, p_lease_token, jsonb_build_object('status','completed','processedRows',v_cursor + v_processed,'sourceTable',v_source_table));
  end if;

  return jsonb_build_object('ok', true, 'done', v_done, 'processedRows', v_processed, 'validRows', v_valid, 'invalidRows', v_invalid, 'duplicateRows', v_duplicate, 'cursor', v_cursor + v_processed, 'sourceTable', v_source_table);
exception when others then
  perform public.worker_fail_job(p_worker_id, p_lease_token, sqlerrm, jsonb_build_object('phase','import_cutover_batch'));
  raise;
end;
$$;

revoke execute on function public.worker_import_cutover_source_table(text) from public, authenticated;
revoke execute on function public.worker_enqueue_import_cutover(text, text, text, integer, text, text) from public, authenticated;
revoke execute on function public.worker_acquire_import_cutover_job(text, integer) from public, authenticated;
revoke execute on function public.worker_run_import_cutover_batch(text, text, integer) from public, authenticated;
do $$
begin
  if to_regprocedure('public.worker_import_cutover_source_table(text)') is not null then
    execute 'grant execute on function public.worker_import_cutover_source_table(text) to service_role';
  end if;
end;
$$;
do $$
begin
  if to_regprocedure('public.worker_enqueue_import_cutover(text, text, text, integer, text, text)') is not null then
    execute 'grant execute on function public.worker_enqueue_import_cutover(text, text, text, integer, text, text) to service_role';
  end if;
end;
$$;
do $$
begin
  if to_regprocedure('public.worker_acquire_import_cutover_job(text, integer)') is not null then
    execute 'grant execute on function public.worker_acquire_import_cutover_job(text, integer) to service_role';
  end if;
end;
$$;
do $$
begin
  if to_regprocedure('public.worker_run_import_cutover_batch(text, text, integer)') is not null then
    execute 'grant execute on function public.worker_run_import_cutover_batch(text, text, integer) to service_role';
  end if;
end;
$$;
