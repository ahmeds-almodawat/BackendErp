-- v100 Enterprise Production Readiness design notes
-- This file is a blueprint for the next production backend phase.

create table if not exists public.enterprise_readiness_reviews (
  id uuid primary key default gen_random_uuid(),
  period_code text not null,
  score numeric not null default 0,
  blockers integer not null default 0,
  warnings integer not null default 0,
  notes text,
  reviewed_by uuid,
  reviewed_at timestamptz not null default now()
);

create table if not exists public.posting_guard_events (
  id uuid primary key default gen_random_uuid(),
  document_type text not null,
  document_ref text not null,
  period_code text,
  status text not null check (status in ('blocked','validated','approved','posted','reversed')),
  blockers jsonb not null default '[]'::jsonb,
  created_by uuid,
  created_at timestamptz not null default now()
);

create table if not exists public.monthly_close_certificates (
  id uuid primary key default gen_random_uuid(),
  period_code text not null unique,
  sales_closed boolean not null default false,
  inventory_closed boolean not null default false,
  purchasing_closed boolean not null default false,
  finance_closed boolean not null default false,
  close_status text not null default 'open' check (close_status in ('open','ready','closed','reopened')),
  close_notes text,
  closed_by uuid,
  closed_at timestamptz
);
