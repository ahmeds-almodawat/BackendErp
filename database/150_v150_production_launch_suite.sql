-- v150 production launch suite design mirror
-- These structures are intentionally backend-ready and should be reconciled with the supabase/migrations files before production deployment.

create table if not exists public.v150_launch_notes (
  id uuid primary key default gen_random_uuid(),
  company_id uuid,
  period_code text not null,
  readiness_score numeric,
  backend_score numeric,
  production_score numeric,
  notes text,
  created_at timestamptz default now()
);
