-- V27 Stability and Refactor Foundation
-- These are backend design notes for production migration.

-- In production, client-side error diagnostics should be persisted to an app_error_logs table.
create table if not exists public.app_error_logs (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  user_id uuid,
  module_key text,
  route_key text,
  error_name text,
  error_message text,
  stack_trace text,
  component_stack text,
  user_agent text,
  metadata jsonb default '{}'::jsonb
);

-- Production recommendation:
-- 1. Never persist full business localStorage snapshots in production logs without redaction.
-- 2. Store safe diagnostic metadata only.
-- 3. Use RLS so only admin/support roles can view app_error_logs.
-- 4. Add server-side posting functions before real deployment.
