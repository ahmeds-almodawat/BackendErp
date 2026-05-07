-- v260 Tera Mega Ultra Patch design notes
-- This file documents the intended backend structures for pilot execution evidence.

create table if not exists public.pilot_test_runs (
  id uuid primary key default gen_random_uuid(),
  company_id uuid,
  period_code text,
  readiness_score numeric default 0,
  blocker_count int default 0,
  warning_count int default 0,
  created_by uuid,
  created_at timestamptz default now(),
  notes text
);

create table if not exists public.pilot_test_run_items (
  id uuid primary key default gen_random_uuid(),
  run_id uuid references public.pilot_test_runs(id) on delete cascade,
  test_code text not null,
  module text,
  expected_result text,
  actual_result text,
  status text default 'pending',
  evidence_url text,
  created_at timestamptz default now()
);

create table if not exists public.pilot_issue_register (
  id uuid primary key default gen_random_uuid(),
  company_id uuid,
  severity text not null,
  module text not null,
  issue text not null,
  recommended_fix text,
  status text default 'open',
  owner_user_id uuid,
  created_at timestamptz default now(),
  resolved_at timestamptz
);
