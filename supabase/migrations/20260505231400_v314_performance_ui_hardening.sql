-- v314 Performance and UI Hardening foundation

create extension if not exists pgcrypto;

create table if not exists public.ui_error_events (
  id uuid primary key default gen_random_uuid(),
  reference_id text not null unique,
  module text,
  message text not null,
  severity text not null default 'error' check (severity in ('info', 'warning', 'error', 'critical')),
  metadata jsonb not null default '{}'::jsonb,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);

create table if not exists public.ui_performance_snapshots (
  id uuid primary key default gen_random_uuid(),
  route_key text,
  bundle_kb numeric,
  row_count int,
  status text not null default 'unknown',
  findings jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.ui_hardening_checklist_runs (
  id uuid primary key default gen_random_uuid(),
  status text not null default 'not_checked',
  score int not null default 0 check (score between 0 and 100),
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);

create table if not exists public.ui_hardening_checklist_items (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null references public.ui_hardening_checklist_runs(id) on delete cascade,
  item_key text not null,
  label text not null,
  status text not null default 'not_checked',
  notes text,
  created_at timestamptz not null default now()
);

create index if not exists idx_ui_error_events_created on public.ui_error_events(created_at desc);
create index if not exists idx_ui_performance_snapshots_route on public.ui_performance_snapshots(route_key, created_at desc);

alter table public.ui_error_events enable row level security;
alter table public.ui_performance_snapshots enable row level security;
alter table public.ui_hardening_checklist_runs enable row level security;
alter table public.ui_hardening_checklist_items enable row level security;
