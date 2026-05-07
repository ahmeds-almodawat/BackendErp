-- v374 Job Runtime Schema
-- Purpose: create the real backend tables required before v375 worker lease/acquire/heartbeat/release logic.
-- This migration intentionally keeps direct authenticated writes closed. Future workers/RPCs should write with
-- service-role or tightly permission-checked SECURITY DEFINER functions.

create table if not exists public.worker_jobs (
  id text primary key,
  job_type text not null,
  module_key text not null,
  lane text not null default 'background',
  priority text not null default 'P2',
  status text not null default 'queued',
  branch_id text,
  store_id text,
  source_ref text,
  payload jsonb not null default '{}'::jsonb,
  idempotency_key text not null,
  retry_policy jsonb not null default '{"maxAttempts":3,"backoffSeconds":30,"deadLetterAfterAttempts":3}'::jsonb,
  available_at timestamptz not null default now(),
  locked_at timestamptz,
  completed_at timestamptz,
  failed_at timestamptz,
  last_error text,
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint worker_jobs_lane_chk check (lane in ('interactive', 'background', 'scheduled', 'archive')),
  constraint worker_jobs_priority_chk check (priority in ('P0', 'P1', 'P2', 'P3')),
  constraint worker_jobs_status_chk check (status in ('queued', 'leased', 'running', 'paused', 'completed', 'failed', 'cancelled', 'dead_lettered'))
);

create unique index if not exists worker_jobs_idempotency_key_uidx
  on public.worker_jobs (idempotency_key);

create index if not exists worker_jobs_status_available_idx
  on public.worker_jobs (status, available_at, priority);

create index if not exists worker_jobs_module_branch_idx
  on public.worker_jobs (module_key, branch_id);

create table if not exists public.worker_job_runs (
  id text primary key,
  job_id text not null references public.worker_jobs(id) on delete cascade,
  attempt_no integer not null default 1,
  status text not null default 'created',
  worker_id text,
  lease_token text,
  lease_expires_at timestamptz,
  heartbeat_at timestamptz,
  processed_rows integer not null default 0,
  total_rows integer,
  started_at timestamptz,
  completed_at timestamptz,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint worker_job_runs_attempt_chk check (attempt_no >= 1),
  constraint worker_job_runs_processed_rows_chk check (processed_rows >= 0),
  constraint worker_job_runs_status_chk check (status in ('created', 'leased', 'running', 'heartbeat_stale', 'completed', 'failed', 'released', 'expired', 'dead_lettered'))
);

create index if not exists worker_job_runs_job_id_idx
  on public.worker_job_runs (job_id, attempt_no);

create index if not exists worker_job_runs_status_lease_idx
  on public.worker_job_runs (status, lease_expires_at);

create table if not exists public.worker_job_leases (
  id text primary key,
  job_id text not null references public.worker_jobs(id) on delete cascade,
  job_run_id text not null references public.worker_job_runs(id) on delete cascade,
  worker_id text not null,
  lease_token text not null,
  status text not null default 'active',
  acquired_at timestamptz not null default now(),
  heartbeat_at timestamptz,
  expires_at timestamptz not null,
  released_at timestamptz,
  created_at timestamptz not null default now(),
  constraint worker_job_leases_status_chk check (status in ('active', 'released', 'expired', 'stolen', 'cancelled'))
);

create unique index if not exists worker_job_leases_active_uidx
  on public.worker_job_leases (job_id)
  where status = 'active';

create index if not exists worker_job_leases_expiry_idx
  on public.worker_job_leases (status, expires_at);

create table if not exists public.worker_job_checkpoints (
  id text primary key,
  job_id text not null references public.worker_jobs(id) on delete cascade,
  job_run_id text not null references public.worker_job_runs(id) on delete cascade,
  checkpoint_key text not null,
  checkpoint_value jsonb not null default '{}'::jsonb,
  processed_rows integer not null default 0,
  created_at timestamptz not null default now(),
  constraint worker_job_checkpoints_processed_rows_chk check (processed_rows >= 0)
);

