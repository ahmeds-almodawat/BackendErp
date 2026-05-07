-- v376 Inventory Rebuild Worker
-- Adds the first business worker on top of v375's durable lease runtime.
-- The worker is service-role oriented. Browsers should enqueue through audited Edge Functions later.

create extension if not exists pgcrypto;

create table if not exists public.inventory_rebuild_runs (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null unique references public.worker_jobs(id) on delete cascade,
  branch_id text,
  store_id text,
  cutoff_at timestamptz not null default now(),
  status text not null default 'queued',
  batch_size integer not null default 5000,
  checkpoint jsonb not null default '{}'::jsonb,
  source_table text,
  processed_rows integer not null default 0,
  rebuilt_rows integer not null default 0,
  started_at timestamptz,
  completed_at timestamptz,
  failed_at timestamptz,
  last_error text,
  summary jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.inventory_rebuild_balances (
  id uuid primary key default gen_random_uuid(),
  rebuild_run_id uuid not null references public.inventory_rebuild_runs(id) on delete cascade,
  branch_id text,
  store_id text,
  item_id text not null,
  lot_id text,
  qty_on_hand numeric not null default 0,
  inventory_value numeric not null default 0,
  movement_count integer not null default 0,
  last_movement_at timestamptz,
  rebuilt_at timestamptz not null default now()
);

create table if not exists public.inventory_rebuild_events (
  id uuid primary key default gen_random_uuid(),
  rebuild_run_id uuid references public.inventory_rebuild_runs(id) on delete cascade,
  job_id uuid references public.worker_jobs(id) on delete set null,
  run_id uuid references public.worker_job_runs(id) on delete set null,
  event_type text not null,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

alter table public.inventory_rebuild_runs add column if not exists job_id uuid references public.worker_jobs(id) on delete cascade;
alter table public.inventory_rebuild_runs add column if not exists branch_id text;
alter table public.inventory_rebuild_runs add column if not exists store_id text;
alter table public.inventory_rebuild_runs add column if not exists cutoff_at timestamptz not null default now();
alter table public.inventory_rebuild_runs add column if not exists status text not null default 'queued';
alter table public.inventory_rebuild_runs add column if not exists batch_size integer not null default 5000;
alter table public.inventory_rebuild_runs add column if not exists checkpoint jsonb not null default '{}'::jsonb;
alter table public.inventory_rebuild_runs add column if not exists source_table text;
alter table public.inventory_rebuild_runs add column if not exists processed_rows integer not null default 0;
alter table public.inventory_rebuild_runs add column if not exists rebuilt_rows integer not null default 0;
alter table public.inventory_rebuild_runs add column if not exists started_at timestamptz;
alter table public.inventory_rebuild_runs add column if not exists completed_at timestamptz;
alter table public.inventory_rebuild_runs add column if not exists failed_at timestamptz;
alter table public.inventory_rebuild_runs add column if not exists last_error text;
alter table public.inventory_rebuild_runs add column if not exists summary jsonb not null default '{}'::jsonb;
alter table public.inventory_rebuild_runs add column if not exists created_at timestamptz not null default now();
alter table public.inventory_rebuild_runs add column if not exists updated_at timestamptz not null default now();

create unique index if not exists inventory_rebuild_runs_job_uidx on public.inventory_rebuild_runs(job_id);
create index if not exists inventory_rebuild_runs_status_idx on public.inventory_rebuild_runs(status, branch_id, store_id, created_at desc);
create index if not exists inventory_rebuild_balances_scope_idx on public.inventory_rebuild_balances(rebuild_run_id, branch_id, store_id, item_id);
create index if not exists inventory_rebuild_events_job_idx on public.inventory_rebuild_events(job_id, run_id, created_at desc);
create unique index if not exists inventory_rebuild_balances_scope_uidx
  on public.inventory_rebuild_balances(rebuild_run_id, coalesce(branch_id, ''), coalesce(store_id, ''), item_id, coalesce(lot_id, ''));

alter table public.inventory_rebuild_runs enable row level security;
alter table public.inventory_rebuild_balances enable row level security;
alter table public.inventory_rebuild_events enable row level security;

drop policy if exists inventory_rebuild_runs_read_authenticated_v376 on public.inventory_rebuild_runs;

create policy inventory_rebuild_runs_read_authenticated_v376
on public.inventory_rebuild_runs
for select to authenticated using (true)
;
drop policy if exists inventory_rebuild_balances_read_authenticated_v376 on public.inventory_rebuild_balances;

create policy inventory_rebuild_balances_read_authenticated_v376
on public.inventory_rebuild_balances
for select to authenticated using (true)
;
drop policy if exists inventory_rebuild_events_read_authenticated_v376 on public.inventory_rebuild_events;

create policy inventory_rebuild_events_read_authenticated_v376
on public.inventory_rebuild_events
for select to authenticated using (true)
;

create or replace function public.worker_safe_numeric(p_value text, p_default numeric default 0)
returns numeric
language plpgsql
immutable
as $$
begin
  if p_value is null or btrim(p_value) = '' then
    return p_default;
  end if;
  return replace(p_value, ',', '')::numeric;
exception when others then
  return p_default;
end;
$$;

create or replace function public.worker_safe_timestamptz(p_value text, p_default timestamptz default now())
returns timestamptz
language plpgsql
stable
as $$
begin
  if p_value is null or btrim(p_value) = '' then
    return p_default;
  end if;
  return p_value::timestamptz;
exception when others then
  return p_default;
end;
$$;

create or replace function public.worker_inventory_rebuild_source_table()
returns text
language plpgsql
stable
set search_path = public
as $$
begin
  if to_regclass('public.inventory_stock_movements') is not null then
    return 'public.inventory_stock_movements';
  elsif to_regclass('public.stock_movements') is not null then
    return 'public.stock_movements';
  elsif to_regclass('public.inventory_movements') is not null then
    return 'public.inventory_movements';
  elsif to_regclass('public.local_inventory_movements') is not null then
    return 'public.local_inventory_movements';
  end if;
  return null;
end;
$$;

create or replace function public.worker_enqueue_inventory_rebuild(
  p_branch_id text default null,
  p_store_id text default null,
  p_cutoff_at timestamptz default now(),
  p_batch_size integer default 5000,
  p_priority text default 'P1'
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_job_id uuid;
  v_payload jsonb;
  v_idempotency_key text;
begin
  v_payload := jsonb_build_object(
    'branchId', p_branch_id,
    'storeId', p_store_id,
    'cutoffAt', coalesce(p_cutoff_at, now()),
    'batchSize', greatest(100, least(50000, coalesce(p_batch_size, 5000))),
    'workerVersion', 'v376'
  );

  v_idempotency_key := 'inventory.rebuild:' || coalesce(p_branch_id, '*') || ':' || coalesce(p_store_id, '*') || ':' || to_char(coalesce(p_cutoff_at, now()), 'YYYYMMDDHH24MISS');

  v_job_id := public.worker_enqueue_job(
    p_job_type => 'inventory.rebuild',
    p_payload => v_payload,
    p_idempotency_key => v_idempotency_key,
    p_lane => 'background',
    p_priority => coalesce(nullif(p_priority, ''), 'P1'),
    p_module => 'inventory',
    p_job_name => 'Inventory Rebuild Worker',
    p_branch_id => p_branch_id,
    p_store_id => p_store_id,
    p_max_attempts => 3,
    p_run_after => now()
  );

  insert into public.inventory_rebuild_runs(job_id, branch_id, store_id, cutoff_at, status, batch_size, checkpoint, summary)
  values (v_job_id, p_branch_id, p_store_id, coalesce(p_cutoff_at, now()), 'queued', greatest(100, least(50000, coalesce(p_batch_size, 5000))), jsonb_build_object('phase', 'queued'), jsonb_build_object('queuedBy', 'worker_enqueue_inventory_rebuild'))
  on conflict (job_id) do update set
    branch_id = excluded.branch_id,
    store_id = excluded.store_id,
    cutoff_at = excluded.cutoff_at,
    batch_size = excluded.batch_size,
    updated_at = now();

  insert into public.inventory_rebuild_events(job_id, event_type, details)
  values (v_job_id, 'inventory_rebuild.enqueued', v_payload);

  return v_job_id;
end;
$$;

create or replace function public.worker_acquire_inventory_rebuild_job(
  p_worker_id text,
  p_lease_seconds integer default 600
) returns table(
  run_id uuid,
  job_id uuid,
  lease_token text,
  payload jsonb,
  rebuild_run_id uuid,
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
  v_expires_at timestamptz := now() + make_interval(secs => least(3600, greatest(60, coalesce(p_lease_seconds, 600))));
  v_rebuild_run_id uuid;
begin
  if p_worker_id is null or btrim(p_worker_id) = '' then
    raise exception 'worker_id is required';
  end if;

  select * into v_job
  from public.worker_jobs
  where job_type = 'inventory.rebuild'
    and status in ('queued', 'retry')
    and run_after <= now()
  order by
    case priority when 'P0' then 0 when 'P1' then 1 when 'P2' then 2 else 9 end,
    created_at
  for update skip locked
  limit 1;

  if not found then
    return;
  end if;

  update public.worker_jobs
  set status = 'running', locked_at = now(), attempt_count = coalesce(attempt_count, 0) + 1, updated_at = now()
  where id = v_job.id
  returning * into v_job;

  insert into public.worker_job_runs(job_id, attempt_number, worker_id, lease_token, status, progress, checkpoint, started_at, heartbeat_at)
  values (v_job.id, v_job.attempt_count, p_worker_id, v_lease_token, 'running', 0, '{}'::jsonb, now(), now())
  returning id into v_run_id;

  insert into public.worker_job_leases(job_id, run_id, worker_id, lease_token, status, acquired_at, expires_at, heartbeat_at)
  values (v_job.id, v_run_id, p_worker_id, v_lease_token, 'active', now(), v_expires_at, now());

  insert into public.inventory_rebuild_runs(job_id, branch_id, store_id, cutoff_at, status, batch_size, started_at, checkpoint)
  values (
    v_job.id,
    coalesce(v_job.branch_id, v_job.payload->>'branchId'),
    coalesce(v_job.store_id, v_job.payload->>'storeId'),
    public.worker_safe_timestamptz(v_job.payload->>'cutoffAt', now()),
    'running',
    greatest(100, least(50000, public.worker_safe_numeric(v_job.payload->>'batchSize', 5000)::integer)),
    now(),
    jsonb_build_object('phase', 'acquired', 'workerId', p_worker_id, 'runId', v_run_id)
  )
  on conflict (job_id) do update set
    status = 'running',
    started_at = coalesce(public.inventory_rebuild_runs.started_at, now()),
    checkpoint = jsonb_build_object('phase', 'acquired', 'workerId', p_worker_id, 'runId', v_run_id),
    updated_at = now()
  returning id into v_rebuild_run_id;

  perform public.worker_runtime_audit(v_job.id, v_run_id, 'inventory_rebuild.acquired', p_worker_id, jsonb_build_object('leaseToken', v_lease_token, 'expiresAt', v_expires_at));

  insert into public.inventory_rebuild_events(rebuild_run_id, job_id, run_id, event_type, details)
  values (v_rebuild_run_id, v_job.id, v_run_id, 'inventory_rebuild.acquired', jsonb_build_object('workerId', p_worker_id, 'leaseExpiresAt', v_expires_at));

  return query select v_run_id, v_job.id, v_lease_token, v_job.payload, v_rebuild_run_id, v_expires_at;
end;
$$;

create or replace function public.worker_run_inventory_rebuild_batch(
  p_worker_id text default 'inventory-rebuild-worker',
  p_lease_seconds integer default 600
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_acquired record;
  v_runtime public.inventory_rebuild_runs%rowtype;
  v_source_table text;
  v_source_count integer := 0;
  v_rebuilt_count integer := 0;
  v_sql text;
  v_error text;
begin
  select * into v_acquired
  from public.worker_acquire_inventory_rebuild_job(p_worker_id, p_lease_seconds)
  limit 1;

  if v_acquired.job_id is null then
    return jsonb_build_object('ok', true, 'jobAcquired', false, 'message', 'No queued inventory.rebuild job is available.');
  end if;

  select * into v_runtime from public.inventory_rebuild_runs where id = v_acquired.rebuild_run_id;
  v_source_table := public.worker_inventory_rebuild_source_table();

  if v_source_table is null then
    update public.inventory_rebuild_runs
    set status = 'completed',
        completed_at = now(),
        source_table = null,
        processed_rows = 0,
        rebuilt_rows = 0,
        checkpoint = jsonb_build_object('phase', 'completed_no_source'),
        summary = jsonb_build_object('warning', 'No inventory movement source table found.', 'searchedTables', jsonb_build_array('inventory_stock_movements', 'stock_movements', 'inventory_movements', 'local_inventory_movements')),
        updated_at = now()
    where id = v_runtime.id;

    update public.worker_jobs set status = 'completed', completed_at = now(), updated_at = now() where id = v_acquired.job_id;
    update public.worker_job_runs set status = 'completed', progress = 100, completed_at = now(), checkpoint = jsonb_build_object('phase', 'completed_no_source'), updated_at = now() where id = v_acquired.run_id;
    update public.worker_job_leases set status = 'released', released_at = now(), updated_at = now() where run_id = v_acquired.run_id and lease_token = v_acquired.lease_token;

    insert into public.worker_job_artifacts(job_id, run_id, artifact_type, artifact_name, metadata)
    values (v_acquired.job_id, v_acquired.run_id, 'inventory_rebuild_report', 'no_source_table', jsonb_build_object('warning', 'No inventory source table found'));

    perform public.worker_runtime_audit(v_acquired.job_id, v_acquired.run_id, 'inventory_rebuild.completed_no_source', p_worker_id, '{}'::jsonb);

    return jsonb_build_object('ok', true, 'jobAcquired', true, 'jobId', v_acquired.job_id, 'runId', v_acquired.run_id, 'warning', 'No inventory movement source table found.');
  end if;

  update public.inventory_rebuild_runs
  set source_table = v_source_table,
      checkpoint = jsonb_build_object('phase', 'counting_source', 'sourceTable', v_source_table),
      updated_at = now()
  where id = v_runtime.id;

  execute format($fmt$
    select count(*)::integer
    from (select to_jsonb(t) as row_data from %s t) s
    where ($1::text is null or row_data->>'branch_id' = $1 or row_data->>'branchId' = $1)
      and ($2::text is null or coalesce(row_data->>'store_id', row_data->>'storeId', row_data->>'warehouse_id', row_data->>'warehouseId') = $2)
      and public.worker_safe_timestamptz(coalesce(row_data->>'movement_at', row_data->>'movementAt', row_data->>'created_at', row_data->>'createdAt', row_data->>'date'), now()) <= $3::timestamptz
  $fmt$, v_source_table)
  into v_source_count
  using v_runtime.branch_id, v_runtime.store_id, v_runtime.cutoff_at;

  delete from public.inventory_rebuild_balances where rebuild_run_id = v_runtime.id;

  execute format($fmt$
    insert into public.inventory_rebuild_balances(
      rebuild_run_id,
      branch_id,
      store_id,
      item_id,
      lot_id,
      qty_on_hand,
      inventory_value,
      movement_count,
      last_movement_at,
      rebuilt_at
    )
    select
      $4::uuid,
      nullif(coalesce(row_data->>'branch_id', row_data->>'branchId'), ''),
      nullif(coalesce(row_data->>'store_id', row_data->>'storeId', row_data->>'warehouse_id', row_data->>'warehouseId'), ''),
      coalesce(nullif(row_data->>'item_id', ''), nullif(row_data->>'itemId', ''), nullif(row_data->>'sku', ''), 'UNKNOWN_ITEM'),
      nullif(coalesce(row_data->>'lot_id', row_data->>'lotId', row_data->>'batch_id', row_data->>'batchId'), ''),
      sum(
        case
          when lower(coalesce(row_data->>'direction', row_data->>'movement_type', row_data->>'movementType', '')) similar to '(out|issue|sale|consume|decrease|negative|return_to_supplier|transfer_out|waste|void)%' then -abs(public.worker_safe_numeric(coalesce(row_data->>'qty', row_data->>'quantity', row_data->>'base_qty', row_data->>'baseQty'), 0))
          else public.worker_safe_numeric(coalesce(row_data->>'qty', row_data->>'quantity', row_data->>'base_qty', row_data->>'baseQty'), 0)
        end
      ) as qty_on_hand,
      sum(
        (
          case
            when lower(coalesce(row_data->>'direction', row_data->>'movement_type', row_data->>'movementType', '')) similar to '(out|issue|sale|consume|decrease|negative|return_to_supplier|transfer_out|waste|void)%' then -abs(public.worker_safe_numeric(coalesce(row_data->>'qty', row_data->>'quantity', row_data->>'base_qty', row_data->>'baseQty'), 0))
            else public.worker_safe_numeric(coalesce(row_data->>'qty', row_data->>'quantity', row_data->>'base_qty', row_data->>'baseQty'), 0)
          end
        ) * public.worker_safe_numeric(coalesce(row_data->>'unit_cost', row_data->>'unitCost', row_data->>'cost', row_data->>'avg_cost', row_data->>'averageCost'), 0)
      ) as inventory_value,
      count(*)::integer as movement_count,
      max(public.worker_safe_timestamptz(coalesce(row_data->>'movement_at', row_data->>'movementAt', row_data->>'created_at', row_data->>'createdAt', row_data->>'date'), now())) as last_movement_at,
      now()
    from (select to_jsonb(t) as row_data from %s t) s
    where ($1::text is null or row_data->>'branch_id' = $1 or row_data->>'branchId' = $1)
      and ($2::text is null or coalesce(row_data->>'store_id', row_data->>'storeId', row_data->>'warehouse_id', row_data->>'warehouseId') = $2)
      and public.worker_safe_timestamptz(coalesce(row_data->>'movement_at', row_data->>'movementAt', row_data->>'created_at', row_data->>'createdAt', row_data->>'date'), now()) <= $3::timestamptz
    group by
      nullif(coalesce(row_data->>'branch_id', row_data->>'branchId'), ''),
      nullif(coalesce(row_data->>'store_id', row_data->>'storeId', row_data->>'warehouse_id', row_data->>'warehouseId'), ''),
      coalesce(nullif(row_data->>'item_id', ''), nullif(row_data->>'itemId', ''), nullif(row_data->>'sku', ''), 'UNKNOWN_ITEM'),
      nullif(coalesce(row_data->>'lot_id', row_data->>'lotId', row_data->>'batch_id', row_data->>'batchId'), '')
  $fmt$, v_source_table)
  using v_runtime.branch_id, v_runtime.store_id, v_runtime.cutoff_at, v_runtime.id;

  get diagnostics v_rebuilt_count = row_count;

  insert into public.worker_job_checkpoints(job_id, run_id, checkpoint_key, checkpoint_value, cursor_value, row_count)
  values (v_acquired.job_id, v_acquired.run_id, 'inventory_rebuild', jsonb_build_object('phase', 'completed', 'sourceTable', v_source_table, 'sourceRows', v_source_count, 'balanceRows', v_rebuilt_count), 'completed', v_source_count);

  update public.inventory_rebuild_runs
  set status = 'completed',
      completed_at = now(),
      processed_rows = v_source_count,
      rebuilt_rows = v_rebuilt_count,
      checkpoint = jsonb_build_object('phase', 'completed', 'sourceTable', v_source_table, 'sourceRows', v_source_count, 'balanceRows', v_rebuilt_count),
      summary = jsonb_build_object('sourceTable', v_source_table, 'sourceRows', v_source_count, 'balanceRows', v_rebuilt_count, 'cutoffAt', cutoff_at),
      updated_at = now()
  where id = v_runtime.id;

  update public.worker_jobs set status = 'completed', completed_at = now(), updated_at = now() where id = v_acquired.job_id;
  update public.worker_job_runs set status = 'completed', progress = 100, completed_at = now(), checkpoint = jsonb_build_object('phase', 'completed', 'sourceRows', v_source_count, 'balanceRows', v_rebuilt_count), updated_at = now() where id = v_acquired.run_id;
  update public.worker_job_leases set status = 'released', released_at = now(), updated_at = now() where run_id = v_acquired.run_id and lease_token = v_acquired.lease_token;

  insert into public.worker_job_artifacts(job_id, run_id, artifact_type, artifact_name, metadata)
  values (v_acquired.job_id, v_acquired.run_id, 'inventory_rebuild_report', 'inventory_rebuild_completed', jsonb_build_object('sourceTable', v_source_table, 'sourceRows', v_source_count, 'balanceRows', v_rebuilt_count));

  insert into public.inventory_rebuild_events(rebuild_run_id, job_id, run_id, event_type, details)
  values (v_runtime.id, v_acquired.job_id, v_acquired.run_id, 'inventory_rebuild.completed', jsonb_build_object('sourceTable', v_source_table, 'sourceRows', v_source_count, 'balanceRows', v_rebuilt_count));

  perform public.worker_runtime_audit(v_acquired.job_id, v_acquired.run_id, 'inventory_rebuild.completed', p_worker_id, jsonb_build_object('sourceRows', v_source_count, 'balanceRows', v_rebuilt_count));

  return jsonb_build_object('ok', true, 'jobAcquired', true, 'jobId', v_acquired.job_id, 'runId', v_acquired.run_id, 'sourceTable', v_source_table, 'sourceRows', v_source_count, 'balanceRows', v_rebuilt_count);

exception when others then
  v_error := sqlerrm;

  if v_acquired.job_id is not null then
    update public.inventory_rebuild_runs
    set status = 'failed', failed_at = now(), last_error = v_error, checkpoint = jsonb_build_object('phase', 'failed', 'error', v_error), updated_at = now()
    where job_id = v_acquired.job_id;

    update public.worker_job_runs
    set status = 'failed', failed_at = now(), error_message = v_error, updated_at = now()
    where id = v_acquired.run_id;

    update public.worker_job_leases
    set status = 'released', released_at = now(), updated_at = now()
    where run_id = v_acquired.run_id and lease_token = v_acquired.lease_token;

    update public.worker_jobs
    set status = case when attempt_count >= max_attempts then 'dead_lettered' else 'retry' end,
        failed_at = now(),
        last_error = v_error,
        run_after = case when attempt_count >= max_attempts then run_after else now() + interval '2 minutes' end,
        dead_lettered_at = case when attempt_count >= max_attempts then now() else dead_lettered_at end,
        updated_at = now()
    where id = v_acquired.job_id;

    insert into public.worker_dead_letters(job_id, run_id, reason, payload, retryable)
    select id, v_acquired.run_id, v_error, payload, false
    from public.worker_jobs
    where id = v_acquired.job_id and attempt_count >= max_attempts;

    perform public.worker_runtime_audit(v_acquired.job_id, v_acquired.run_id, 'inventory_rebuild.failed', p_worker_id, jsonb_build_object('error', v_error));
  end if;

  return jsonb_build_object('ok', false, 'jobAcquired', v_acquired.job_id is not null, 'jobId', v_acquired.job_id, 'runId', v_acquired.run_id, 'error', v_error);
end;
$$;

revoke all on function public.worker_enqueue_inventory_rebuild(text, text, timestamptz, integer, text) from public;
revoke all on function public.worker_acquire_inventory_rebuild_job(text, integer) from public;
revoke all on function public.worker_run_inventory_rebuild_batch(text, integer) from public;
do $$
begin
  if to_regprocedure('public.worker_enqueue_inventory_rebuild(text, text, timestamptz, integer, text)') is not null then
    execute 'grant execute on function public.worker_enqueue_inventory_rebuild(text, text, timestamptz, integer, text) to service_role';
  end if;
end;
$$;
do $$
begin
  if to_regprocedure('public.worker_acquire_inventory_rebuild_job(text, integer)') is not null then
    execute 'grant execute on function public.worker_acquire_inventory_rebuild_job(text, integer) to service_role';
  end if;
end;
$$;
do $$
begin
  if to_regprocedure('public.worker_run_inventory_rebuild_batch(text, integer)') is not null then
    execute 'grant execute on function public.worker_run_inventory_rebuild_batch(text, integer) to service_role';
  end if;
end;
$$;
