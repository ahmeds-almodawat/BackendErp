-- v34 validation drill-down design note
-- Future backend tables should support persisted validation issue rows per Foodics import batch.

create table if not exists public.foodics_validation_issues (
  id uuid primary key default gen_random_uuid(),
  batch_id uuid,
  issue_key text not null,
  severity text not null check (severity in ('good','warn','bad','info')),
  entity_ref text,
  entity_label text,
  details jsonb not null default '{}'::jsonb,
  resolved_at timestamptz,
  resolved_by uuid,
  created_at timestamptz not null default now()
);
