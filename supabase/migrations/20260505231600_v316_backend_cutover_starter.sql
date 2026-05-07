-- v316 Supabase Backend Cutover Starter
-- Additive only. Does not replace existing app tables.

create extension if not exists pgcrypto;

create table if not exists public.backend_cutover_checks (
  id uuid primary key default gen_random_uuid(),
  check_key text not null unique,
  module text not null,
  label text not null,
  status text not null default 'not_checked',
  required_for_cutover boolean not null default true,
  notes text,
  created_at timestamptz not null default now()
);

create table if not exists public.backend_connection_events (
  id uuid primary key default gen_random_uuid(),
  environment text not null default 'development',
  status text not null,
  message text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);

create table if not exists public.data_provider_audit_events (
  id uuid primary key default gen_random_uuid(),
  provider_mode text not null,
  resource text,
  action text not null,
  status text not null,
  message text,
  metadata jsonb not null default '{}'::jsonb,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);

create index if not exists idx_backend_connection_events_created on public.backend_connection_events(environment, created_at desc);
create index if not exists idx_data_provider_audit_events_created on public.data_provider_audit_events(provider_mode, created_at desc);

alter table public.backend_cutover_checks enable row level security;
alter table public.backend_connection_events enable row level security;
alter table public.data_provider_audit_events enable row level security;

insert into public.backend_cutover_checks (check_key, module, label, status, required_for_cutover)
values
  ('supabase_env', 'backend', 'Supabase URL and anon key configured', 'not_checked', true),
  ('service_role_safe', 'security', 'Service role key is not exposed to frontend', 'not_checked', true),
  ('rls_tested', 'security', 'RLS policies tested on staging', 'not_checked', true),
  ('backup_restore_tested', 'ops', 'Backup and restore tested before cutover', 'not_checked', true),
  ('master_data_cutover_plan', 'setup', 'Master data cutover plan approved', 'not_checked', true)
on conflict (check_key) do update set
  module = excluded.module,
  label = excluded.label,
  required_for_cutover = excluded.required_for_cutover;
