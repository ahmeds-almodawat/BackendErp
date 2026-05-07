-- v181 Auth + setup persistence wiring foundation
-- Purpose: bridge local setup data into Supabase safely before posting operational documents.

create table if not exists public.setup_sync_batches (
  id uuid primary key default gen_random_uuid(),
  company_id uuid,
  batch_ref text not null unique,
  source text not null default 'local_trial',
  status text not null default 'draft' check (status in ('draft','validated','dry_run','posted','failed','reversed')),
  dry_run boolean not null default true,
  entity_counts jsonb not null default '{}'::jsonb,
  validation_summary jsonb not null default '{}'::jsonb,
  payload jsonb not null default '{}'::jsonb,
  created_by uuid,
  created_at timestamptz not null default now(),
  posted_at timestamptz
);

-- Auto compatibility columns for later enterprise migrations.
alter table if exists public.setup_sync_batches add column if not exists company_code text;
alter table if exists public.setup_sync_batches add column if not exists validation jsonb;
alter table if exists public.setup_sync_batches add column if not exists row_counts jsonb;


create table if not exists public.setup_sync_rows (
  id uuid primary key default gen_random_uuid(),
  batch_id uuid not null references public.setup_sync_batches(id) on delete cascade,
  entity_type text not null,
  source_key text not null,
  action text not null default 'upsert' check (action in ('insert','update','upsert','skip','error')),
  status text not null default 'staged' check (status in ('staged','validated','posted','error','skipped')),
  row_payload jsonb not null default '{}'::jsonb,
  error_message text,
  created_at timestamptz not null default now()
);

create index if not exists idx_setup_sync_rows_batch_entity on public.setup_sync_rows(batch_id, entity_type);
create index if not exists idx_setup_sync_rows_source_key on public.setup_sync_rows(entity_type, source_key);

create table if not exists public.backend_mode_status (
  id uuid primary key default gen_random_uuid(),
  company_id uuid,
  mode text not null default 'local_trial' check (mode in ('local_trial','supabase_pilot','production')),
  setup_persistence_enabled boolean not null default false,
  foodics_staging_enabled boolean not null default false,
  posting_orchestrator_enabled boolean not null default false,
  last_health_check_at timestamptz,
  health_summary jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.setup_sync_batches enable row level security;
alter table public.setup_sync_rows enable row level security;
alter table public.backend_mode_status enable row level security;

-- Production note:
-- Replace broad authenticated policies below with company-scoped permission checks after auth bootstrap is live.
do $$ begin
  create policy "setup sync batches authenticated read" on public.setup_sync_batches for select to authenticated using (true);
exception when duplicate_object then null; end $$;
do $$ begin
  create policy "setup sync batches authenticated write" on public.setup_sync_batches for all to authenticated using (true) with check (true);
exception when duplicate_object then null; end $$;
do $$ begin
  create policy "setup sync rows authenticated read" on public.setup_sync_rows for select to authenticated using (true);
exception when duplicate_object then null; end $$;
do $$ begin
  create policy "setup sync rows authenticated write" on public.setup_sync_rows for all to authenticated using (true) with check (true);
exception when duplicate_object then null; end $$;
do $$ begin
  create policy "backend mode authenticated read" on public.backend_mode_status for select to authenticated using (true);
exception when duplicate_object then null; end $$;
