-- v77 Enterprise Autopilot Mega Bundle - Supabase backend design placeholder.

create table if not exists public.enterprise_close_runs (
  id uuid primary key default gen_random_uuid(),
  period_code text not null,
  store_id uuid,
  status text not null default 'draft',
  readiness_score numeric not null default 0,
  blockers jsonb not null default '[]'::jsonb,
  warnings jsonb not null default '[]'::jsonb,
  created_by uuid,
  created_at timestamptz not null default now(),
  approved_by uuid,
  approved_at timestamptz,
  closed_at timestamptz
);

create table if not exists public.settlement_workbench_rows (
  id uuid primary key default gen_random_uuid(),
  close_run_id uuid references public.enterprise_close_runs(id) on delete cascade,
  source_system text not null default 'foodics',
  payment_method text not null,
  expected_amount numeric not null default 0,
  settled_amount numeric not null default 0,
  difference_amount numeric not null default 0,
  gl_account_code text,
  status text not null default 'unmatched',
  notes text
);

create table if not exists public.approval_inbox_items (
  id uuid primary key default gen_random_uuid(),
  module_key text not null,
  document_ref text not null,
  approval_type text not null,
  amount numeric not null default 0,
  status text not null default 'pending',
  assigned_to uuid,
  due_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.qa_regression_runs (
  id uuid primary key default gen_random_uuid(),
  version_label text not null,
  run_status text not null default 'draft',
  test_rows jsonb not null default '[]'::jsonb,
  created_by uuid,
  created_at timestamptz not null default now()
);
