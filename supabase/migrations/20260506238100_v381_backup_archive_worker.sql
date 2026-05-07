-- v381 Backup / Archive Worker and Restore Evidence Foundations
-- Adds durable backup/archive run evidence on top of the v375 worker runtime.
-- This migration does not dump production databases by itself; it records backup/archive jobs,
-- artifacts, integrity evidence, and restore drill outcomes for service-role workers.

create extension if not exists pgcrypto;

create table if not exists public.backup_archive_runs (
  id uuid primary key default gen_random_uuid(),
  job_id uuid references public.worker_jobs(id) on delete set null,
  run_id uuid references public.worker_job_runs(id) on delete set null,
  backup_scope text not null default 'full-platform',
  status text not null default 'queued' check (status in ('queued','running','completed','failed','cancelled','restored','verified')),
  requested_by uuid,
  branch_id text,
  source_counts jsonb not null default '{}'::jsonb,
  manifest jsonb not null default '{}'::jsonb,
  artifact_count integer not null default 0,
  warning_count integer not null default 0,
  integrity_hash text,
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.backup_archive_artifacts (
  id uuid primary key default gen_random_uuid(),
  backup_run_id uuid not null references public.backup_archive_runs(id) on delete cascade,
  job_id uuid references public.worker_jobs(id) on delete set null,
  run_id uuid references public.worker_job_runs(id) on delete set null,
  artifact_type text not null default 'backup-zip',
  artifact_name text not null,
  storage_bucket text,
  storage_path text,
  content_type text,
  byte_size bigint,
  sha256_hash text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.backup_restore_runs (
  id uuid primary key default gen_random_uuid(),
  backup_run_id uuid references public.backup_archive_runs(id) on delete set null,
  restore_scope text not null default 'full-platform',
  status text not null default 'planned' check (status in ('planned','running','completed','failed','verified','cancelled')),
  target_environment text not null default 'staging',
  requested_by uuid,
  started_at timestamptz,
  completed_at timestamptz,
  verification_summary jsonb not null default '{}'::jsonb,
  error_message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.backup_archive_events (
  id uuid primary key default gen_random_uuid(),
  backup_run_id uuid references public.backup_archive_runs(id) on delete set null,
  restore_run_id uuid references public.backup_restore_runs(id) on delete set null,
  job_id uuid references public.worker_jobs(id) on delete set null,
  run_id uuid references public.worker_job_runs(id) on delete set null,
  event_type text not null,
  severity text not null default 'info' check (severity in ('info','warning','critical')),
  message text,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists backup_archive_runs_status_idx on public.backup_archive_runs(status, backup_scope, created_at desc);
create index if not exists backup_archive_runs_job_idx on public.backup_archive_runs(job_id, run_id, created_at desc);
create index if not exists backup_archive_artifacts_run_idx on public.backup_archive_artifacts(backup_run_id, artifact_type, created_at desc);
create index if not exists backup_restore_runs_backup_idx on public.backup_restore_runs(backup_run_id, status, created_at desc);
create index if not exists backup_archive_events_run_idx on public.backup_archive_events(backup_run_id, restore_run_id, event_type, created_at desc);

alter table public.backup_archive_runs enable row level security;
alter table public.backup_archive_artifacts enable row level security;
alter table public.backup_restore_runs enable row level security;
alter table public.backup_archive_events enable row level security;

drop policy if exists backup_archive_runs_read_authenticated_v381 on public.backup_archive_runs;
create policy backup_archive_runs_read_authenticated_v381 on public.backup_archive_runs for select to authenticated using (true);

drop policy if exists backup_archive_artifacts_read_authenticated_v381 on public.backup_archive_artifacts;
create policy backup_archive_artifacts_read_authenticated_v381 on public.backup_archive_artifacts for select to authenticated using (true);

drop policy if exists backup_restore_runs_read_authenticated_v381 on public.backup_restore_runs;
create policy backup_restore_runs_read_authenticated_v381 on public.backup_restore_runs for select to authenticated using (true);

drop policy if exists backup_archive_events_read_authenticated_v381 on public.backup_archive_events;
create policy backup_archive_events_read_authenticated_v381 on public.backup_archive_events for select to authenticated using (true);

create or replace function public.worker_backup_archive_event(
  p_backup_run_id uuid,
  p_restore_run_id uuid,
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
  insert into public.backup_archive_events(backup_run_id, restore_run_id, job_id, run_id, event_type, severity, message, details)
  values (
    p_backup_run_id,
    p_restore_run_id,
    p_job_id,
    p_run_id,
    coalesce(nullif(p_event_type, ''), 'backup_archive.event'),
    coalesce(nullif(p_severity, ''), 'info'),
    p_message,
    coalesce(p_details, '{}'::jsonb)
  );
end;
$$;

create or replace function public.worker_backup_archive_source_counts()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_result jsonb := '{}'::jsonb;
  v_table text;
  v_count bigint;
  v_tables text[] := array[
    'branches','stores','suppliers','items','menu_items','recipe_lines','stock_movements','journals',
    'purchase_invoices','supplier_payments','sales_pos_batches','worker_jobs','worker_job_runs',
    'inventory_rebuild_balances','pos_replay_applied_rows','import_cutover_applied_rows','report_snapshot_runs',
    'finance_reconciliation_runs','activity_logs','audit_logs'
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

create or replace function public.worker_enqueue_backup_archive(
  p_backup_scope text default 'full-platform',
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
  v_payload := coalesce(p_payload, '{}'::jsonb) || jsonb_build_object('backupScope', coalesce(nullif(p_backup_scope, ''), 'full-platform'));
  v_idempotency_key := encode(digest('backup.archive:' || coalesce(p_backup_scope, 'full-platform') || ':' || coalesce(v_payload::text, ''), 'sha256'), 'hex');

  v_job_id := public.worker_enqueue_job(
    'backup.archive',
    v_payload,
    v_idempotency_key,
    'archive',
    coalesce(nullif(p_priority, ''), 'P1'),
    'ops',
    'Backup archive worker',
    null,
    null,
    3,
    coalesce(p_run_after, now())
  );

  perform public.worker_runtime_audit(v_job_id, null, 'backup_archive.enqueue', 'backup-archive-worker', v_payload);
  return v_job_id;
end;
$$;

create or replace function public.worker_acquire_backup_archive_job(
  p_worker_id text,
  p_lease_seconds integer default 900
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
  v_lease_seconds integer := least(3600, greatest(60, coalesce(p_lease_seconds, 900)));
  v_expires_at timestamptz := now() + make_interval(secs => least(3600, greatest(60, coalesce(p_lease_seconds, 900))));
  v_checkpoint jsonb := '{}'::jsonb;
begin
  if p_worker_id is null or btrim(p_worker_id) = '' then
    raise exception 'worker_id is required';
  end if;

  select * into v_job
  from public.worker_jobs
  where status in ('queued', 'retry')
    and job_type = 'backup.archive'
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

  insert into public.backup_archive_runs(job_id, run_id, backup_scope, status, source_counts, manifest, started_at)
  values (
    v_job.id,
    v_run_id,
    coalesce(v_job.payload->>'backupScope', 'full-platform'),
    'running',
    public.worker_backup_archive_source_counts(),
    jsonb_build_object('workerId', p_worker_id, 'leaseSeconds', v_lease_seconds),
    now()
  );

  perform public.worker_runtime_audit(v_job.id, v_run_id, 'backup_archive.acquire', p_worker_id, jsonb_build_object('leaseSeconds', v_lease_seconds));

  return query select v_run_id, v_job.id, v_lease_token, v_job.payload, v_job.attempt_count + 1, coalesce(v_checkpoint, '{}'::jsonb), v_expires_at;
end;
$$;

create or replace function public.worker_run_backup_archive_batch(
  p_worker_id text,
  p_run_id uuid,
  p_lease_token text
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_job_id uuid;
  v_backup_run_id uuid;
  v_sources jsonb := public.worker_backup_archive_source_counts();
  v_manifest jsonb;
  v_hash text;
  v_result jsonb;
  v_warnings integer := 0;
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

  select id into v_backup_run_id
  from public.backup_archive_runs
  where run_id = p_run_id
  order by created_at desc
  limit 1;

  if v_backup_run_id is null then
    insert into public.backup_archive_runs(job_id, run_id, status, source_counts, started_at)
    values (v_job_id, p_run_id, 'running', v_sources, now())
    returning id into v_backup_run_id;
  end if;

  if not (v_sources ? 'worker_jobs') or v_sources->>'worker_jobs' is null then
    v_warnings := v_warnings + 1;
  end if;

  v_manifest := jsonb_build_object(
    'version', 'v381 Backup Archive Worker',
    'generatedAt', now(),
    'sourceCounts', v_sources,
    'warningCount', v_warnings,
    'note', 'This worker records backup evidence. Actual object/database dump artifact should be written by the service worker and registered with worker_record_artifact or backup_archive_artifacts.'
  );
  v_hash := encode(digest(v_manifest::text, 'sha256'), 'hex');

  update public.backup_archive_runs
  set status = 'completed',
      completed_at = now(),
      updated_at = now(),
      source_counts = v_sources,
      manifest = v_manifest,
      warning_count = v_warnings,
      integrity_hash = v_hash,
      artifact_count = 1
  where id = v_backup_run_id;

  insert into public.backup_archive_artifacts(backup_run_id, job_id, run_id, artifact_type, artifact_name, content_type, sha256_hash, metadata)
  values (v_backup_run_id, v_job_id, p_run_id, 'manifest', 'v381-backup-manifest.json', 'application/json', v_hash, v_manifest);

  insert into public.worker_job_checkpoints(job_id, run_id, checkpoint_key, checkpoint_value, cursor_value, row_count)
  values (v_job_id, p_run_id, 'backup.archive', jsonb_build_object('status', 'completed', 'backupRunId', v_backup_run_id, 'hash', v_hash), 'completed', 1);

  perform public.worker_record_artifact(v_job_id, p_run_id, 'backup_manifest', 'v381-backup-manifest.json', null, v_manifest);
  perform public.worker_complete_job(p_worker_id, p_run_id, p_lease_token, jsonb_build_object('backupRunId', v_backup_run_id, 'integrityHash', v_hash, 'warningCount', v_warnings));
  perform public.worker_backup_archive_event(v_backup_run_id, null, v_job_id, p_run_id, 'backup_archive.completed', case when v_warnings > 0 then 'warning' else 'info' end, 'Backup archive evidence completed.', v_manifest);

  v_result := jsonb_build_object('ok', true, 'backupRunId', v_backup_run_id, 'integrityHash', v_hash, 'warningCount', v_warnings, 'sourceCounts', v_sources);
  return v_result;
exception when others then
  perform public.worker_fail_job(p_worker_id, p_run_id, p_lease_token, sqlerrm, jsonb_build_object('stage', 'backup.archive'));
  raise;
end;
$$;

create or replace function public.worker_record_restore_evidence(
  p_backup_run_id uuid,
  p_restore_scope text default 'full-platform',
  p_target_environment text default 'staging',
  p_status text default 'verified',
  p_verification_summary jsonb default '{}'::jsonb,
  p_error_message text default null
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_restore_id uuid;
begin
  insert into public.backup_restore_runs(backup_run_id, restore_scope, status, target_environment, started_at, completed_at, verification_summary, error_message)
  values (
    p_backup_run_id,
    coalesce(nullif(p_restore_scope, ''), 'full-platform'),
    coalesce(nullif(p_status, ''), 'verified'),
    coalesce(nullif(p_target_environment, ''), 'staging'),
    now(),
    now(),
    coalesce(p_verification_summary, '{}'::jsonb),
    p_error_message
  )
  returning id into v_restore_id;

  perform public.worker_backup_archive_event(p_backup_run_id, v_restore_id, null, null, 'restore.evidence_recorded', case when p_status in ('failed','cancelled') then 'critical' else 'info' end, 'Restore drill evidence recorded.', coalesce(p_verification_summary, '{}'::jsonb));
  return v_restore_id;
end;
$$;

revoke all on function public.worker_backup_archive_event(uuid, uuid, uuid, uuid, text, text, text, jsonb) from public, authenticated;
revoke all on function public.worker_backup_archive_source_counts() from public, authenticated;
revoke all on function public.worker_enqueue_backup_archive(text, jsonb, text, timestamptz) from public, authenticated;
revoke all on function public.worker_acquire_backup_archive_job(text, integer) from public, authenticated;
revoke all on function public.worker_run_backup_archive_batch(text, uuid, text) from public, authenticated;
revoke all on function public.worker_record_restore_evidence(uuid, text, text, text, jsonb, text) from public, authenticated;

grant execute on function public.worker_backup_archive_event(uuid, uuid, uuid, uuid, text, text, text, jsonb) to service_role;
grant execute on function public.worker_backup_archive_source_counts() to service_role;
grant execute on function public.worker_enqueue_backup_archive(text, jsonb, text, timestamptz) to service_role;
grant execute on function public.worker_acquire_backup_archive_job(text, integer) to service_role;
grant execute on function public.worker_run_backup_archive_batch(text, uuid, text) to service_role;
grant execute on function public.worker_record_restore_evidence(uuid, text, text, text, jsonb, text) to service_role;
