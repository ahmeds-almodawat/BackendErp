-- v280 backend pilot support tables
create table if not exists public.setup_sync_dry_runs (
  id uuid primary key default gen_random_uuid(),
  company_id uuid,
  created_by uuid,
  status text not null default 'dry_run',
  payload_summary jsonb not null default '{}'::jsonb,
  validation_summary jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.posting_orchestration_dry_runs (
  id uuid primary key default gen_random_uuid(),
  company_id uuid,
  source_module text not null,
  source_document_id text,
  posting_mode text not null,
  guard_result jsonb not null default '{}'::jsonb,
  created_by uuid,
  created_at timestamptz not null default now()
);

alter table public.setup_sync_dry_runs enable row level security;
alter table public.posting_orchestration_dry_runs enable row level security;

-- Policies are intentionally permissive for local pilot and must be tightened with company/user permission checks before production.
do $$ begin
  create policy "authenticated setup dry run read" on public.setup_sync_dry_runs for select to authenticated using (true);
exception when duplicate_object then null; end $$;
do $$ begin
  create policy "authenticated setup dry run insert" on public.setup_sync_dry_runs for insert to authenticated with check (true);
exception when duplicate_object then null; end $$;
do $$ begin
  create policy "authenticated posting dry run read" on public.posting_orchestration_dry_runs for select to authenticated using (true);
exception when duplicate_object then null; end $$;
do $$ begin
  create policy "authenticated posting dry run insert" on public.posting_orchestration_dry_runs for insert to authenticated with check (true);
exception when duplicate_object then null; end $$;
