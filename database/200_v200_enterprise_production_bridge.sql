-- v200 Enterprise Production Bridge Design
-- This file documents the next production tables. Apply only after reviewing with the finalized backend schema.

create table if not exists public.backend_bridge_health (
  id uuid primary key default gen_random_uuid(),
  company_id uuid,
  mode text not null default 'local',
  status text not null default 'draft',
  last_checked_at timestamptz default now(),
  details jsonb not null default '{}'::jsonb
);

create table if not exists public.posting_orchestrator_requests (
  id uuid primary key default gen_random_uuid(),
  company_id uuid,
  document_type text not null,
  document_ref text not null,
  posting_mode text not null,
  status text not null default 'draft',
  validation_result jsonb not null default '{}'::jsonb,
  requested_by uuid,
  approved_by uuid,
  posted_by uuid,
  created_at timestamptz default now(),
  approved_at timestamptz,
  posted_at timestamptz
);

create table if not exists public.approval_workflow_rules (
  id uuid primary key default gen_random_uuid(),
  company_id uuid,
  document_type text not null,
  branch_scope text default 'all',
  amount_from numeric default 0,
  amount_to numeric,
  required_permission text not null,
  required_role_key text,
  active boolean default true,
  created_at timestamptz default now()
);

create table if not exists public.document_timeline_events (
  id uuid primary key default gen_random_uuid(),
  company_id uuid,
  document_type text not null,
  document_ref text not null,
  event_type text not null,
  note text,
  actor_id uuid,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz default now()
);

create table if not exists public.attachment_vault_requests (
  id uuid primary key default gen_random_uuid(),
  company_id uuid,
  document_type text not null,
  document_ref text not null,
  bucket text not null,
  required boolean default false,
  status text default 'pending',
  created_at timestamptz default now()
);
