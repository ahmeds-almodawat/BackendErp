-- v130 RLS and permission expansion.
alter table if exists public.backend_cutover_runs enable row level security;
alter table if exists public.backend_cutover_tasks enable row level security;
alter table if exists public.api_contract_registry enable row level security;
alter table if exists public.import_staging_batches enable row level security;
alter table if exists public.import_staging_rows enable row level security;
alter table if exists public.posting_guard_results enable row level security;

drop policy if exists "backend cutover read authenticated" on public.backend_cutover_runs;
create policy "backend cutover read authenticated" on public.backend_cutover_runs for select to authenticated using (true);
drop policy if exists "backend cutover manage authenticated" on public.backend_cutover_runs;
create policy "backend cutover manage authenticated" on public.backend_cutover_runs for all to authenticated using (true) with check (true);
drop policy if exists "backend tasks read authenticated" on public.backend_cutover_tasks;
create policy "backend tasks read authenticated" on public.backend_cutover_tasks for select to authenticated using (true);
drop policy if exists "backend tasks manage authenticated" on public.backend_cutover_tasks;
create policy "backend tasks manage authenticated" on public.backend_cutover_tasks for all to authenticated using (true) with check (true);
drop policy if exists "api contracts read authenticated" on public.api_contract_registry;
create policy "api contracts read authenticated" on public.api_contract_registry for select to authenticated using (true);
drop policy if exists "api contracts manage authenticated" on public.api_contract_registry;
create policy "api contracts manage authenticated" on public.api_contract_registry for all to authenticated using (true) with check (true);
drop policy if exists "import batches read authenticated" on public.import_staging_batches;
create policy "import batches read authenticated" on public.import_staging_batches for select to authenticated using (true);
drop policy if exists "import batches manage authenticated" on public.import_staging_batches;
create policy "import batches manage authenticated" on public.import_staging_batches for all to authenticated using (true) with check (true);
drop policy if exists "import rows read authenticated" on public.import_staging_rows;
create policy "import rows read authenticated" on public.import_staging_rows for select to authenticated using (true);
drop policy if exists "import rows manage authenticated" on public.import_staging_rows;
create policy "import rows manage authenticated" on public.import_staging_rows for all to authenticated using (true) with check (true);
drop policy if exists "posting guard read authenticated" on public.posting_guard_results;
create policy "posting guard read authenticated" on public.posting_guard_results for select to authenticated using (true);
drop policy if exists "posting guard insert authenticated" on public.posting_guard_results;
create policy "posting guard insert authenticated" on public.posting_guard_results for insert to authenticated with check (true);

insert into public.api_contract_registry(function_name, endpoint, required_permission, required_scope, payload_schema, response_schema, lifecycle_status)
values
('master-data-sync', '/functions/v1/master-data-sync', 'setup.manage', 'company', '{"entity":"string","rows":"array","mode":"upsert|validate"}', '{"upserted":"number","errors":"array"}', 'ready'),
('foodics-post', '/functions/v1/foodics-post', 'foodics.batch.post', 'branch', '{"batchId":"uuid","postingMode":"string"}', '{"journals":"array","movements":"array","audit":"object"}', 'ready'),
('inventory-posting', '/functions/v1/inventory-posting', 'inventory.post', 'store', '{"documentType":"string","lines":"array"}', '{"stockMovements":"array","journal":"object"}', 'ready'),
('finance-posting', '/functions/v1/finance-posting', 'finance.journal.post', 'company', '{"journal":"object"}', '{"journalId":"uuid","status":"posted"}', 'ready'),
('attachment-signer', '/functions/v1/attachment-signer', 'document.attachment.upload', 'document', '{"documentType":"string","documentId":"uuid","filename":"string"}', '{"uploadUrl":"string"}', 'ready'),
('report-pack-builder', '/functions/v1/report-pack-builder', 'reports.export', 'company', '{"period":"string","pack":"string"}', '{"artifactUrls":"array"}', 'draft')
on conflict (function_name) do update set endpoint=excluded.endpoint, required_permission=excluded.required_permission, required_scope=excluded.required_scope, lifecycle_status=excluded.lifecycle_status;
