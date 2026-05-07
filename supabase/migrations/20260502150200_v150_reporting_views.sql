-- v150 reporting view placeholders

create or replace view public.v150_close_readiness_view as
select
  company_id,
  period_code,
  close_type,
  status,
  metrics,
  checklist,
  created_at
from public.close_snapshots;

create or replace view public.v150_import_batch_summary_view as
select
  b.company_id,
  b.id as batch_id,
  b.import_type,
  b.source_system,
  b.status,
  count(r.id) as row_count,
  count(*) filter (where r.status = 'error') as error_count,
  count(*) filter (where r.status = 'warning') as warning_count,
  b.created_at
from public.import_batches b
left join public.import_batch_rows r on r.batch_id = b.id
group by b.company_id, b.id, b.import_type, b.source_system, b.status, b.created_at;