create unique index if not exists worker_job_checkpoints_run_key_uidx
  on public.worker_job_checkpoints (job_run_id, checkpoint_key);

create table if not exists public.worker_job_artifacts (
  id text primary key,
  job_id text not null references public.worker_jobs(id) on delete cascade,
  job_run_id text references public.worker_job_runs(id) on delete set null,
  artifact_type text not null,
  storage_bucket text,
  storage_path text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists worker_job_artifacts_job_id_idx
  on public.worker_job_artifacts (job_id, artifact_type, created_at desc);

create table if not exists public.worker_dead_letters (
  id text primary key,
  job_id text not null references public.worker_jobs(id) on delete cascade,
  job_run_id text references public.worker_job_runs(id) on delete set null,
  reason text not null,
  last_error text,
  payload jsonb not null default '{}'::jsonb,
  attempts integer not null default 0,
  review_status text not null default 'open',
  reviewed_by uuid,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  resolved_at timestamptz,
  constraint worker_dead_letters_attempts_chk check (attempts >= 0),
  constraint worker_dead_letters_review_status_chk check (review_status in ('open', 'acknowledged', 'retry_planned', 'resolved', 'ignored'))
);

create index if not exists worker_dead_letters_review_idx
  on public.worker_dead_letters (review_status, created_at desc);

create table if not exists public.worker_audit_events (
  id text primary key,
  job_id text references public.worker_jobs(id) on delete set null,
  job_run_id text references public.worker_job_runs(id) on delete set null,
  event_type text not null,
  actor_user_id uuid,
  worker_id text,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists worker_audit_events_job_idx
  on public.worker_audit_events (job_id, job_run_id, event_type);

create index if not exists worker_audit_events_created_idx
  on public.worker_audit_events (created_at desc);

alter table public.worker_jobs enable row level security;
alter table public.worker_job_runs enable row level security;
alter table public.worker_job_leases enable row level security;
alter table public.worker_job_checkpoints enable row level security;
alter table public.worker_job_artifacts enable row level security;
alter table public.worker_dead_letters enable row level security;
alter table public.worker_audit_events enable row level security;

-- Read policies keep operations visible to authenticated users during staging.
-- Direct writes intentionally have no authenticated policy; v375+ should use service/RPC-controlled writes.
create policy worker_jobs_read_authenticated
  on public.worker_jobs
  for select
  to authenticated
  using (auth.uid() is not null);

create policy worker_job_runs_read_authenticated
  on public.worker_job_runs
  for select
  to authenticated
  using (auth.uid() is not null);

create policy worker_job_leases_read_authenticated
  on public.worker_job_leases
  for select
  to authenticated
  using (auth.uid() is not null);

create policy worker_job_checkpoints_read_authenticated
  on public.worker_job_checkpoints
  for select
  to authenticated
  using (auth.uid() is not null);

create policy worker_job_artifacts_read_authenticated
  on public.worker_job_artifacts
  for select
  to authenticated
  using (auth.uid() is not null);

create policy worker_dead_letters_read_authenticated
  on public.worker_dead_letters
  for select
  to authenticated
  using (auth.uid() is not null);

create policy worker_audit_events_read_authenticated
  on public.worker_audit_events
  for select
  to authenticated
  using (auth.uid() is not null);

comment on table public.worker_jobs is 'v374 canonical queued job table. Writes are reserved for service-role/RPC-controlled runtime.';
comment on table public.worker_job_runs is 'v374 execution attempts for queued jobs. v375 adds acquire/heartbeat/release behavior.';
comment on table public.worker_job_leases is 'v374 lease records for safe worker coordination.';
comment on table public.worker_job_checkpoints is 'v374 resumable checkpoint records.';
comment on table public.worker_job_artifacts is 'v374 job evidence/export artifact registry.';
comment on table public.worker_dead_letters is 'v374 dead-letter queue for retry-exhausted jobs.';
comment on table public.worker_audit_events is 'v374 audit events for worker runtime lifecycle.';
