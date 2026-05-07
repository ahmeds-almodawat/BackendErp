-- v130 reporting views and cutover snapshots.
create or replace view public.v_backend_cutover_latest as
select r.*
from public.backend_cutover_runs r
join (
  select period_code, max(created_at) as created_at
  from public.backend_cutover_runs
  group by period_code
) latest on latest.period_code = r.period_code and latest.created_at = r.created_at;

create or replace view public.v_import_staging_summary as
select source_system, import_type, status, count(*) as batches, sum(row_count) as rows, sum(error_count) as errors, sum(warning_count) as warnings
from public.import_staging_batches
group by source_system, import_type, status;

create or replace view public.v_api_contract_readiness as
select lifecycle_status, count(*) as contract_count
from public.api_contract_registry
group by lifecycle_status;
