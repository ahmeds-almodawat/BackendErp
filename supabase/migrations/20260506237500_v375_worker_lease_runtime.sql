-- v375 Worker Lease Runtime
-- Turns the v374 schema into a durable backend worker runtime.
-- This migration is intentionally service-role oriented. Browser/authenticated users
-- should not call these RPCs directly.

create extension if not exists pgcrypto;

-- Defensive schema compatibility: keep v375 installable even if v374 table
-- definitions vary slightly between local patch iterations.
create table if not exists public.worker_jobs (
  id uuid primary key default gen_random_uuid(),
  job_type text not null,
  job_name text,
  module text,
  lane text not null default 'background',
  priority text not null default 'P2',
  status text not null default 'queued',
  payload jsonb not null default '{}'::jsonb,
  idempotency_key text,
  branch_id text,
  store_id text,
  max_attempts integer not null default 3,
  attempt_count integer not null default 0,
  run_after timestamptz not null default now(),
  locked_at timestamptz,
  completed_at timestamptz,
  failed_at timestamptz,
  last_error text,
  dead_lettered_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Auto compatibility columns for later enterprise migrations.
alter table if exists public.worker_jobs add column if not exists module_key text;
alter table if exists public.worker_jobs add column if not exists source_ref text;
alter table if exists public.worker_jobs add column if not exists retry_policy jsonb;
alter table if exists public.worker_jobs add column if not exists available_at timestamptz;
alter table if exists public.worker_jobs add column if not exists created_by uuid;


create table if not exists public.worker_job_runs (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.worker_jobs(id) on delete cascade,
  attempt_number integer not null default 1,
  worker_id text not null,
  lease_token text not null,
  status text not null default 'running',
  progress numeric not null default 0,
  checkpoint jsonb not null default '{}'::jsonb,
  error_message text,
  started_at timestamptz not null default now(),
  heartbeat_at timestamptz,
  completed_at timestamptz,
  failed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Auto compatibility columns for later enterprise migrations.
alter table if exists public.worker_job_runs add column if not exists attempt_no integer;
alter table if exists public.worker_job_runs add column if not exists lease_expires_at timestamptz;
alter table if exists public.worker_job_runs add column if not exists processed_rows integer;
alter table if exists public.worker_job_runs add column if not exists total_rows integer;
alter table if exists public.worker_job_runs add column if not exists last_error text;


create table if not exists public.worker_job_leases (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.worker_jobs(id) on delete cascade,
  run_id uuid not null references public.worker_job_runs(id) on delete cascade,
  worker_id text not null,
  lease_token text not null,
  status text not null default 'active',
  acquired_at timestamptz not null default now(),
  expires_at timestamptz not null,
  heartbeat_at timestamptz,
  released_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Auto compatibility columns for later enterprise migrations.
alter table if exists public.worker_job_leases add column if not exists job_run_id text;


create table if not exists public.worker_job_checkpoints (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.worker_jobs(id) on delete cascade,
  run_id uuid references public.worker_job_runs(id) on delete set null,
  checkpoint_key text not null default 'cursor',
  checkpoint_value jsonb not null default '{}'::jsonb,
  cursor_value text,
  row_count integer,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Auto compatibility columns for later enterprise migrations.
alter table if exists public.worker_job_checkpoints add column if not exists job_run_id text;
alter table if exists public.worker_job_checkpoints add column if not exists processed_rows integer;


create table if not exists public.worker_job_artifacts (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.worker_jobs(id) on delete cascade,
  run_id uuid references public.worker_job_runs(id) on delete set null,
  artifact_type text not null default 'evidence',
  artifact_name text,
  artifact_url text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

-- Auto compatibility columns for later enterprise migrations.
alter table if exists public.worker_job_artifacts add column if not exists job_run_id text;
alter table if exists public.worker_job_artifacts add column if not exists storage_bucket text;
alter table if exists public.worker_job_artifacts add column if not exists storage_path text;


create table if not exists public.worker_dead_letters (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.worker_jobs(id) on delete cascade,
  run_id uuid references public.worker_job_runs(id) on delete set null,
  reason text not null,
  payload jsonb not null default '{}'::jsonb,
  retryable boolean not null default false,
  resolved_at timestamptz,
  created_at timestamptz not null default now()
);

-- Auto compatibility columns for later enterprise migrations.
alter table if exists public.worker_dead_letters add column if not exists job_run_id text;
alter table if exists public.worker_dead_letters add column if not exists last_error text;
alter table if exists public.worker_dead_letters add column if not exists attempts integer;
alter table if exists public.worker_dead_letters add column if not exists review_status text;
alter table if exists public.worker_dead_letters add column if not exists reviewed_by uuid;
alter table if exists public.worker_dead_letters add column if not exists reviewed_at timestamptz;


create table if not exists public.worker_audit_events (
  id uuid primary key default gen_random_uuid(),
  job_id uuid references public.worker_jobs(id) on delete set null,
  run_id uuid references public.worker_job_runs(id) on delete set null,
  event_type text not null,
  actor text not null default 'worker-runtime',
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

-- Auto compatibility columns for later enterprise migrations.
alter table if exists public.worker_audit_events add column if not exists job_run_id text;
alter table if exists public.worker_audit_events add column if not exists actor_user_id uuid;
alter table if exists public.worker_audit_events add column if not exists worker_id text;


alter table public.worker_jobs add column if not exists job_type text;
alter table public.worker_jobs add column if not exists job_name text;
alter table public.worker_jobs add column if not exists module text;
alter table public.worker_jobs add column if not exists lane text not null default 'background';
alter table public.worker_jobs add column if not exists priority text not null default 'P2';
alter table public.worker_jobs add column if not exists status text not null default 'queued';
alter table public.worker_jobs add column if not exists payload jsonb not null default '{}'::jsonb;
alter table public.worker_jobs add column if not exists idempotency_key text;
alter table public.worker_jobs add column if not exists branch_id text;
alter table public.worker_jobs add column if not exists store_id text;
alter table public.worker_jobs add column if not exists max_attempts integer not null default 3;
alter table public.worker_jobs add column if not exists attempt_count integer not null default 0;
alter table public.worker_jobs add column if not exists run_after timestamptz not null default now();
alter table public.worker_jobs add column if not exists locked_at timestamptz;
alter table public.worker_jobs add column if not exists completed_at timestamptz;
alter table public.worker_jobs add column if not exists failed_at timestamptz;
alter table public.worker_jobs add column if not exists last_error text;
alter table public.worker_jobs add column if not exists dead_lettered_at timestamptz;
alter table public.worker_jobs add column if not exists created_at timestamptz not null default now();
alter table public.worker_jobs add column if not exists updated_at timestamptz not null default now();

alter table public.worker_job_runs add column if not exists attempt_number integer not null default 1;
alter table public.worker_job_runs add column if not exists worker_id text not null default 'unknown-worker';
alter table public.worker_job_runs add column if not exists lease_token text not null default encode(gen_random_bytes(16), 'hex');
alter table public.worker_job_runs add column if not exists status text not null default 'running';
alter table public.worker_job_runs add column if not exists progress numeric not null default 0;
alter table public.worker_job_runs add column if not exists checkpoint jsonb not null default '{}'::jsonb;
alter table public.worker_job_runs add column if not exists error_message text;
alter table public.worker_job_runs add column if not exists started_at timestamptz not null default now();
alter table public.worker_job_runs add column if not exists heartbeat_at timestamptz;
alter table public.worker_job_runs add column if not exists completed_at timestamptz;
alter table public.worker_job_runs add column if not exists failed_at timestamptz;
alter table public.worker_job_runs add column if not exists created_at timestamptz not null default now();
alter table public.worker_job_runs add column if not exists updated_at timestamptz not null default now();

alter table public.worker_job_leases add column if not exists lease_token text not null default encode(gen_random_bytes(16), 'hex');
alter table public.worker_job_leases add column if not exists status text not null default 'active';
alter table public.worker_job_leases add column if not exists acquired_at timestamptz not null default now();
alter table public.worker_job_leases add column if not exists expires_at timestamptz not null default now();
alter table public.worker_job_leases add column if not exists heartbeat_at timestamptz;
alter table public.worker_job_leases add column if not exists released_at timestamptz;
alter table public.worker_job_leases add column if not exists created_at timestamptz not null default now();
alter table public.worker_job_leases add column if not exists updated_at timestamptz not null default now();

create unique index if not exists worker_jobs_idempotency_key_uidx on public.worker_jobs(idempotency_key) where idempotency_key is not null;
create index if not exists worker_jobs_acquire_idx on public.worker_jobs(status, lane, run_after, priority, created_at);
create index if not exists worker_job_runs_job_idx on public.worker_job_runs(job_id, status, attempt_number);
create unique index if not exists worker_job_leases_active_token_uidx on public.worker_job_leases(run_id, lease_token) where status = 'active';
create index if not exists worker_job_leases_expiry_idx on public.worker_job_leases(status, expires_at);
create index if not exists worker_job_checkpoints_job_idx on public.worker_job_checkpoints(job_id, run_id, checkpoint_key, created_at desc);
create index if not exists worker_audit_events_job_idx on public.worker_audit_events(job_id, run_id, created_at desc);

alter table public.worker_jobs enable row level security;
alter table public.worker_job_runs enable row level security;
alter table public.worker_job_leases enable row level security;
alter table public.worker_job_checkpoints enable row level security;
alter table public.worker_job_artifacts enable row level security;
alter table public.worker_dead_letters enable row level security;
alter table public.worker_audit_events enable row level security;

drop policy if exists worker_jobs_read_authenticated_v375 on public.worker_jobs;

create policy worker_jobs_read_authenticated_v375
on public.worker_jobs
for select to authenticated using (true)
;
drop policy if exists worker_job_runs_read_authenticated_v375 on public.worker_job_runs;

create policy worker_job_runs_read_authenticated_v375
on public.worker_job_runs
for select to authenticated using (true)
;
drop policy if exists worker_job_leases_read_authenticated_v375 on public.worker_job_leases;

create policy worker_job_leases_read_authenticated_v375
on public.worker_job_leases
for select to authenticated using (true)
;
drop policy if exists worker_job_checkpoints_read_authenticated_v375 on public.worker_job_checkpoints;

create policy worker_job_checkpoints_read_authenticated_v375
on public.worker_job_checkpoints
for select to authenticated using (true)
;
drop policy if exists worker_job_artifacts_read_authenticated_v375 on public.worker_job_artifacts;

create policy worker_job_artifacts_read_authenticated_v375
on public.worker_job_artifacts
for select to authenticated using (true)
;
drop policy if exists worker_dead_letters_read_authenticated_v375 on public.worker_dead_letters;

create policy worker_dead_letters_read_authenticated_v375
on public.worker_dead_letters
for select to authenticated using (true)
;
drop policy if exists worker_audit_events_read_authenticated_v375 on public.worker_audit_events;

create policy worker_audit_events_read_authenticated_v375
on public.worker_audit_events
for select to authenticated using (true)
;

create or replace function public.worker_runtime_audit(
  p_job_id uuid,
  p_run_id uuid,
  p_event_type text,
  p_actor text,
  p_details jsonb default '{}'::jsonb
) returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.worker_audit_events(job_id, run_id, event_type, actor, details)
  values (p_job_id, p_run_id, p_event_type, coalesce(nullif(p_actor, ''), 'worker-runtime'), coalesce(p_details, '{}'::jsonb));
end;
$$;

create or replace function public.worker_enqueue_job(
  p_job_type text,
  p_payload jsonb default '{}'::jsonb,
  p_idempotency_key text default null,
  p_lane text default 'background',
  p_priority text default 'P2',
  p_module text default null,
  p_job_name text default null,
  p_branch_id text default null,
  p_store_id text default null,
  p_max_attempts integer default 3,
  p_run_after timestamptz default now()
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_job_id uuid;
  v_idempotency_key text := coalesce(nullif(p_idempotency_key, ''), encode(digest(coalesce(p_job_type, '') || ':' || coalesce(p_payload::text, ''), 'sha256'), 'hex'));
begin
  if p_job_type is null or btrim(p_job_type) = '' then
    raise exception 'job_type is required';
  end if;

  select id into v_job_id
  from public.worker_jobs
  where idempotency_key = v_idempotency_key
  limit 1;

  if v_job_id is not null then
    perform public.worker_runtime_audit(v_job_id, null, 'enqueue.duplicate_blocked', 'worker-runtime', jsonb_build_object('idempotencyKey', v_idempotency_key));
    return v_job_id;
  end if;

  insert into public.worker_jobs(job_type, job_name, module, lane, priority, status, payload, idempotency_key, branch_id, store_id, max_attempts, run_after)
  values (
    p_job_type,
    p_job_name,
    p_module,
    coalesce(nullif(p_lane, ''), 'background'),
    coalesce(nullif(p_priority, ''), 'P2'),
    'queued',
    coalesce(p_payload, '{}'::jsonb),
    v_idempotency_key,
    p_branch_id,
    p_store_id,
    greatest(1, coalesce(p_max_attempts, 3)),
    coalesce(p_run_after, now())
  )
  returning id into v_job_id;

  perform public.worker_runtime_audit(v_job_id, null, 'enqueue.created', 'worker-runtime', jsonb_build_object('jobType', p_job_type, 'lane', p_lane, 'priority', p_priority));
  return v_job_id;
end;
$$;

create or replace function public.worker_acquire_job(
  p_worker_id text,
  p_lanes text[] default array['background', 'scheduled', 'archive'],
  p_lease_seconds integer default 120
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
language plpgsql
security definer
set search_path = public
as $$
declare
  v_job public.worker_jobs%rowtype;
  v_run_id uuid;
  v_lease_token text := encode(gen_random_bytes(24), 'hex');
  v_lease_seconds integer := least(3600, greatest(15, coalesce(p_lease_seconds, 120)));
  v_checkpoint jsonb := '{}'::jsonb;
  v_expires_at timestamptz := now() + make_interval(secs => least(3600, greatest(15, coalesce(p_lease_seconds, 120))));
begin
  if p_worker_id is null or btrim(p_worker_id) = '' then
    raise exception 'worker_id is required';
  end if;

  select * into v_job
  from public.worker_jobs
  where status in ('queued', 'retry_ready')
    and coalesce(run_after, now()) <= now()
    and (p_lanes is null or array_length(p_lanes, 1) is null or lane = any(p_lanes))
  order by case priority when 'P0' then 0 when 'P1' then 1 when 'P2' then 2 else 9 end, created_at
  for update skip locked
  limit 1;

  if not found then
    return;
  end if;

  select checkpoint_value into v_checkpoint
  from public.worker_job_checkpoints
  where job_id = v_job.id
  order by created_at desc
  limit 1;

  update public.worker_jobs
  set status = 'running',
      attempt_count = coalesce(attempt_count, 0) + 1,
      locked_at = now(),
      updated_at = now()
  where id = v_job.id;

  insert into public.worker_job_runs(job_id, attempt_number, worker_id, lease_token, status, checkpoint, started_at, heartbeat_at)
  values (v_job.id, coalesce(v_job.attempt_count, 0) + 1, p_worker_id, v_lease_token, 'running', coalesce(v_checkpoint, '{}'::jsonb), now(), now())
  returning id into v_run_id;

  insert into public.worker_job_leases(job_id, run_id, worker_id, lease_token, status, acquired_at, heartbeat_at, expires_at)
  values (v_job.id, v_run_id, p_worker_id, v_lease_token, 'active', now(), now(), v_expires_at);

  perform public.worker_runtime_audit(v_job.id, v_run_id, 'lease.acquired', p_worker_id, jsonb_build_object('leaseSeconds', v_lease_seconds, 'lanes', p_lanes));

  return query select v_run_id, v_job.id, v_lease_token, v_job.job_type, v_job.payload, coalesce(v_job.attempt_count, 0) + 1, coalesce(v_checkpoint, '{}'::jsonb), v_expires_at;
end;
$$;

create or replace function public.worker_heartbeat(
  p_run_id uuid,
  p_lease_token text,
  p_progress numeric default null,
  p_checkpoint jsonb default null,
  p_extend_seconds integer default 120
) returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_job_id uuid;
  v_updated integer;
begin
  update public.worker_job_leases
  set heartbeat_at = now(),
      expires_at = now() + make_interval(secs => least(3600, greatest(15, coalesce(p_extend_seconds, 120)))),
      updated_at = now()
  where run_id = p_run_id
    and lease_token = p_lease_token
    and status = 'active'
    and expires_at > now()
  returning job_id into v_job_id;

  get diagnostics v_updated = row_count;
  if v_updated = 0 then
    return false;
  end if;

  update public.worker_job_runs
  set heartbeat_at = now(),
      progress = coalesce(p_progress, progress),
      checkpoint = coalesce(p_checkpoint, checkpoint),
      updated_at = now()
  where id = p_run_id;

  if p_checkpoint is not null then
    insert into public.worker_job_checkpoints(job_id, run_id, checkpoint_key, checkpoint_value, cursor_value)
    values (v_job_id, p_run_id, 'heartbeat', p_checkpoint, p_checkpoint->>'cursor');
  end if;

  perform public.worker_runtime_audit(v_job_id, p_run_id, 'lease.heartbeat', 'worker-runtime', jsonb_build_object('progress', p_progress));
  return true;
end;
$$;

create or replace function public.worker_complete_job(
  p_run_id uuid,
  p_lease_token text,
  p_result jsonb default '{}'::jsonb
) returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_job_id uuid;
  v_updated integer;
begin
  update public.worker_job_leases
  set status = 'released', released_at = now(), updated_at = now()
  where run_id = p_run_id and lease_token = p_lease_token and status = 'active'
  returning job_id into v_job_id;

  get diagnostics v_updated = row_count;
  if v_updated = 0 then
    return false;
  end if;

  update public.worker_job_runs
  set status = 'completed', progress = 100, completed_at = now(), updated_at = now()
  where id = p_run_id;

  update public.worker_jobs
  set status = 'completed', completed_at = now(), updated_at = now()
  where id = v_job_id;

  insert into public.worker_job_artifacts(job_id, run_id, artifact_type, artifact_name, metadata)
  values (v_job_id, p_run_id, 'completion_result', 'worker-result.json', coalesce(p_result, '{}'::jsonb));

  perform public.worker_runtime_audit(v_job_id, p_run_id, 'job.completed', 'worker-runtime', coalesce(p_result, '{}'::jsonb));
  return true;
end;
$$;

create or replace function public.worker_fail_job(
  p_run_id uuid,
  p_lease_token text,
  p_error_message text,
  p_retry boolean default true
) returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_job public.worker_jobs%rowtype;
  v_job_id uuid;
  v_updated integer;
  v_retry_allowed boolean;
begin
  update public.worker_job_leases
  set status = 'released', released_at = now(), updated_at = now()
  where run_id = p_run_id and lease_token = p_lease_token and status = 'active'
  returning job_id into v_job_id;

  get diagnostics v_updated = row_count;
  if v_updated = 0 then
    return false;
  end if;

  select * into v_job from public.worker_jobs where id = v_job_id for update;
  v_retry_allowed := coalesce(p_retry, true) and coalesce(v_job.attempt_count, 0) < greatest(1, coalesce(v_job.max_attempts, 3));

  update public.worker_job_runs
  set status = 'failed', failed_at = now(), error_message = p_error_message, updated_at = now()
  where id = p_run_id;

  if v_retry_allowed then
    update public.worker_jobs
    set status = 'retry_ready',
        last_error = p_error_message,
        failed_at = now(),
        run_after = now() + make_interval(secs => least(3600, greatest(30, coalesce(v_job.attempt_count, 1) * 60))),
        updated_at = now()
    where id = v_job_id;
    perform public.worker_runtime_audit(v_job_id, p_run_id, 'job.retry_scheduled', 'worker-runtime', jsonb_build_object('error', p_error_message));
  else
    update public.worker_jobs
    set status = 'dead_letter', last_error = p_error_message, failed_at = now(), dead_lettered_at = now(), updated_at = now()
    where id = v_job_id;

    insert into public.worker_dead_letters(job_id, run_id, reason, payload, retryable)
    values (v_job_id, p_run_id, coalesce(p_error_message, 'worker failed'), coalesce(v_job.payload, '{}'::jsonb), false);

    perform public.worker_runtime_audit(v_job_id, p_run_id, 'job.dead_lettered', 'worker-runtime', jsonb_build_object('error', p_error_message));
  end if;

  return true;
end;
$$;

create or replace function public.worker_expire_stale_leases()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer := 0;
  v_row record;
begin
  for v_row in
    select l.run_id, l.job_id, l.lease_token
    from public.worker_job_leases l
    where l.status = 'active' and l.expires_at <= now()
    for update skip locked
  loop
    update public.worker_job_leases
    set status = 'expired', released_at = now(), updated_at = now()
    where run_id = v_row.run_id and lease_token = v_row.lease_token;

    update public.worker_job_runs
    set status = 'failed', failed_at = now(), error_message = 'Lease expired', updated_at = now()
    where id = v_row.run_id;

    update public.worker_jobs j
    set status = case when coalesce(j.attempt_count, 0) < greatest(1, coalesce(j.max_attempts, 3)) then 'retry_ready' else 'dead_letter' end,
        last_error = 'Lease expired',
        failed_at = now(),
        dead_lettered_at = case when coalesce(j.attempt_count, 0) >= greatest(1, coalesce(j.max_attempts, 3)) then now() else j.dead_lettered_at end,
        run_after = case when coalesce(j.attempt_count, 0) < greatest(1, coalesce(j.max_attempts, 3)) then now() + interval '60 seconds' else j.run_after end,
        updated_at = now()
    where j.id = v_row.job_id;

    insert into public.worker_dead_letters(job_id, run_id, reason, payload, retryable)
    select j.id, v_row.run_id, 'Lease expired and retries exhausted', coalesce(j.payload, '{}'::jsonb), false
    from public.worker_jobs j
    where j.id = v_row.job_id and j.status = 'dead_letter'
    on conflict do nothing;

    perform public.worker_runtime_audit(v_row.job_id, v_row.run_id, 'lease.expired', 'worker-runtime', '{}'::jsonb);
    v_count := v_count + 1;
  end loop;

  return v_count;
end;
$$;

create or replace function public.worker_record_artifact(
  p_run_id uuid,
  p_lease_token text,
  p_artifact_type text,
  p_artifact_name text default null,
  p_artifact_url text default null,
  p_metadata jsonb default '{}'::jsonb
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_job_id uuid;
  v_artifact_id uuid;
begin
  select job_id into v_job_id
  from public.worker_job_leases
  where run_id = p_run_id and lease_token = p_lease_token and status = 'active' and expires_at > now()
  limit 1;

  if v_job_id is null then
    raise exception 'active lease not found';
  end if;

  insert into public.worker_job_artifacts(job_id, run_id, artifact_type, artifact_name, artifact_url, metadata)
  values (v_job_id, p_run_id, coalesce(nullif(p_artifact_type, ''), 'evidence'), p_artifact_name, p_artifact_url, coalesce(p_metadata, '{}'::jsonb))
  returning id into v_artifact_id;

  perform public.worker_runtime_audit(v_job_id, p_run_id, 'artifact.recorded', 'worker-runtime', jsonb_build_object('artifactId', v_artifact_id, 'artifactType', p_artifact_type));
  return v_artifact_id;
end;
$$;

revoke all on function public.worker_runtime_audit(uuid, uuid, text, text, jsonb) from public, authenticated;
revoke all on function public.worker_enqueue_job(text, jsonb, text, text, text, text, text, text, text, integer, timestamptz) from public, authenticated;
revoke all on function public.worker_acquire_job(text, text[], integer) from public, authenticated;
revoke all on function public.worker_heartbeat(uuid, text, numeric, jsonb, integer) from public, authenticated;
revoke all on function public.worker_complete_job(uuid, text, jsonb) from public, authenticated;
revoke all on function public.worker_fail_job(uuid, text, text, boolean) from public, authenticated;
revoke all on function public.worker_expire_stale_leases() from public, authenticated;
revoke all on function public.worker_record_artifact(uuid, text, text, text, text, jsonb) from public, authenticated;
do $$
begin
  if to_regprocedure('public.worker_runtime_audit(uuid, uuid, text, text, jsonb)') is not null then
    execute 'grant execute on function public.worker_runtime_audit(uuid, uuid, text, text, jsonb) to service_role';
  end if;
end;
$$;
do $$
begin
  if to_regprocedure('public.worker_enqueue_job(text, jsonb, text, text, text, text, text, text, text, integer, timestamptz)') is not null then
    execute 'grant execute on function public.worker_enqueue_job(text, jsonb, text, text, text, text, text, text, text, integer, timestamptz) to service_role';
  end if;
end;
$$;
do $$
begin
  if to_regprocedure('public.worker_acquire_job(text, text[], integer)') is not null then
    execute 'grant execute on function public.worker_acquire_job(text, text[], integer) to service_role';
  end if;
end;
$$;
do $$
begin
  if to_regprocedure('public.worker_heartbeat(uuid, text, numeric, jsonb, integer)') is not null then
    execute 'grant execute on function public.worker_heartbeat(uuid, text, numeric, jsonb, integer) to service_role';
  end if;
end;
$$;
do $$
begin
  if to_regprocedure('public.worker_complete_job(uuid, text, jsonb)') is not null then
    execute 'grant execute on function public.worker_complete_job(uuid, text, jsonb) to service_role';
  end if;
end;
$$;
do $$
begin
  if to_regprocedure('public.worker_fail_job(uuid, text, text, boolean)') is not null then
    execute 'grant execute on function public.worker_fail_job(uuid, text, text, boolean) to service_role';
  end if;
end;
$$;
do $$
begin
  if to_regprocedure('public.worker_expire_stale_leases()') is not null then
    execute 'grant execute on function public.worker_expire_stale_leases() to service_role';
  end if;
end;
$$;
do $$
begin
  if to_regprocedure('public.worker_record_artifact(uuid, text, text, text, text, jsonb)') is not null then
    execute 'grant execute on function public.worker_record_artifact(uuid, text, text, text, text, jsonb) to service_role';
  end if;
end;
$$;
