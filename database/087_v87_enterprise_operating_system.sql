-- v87 Enterprise Operating System design notes
-- This file is a backend blueprint for the new control tower.

create table if not exists public.enterprise_control_checks (
  id uuid primary key default gen_random_uuid(),
  period_code text not null,
  area text not null,
  control text not null,
  status text not null check (status in ('good','warn','bad','info')),
  score numeric not null default 0,
  detail text,
  action text,
  created_at timestamptz not null default now()
);

create table if not exists public.monthly_close_certificates (
  id uuid primary key default gen_random_uuid(),
  period_code text not null,
  readiness_score numeric not null,
  blockers_count integer not null default 0,
  warnings_count integer not null default 0,
  sales_revenue numeric not null default 0,
  gross_profit numeric not null default 0,
  inventory_value numeric not null default 0,
  ap_balance numeric not null default 0,
  status text not null default 'draft' check (status in ('draft','submitted','approved','closed','reopened')),
  approved_by uuid,
  approved_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.enterprise_action_plan (
  id uuid primary key default gen_random_uuid(),
  period_code text not null,
  priority integer not null,
  area text not null,
  issue text not null,
  severity text not null,
  owner text,
  action text,
  status text not null default 'open' check (status in ('open','in_progress','done','cancelled')),
  created_at timestamptz not null default now()
);
