-- v20 Connected Control Layer design notes
-- Purpose: make trial workflows behave like an auditable ERP control layer before Supabase production.
-- This is a backend-ready sketch; local MVP keeps the logic in React/localStorage.

create table if not exists public.document_lifecycle_events (
  id uuid primary key default gen_random_uuid(),
  company_id uuid,
  module text not null,
  document_type text not null,
  document_ref text not null,
  old_status text,
  new_status text not null,
  action text not null,
  actor_id uuid,
  action_at timestamptz not null default now(),
  notes text
);

create table if not exists public.posting_control_checks (
  id uuid primary key default gen_random_uuid(),
  check_key text not null unique,
  area text not null,
  severity text not null check (severity in ('info','warning','critical')),
  enabled boolean not null default true,
  description_en text not null,
  description_ar text not null
);

create table if not exists public.import_governance_profiles (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  import_type text not null,
  file_type text not null check (file_type in ('csv','xlsx')),
  duplicate_key text not null,
  requires_approval boolean not null default true,
  mapping jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.document_attachments (
  id uuid primary key default gen_random_uuid(),
  module text not null,
  document_type text not null,
  document_ref text not null,
  file_name text not null,
  storage_path text not null,
  uploaded_by uuid,
  uploaded_at timestamptz not null default now()
);
