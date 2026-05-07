-- v308 Modular Core Split backend contract
create table if not exists public.module_registry_contracts (
  module_key text primary key,
  route_owner text not null,
  backend_tables text[] not null default '{}',
  permission_keys text[] not null default '{}',
  engine_dependencies text[] not null default '{}',
  import_export_responsibilities text[] not null default '{}',
  risk_level text not null default 'medium' check (risk_level in ('low','medium','high','critical')),
  backend_cutover_tasks text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

insert into public.module_registry_contracts (module_key, route_owner, backend_tables, permission_keys, engine_dependencies, import_export_responsibilities, risk_level, backend_cutover_tasks) values
('analytics','Smart Analysis / Reports', array['report_import_registrations','smart_analysis_views','custom_kpi_definitions'], array['dashboard.view','reports.view','reports.export','analytics.manage'], array['comparisonEngine','reportStudioEngine','dataQualityEngine'], array['CSV drilldowns','comparison exports','report pack registration'], 'high', array['Persist views','Validate KPI formulas','Protect report exports']),
('finance','Finance', array['journals','journal_lines','finance_posting_batches','finance_posting_batch_lines'], array['finance.view','finance.journal.post','finance.statements.view'], array['financeTruthLayer','postingGuardEngine','accountingEngine'], array['posting contracts','ledger reconciliation','import mapping'], 'critical', array['Block unbalanced postings','Enforce batch validation','Reconcile subledgers']),
('inventory','Inventory', array['items','stock_movements','inventory_lots','inventory_approvals'], array['inventory.view','inventory.adjustment.approve'], array['inventoryCostingEngine','dataQualityEngine'], array['stock count','opening stock','valuation import'], 'critical', array['Lock cost','Validate negative stock','Post approved variances']),
('purchasing','Purchasing', array['suppliers','purchase_orders','goods_receipts','purchase_invoices','supplier_payments'], array['purchasing.invoice.post','purchasing.payment.post'], array['postingGuardEngine','documentLifecycleEngine'], array['invoice imports','payment exports'], 'high', array['Three-way match','AP approval','Post to finance truth layer']),
('production','Production / Prep', array['production_recipes','production_batches','recipe_lines'], array['production.batch.post','production.recipe.manage'], array['inventoryCostingEngine','postingGuardEngine'], array['recipe templates','variance exports'], 'high', array['Version recipes','Capture wastage','Post WIP output']),
('sales','Sales / POS', array['sales_batches','sales_lines','payments','menu_items'], array['sales.post','pos.shift.open'], array['reportImportCenterService','postingGuardEngine'], array['Foodics report imports','payment reconciliation'], 'critical', array['Import closed batches','Match payments','Post VAT and COGS']),
('hr','HR & Attendance', array['employees','attendance_logs','shift_schedules'], array['hr.employee.manage','hr.attendance.punch_own'], array['permissionEngine'], array['employee import/export'], 'medium', array['Protect salary','Link users','Branch scope']),
('setup','Setup', array['branches','stores','items','menu_items','categories','cost_centers'], array['settings.master.manage'], array['dataQualityEngine'], array['master data templates','category library'], 'high', array['Unique codes','Require categories','Audit inactive records']),
('access','Access Control / Users', array['roles','role_permissions','user_access','user_accounts','audit_logs'], array['access.manage','access.user.create','access.user.manage'], array['permissionEngine'], array['authority matrix export','access audit'], 'critical', array['Harden RLS','Test custom roles','Audit permission changes'])
on conflict (module_key) do update set route_owner = excluded.route_owner, backend_tables = excluded.backend_tables, permission_keys = excluded.permission_keys, engine_dependencies = excluded.engine_dependencies, import_export_responsibilities = excluded.import_export_responsibilities, risk_level = excluded.risk_level, backend_cutover_tasks = excluded.backend_cutover_tasks, updated_at = now();

alter table public.module_registry_contracts enable row level security;
do $$ begin
  if not exists (select 1 from pg_policies where schemaname = split_part('public.module_registry_contracts', '.', 1) and tablename = split_part('public.module_registry_contracts', '.', 2) and policyname = 'module_registry_contracts_authenticated_read') then
    create policy module_registry_contracts_authenticated_read on public.module_registry_contracts for select to authenticated using (true);
  end if;
end $$;
