export type Tone = 'good' | 'warn' | 'bad' | 'info';

function arr<T = any>(value: T[] | undefined | null): T[] { return Array.isArray(value) ? value : []; }
function num(value: any): number { const n = Number(value); return Number.isFinite(n) ? n : 0; }
function sum(list: any[], picker: (row: any) => number) { return list.reduce((total, row) => total + picker(row), 0); }
export function pct(value: number) { return `${Math.round(value)}%`; }
export function money(value: number) { return new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(num(value)); }
export function downloadCsv(filename: string, rows: Record<string, any>[]) {
  const safeRows = Array.isArray(rows) ? rows : [];
  const headers = Array.from(new Set(safeRows.flatMap((row) => Object.keys(row || {}))));
  const csv = [headers.join(','), ...safeRows.map((row) => headers.map((header) => JSON.stringify(row?.[header] ?? '')).join(','))].join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}
function check(area: string, control: string, status: string, tone: Tone, evidence: string, next: string, owner = 'ERP Owner') { return { area, control, status, tone, evidence, next, owner }; }
function toneFromReady(ready: boolean, partial = false): Tone { return ready ? 'good' : partial ? 'warn' : 'bad'; }

export function buildV150Command(state: any, totals: any) {
  const branches = arr(state?.branches);
  const stores = arr(state?.stores);
  const items = arr(state?.items);
  const suppliers = arr(state?.suppliers);
  const accounts = arr(state?.chartAccounts);
  const journals = arr(state?.journals);
  const stockMovements = arr(state?.stockMovements);
  const fiscalPeriods = arr(state?.fiscalPeriods);
  const roles = arr(state?.roles);
  const permissions = arr(state?.permissions);
  const foodicsBatches = arr(state?.foodicsBatches);
  const employees = arr(state?.employees);
  const inventoryApprovals = arr(state?.inventoryApprovals);
  const recipeLines = arr(state?.recipeLines);
  const debit = sum(journals.flatMap((j: any) => arr(j.lines)), (line) => num(line.debit));
  const credit = sum(journals.flatMap((j: any) => arr(j.lines)), (line) => num(line.credit));
  const balanced = Math.abs(debit - credit) < 0.01;
  const negativeStock = stockMovements.reduce((map: Record<string, number>, m: any) => { const key = `${m.storeId || 'unknown'}::${m.itemId || 'unknown'}`; map[key] = (map[key] || 0) + (m.direction === 'in' ? num(m.qty) : -num(m.qty)); return map; }, {} as Record<string, number>);
  const negativeCount = (Object.values(negativeStock) as number[]).filter((v) => v < -0.0001).length;
  const zeroCostValue = stockMovements.filter((m: any) => num(m.qty) > 0 && num(m.unitCost) === 0).length;
  const compliantSuppliers = suppliers.filter((s: any) => s.vatNo && s.bankAccount && s.representativeName).length;
  const checks = [
    check('Backend', 'Supabase foundation', 'Scaffolded', 'warn', 'Migrations/functions exist, but frontend is not fully wired.', 'Wire Auth + setup tables first.', 'Technical Lead'),
    check('Auth', 'Real users and company tenancy', employees.length ? 'Local users only' : 'Missing users', employees.length ? 'warn' : 'bad', `${employees.length} employees in local state.`, 'Enable Supabase Auth and first-admin bootstrap.', 'Admin'),
    check('Master Data', 'Setup persistence', branches.length && stores.length && items.length ? 'Ready for sync' : 'Incomplete setup', toneFromReady(Boolean(branches.length && stores.length && items.length), true), `${branches.length} branches, ${stores.length} stores, ${items.length} items.`, 'Persist setup to Supabase with import staging.', 'Operations'),
    check('Foodics', 'Batch persistence and posting guard', foodicsBatches.length ? 'Local batch history exists' : 'No batches posted', foodicsBatches.length ? 'warn' : 'bad', `${foodicsBatches.length} local Foodics batches.`, 'Move batch files/rows to staging tables and Edge Function posting.', 'Sales Control'),
    check('Inventory', 'Stock movement control', stockMovements.length ? 'Ledger exists' : 'No stock ledger', stockMovements.length ? 'warn' : 'bad', `${stockMovements.length} stock movements; ${negativeCount} negative positions.`, 'Centralize weighted-average costing and stock reservation.', 'Inventory'),
    check('Inventory', 'Monthly count governance', inventoryApprovals.length ? 'Approval queue exists' : 'No variance queue', inventoryApprovals.length ? 'good' : 'warn', `${inventoryApprovals.length} inventory approvals.`, 'Persist count sheets and approvals with audit trail.', 'Inventory'),
    check('Finance', 'Journal integrity', balanced ? 'Balanced' : 'Unbalanced', balanced ? 'good' : 'bad', `Debit ${money(debit)} / Credit ${money(credit)}.`, 'Block posting through server-side guard if unbalanced.', 'Finance'),
    check('Finance', 'Fiscal periods', fiscalPeriods.length ? 'Period controls exist' : 'No periods', fiscalPeriods.length ? 'good' : 'bad', `${fiscalPeriods.length} fiscal periods.`, 'Enforce period lock in every Edge Function.', 'Finance'),
    check('Access', 'Permission catalogue', roles.length ? 'Roles exist' : 'No roles', roles.length ? 'warn' : 'bad', `${roles.length} roles and ${permissions.length} permissions.`, 'Enforce permissions server-side and log denied actions.', 'Admin'),
    check('Suppliers', 'Compliance fields', suppliers.length && compliantSuppliers === suppliers.length ? 'Clean' : 'Needs cleanup', suppliers.length && compliantSuppliers === suppliers.length ? 'good' : 'warn', `${compliantSuppliers}/${suppliers.length} suppliers have VAT/bank/representative.`, 'Require supplier compliance before payment approval.', 'Procurement'),
    check('Recipes', 'Recipe readiness', recipeLines.length ? 'Recipes exist' : 'Missing recipes', recipeLines.length ? 'good' : 'warn', `${recipeLines.length} recipe lines.`, 'Add recipe version approval and modifier handling.', 'Kitchen Control'),
    check('Reports', 'Board pack readiness', 'Designed', 'warn', 'Control/report factories exist as local dashboards.', 'Build backend report views and Excel/PDF exports.', 'CFO'),
  ];
  const blockers = checks.filter((row) => row.tone === 'bad');
  const warnings = checks.filter((row) => row.tone === 'warn');
  const backendScore = 62 + (foodicsBatches.length ? 3 : 0) + (fiscalPeriods.length ? 2 : 0) + (balanced ? 2 : 0);
  const productionScore = 58 + Math.max(0, 6 - blockers.length) + Math.min(6, checks.filter((c) => c.tone === 'good').length);
  return {
    scores: { local: 92, foundation: 85, enterprise: 90, production: Math.min(68, productionScore), backend: Math.min(72, backendScore) },
    checks,
    blockers,
    warnings,
    metrics: {
      branches: branches.length,
      stores: stores.length,
      items: items.length,
      suppliers: suppliers.length,
      accounts: accounts.length,
      journals: journals.length,
      stockMovements: stockMovements.length,
      foodicsBatches: foodicsBatches.length,
      inventoryApprovals: inventoryApprovals.length,
      inventoryValue: num(totals?.stockValue),
      sales: num(totals?.salesNet),
      ap: num(totals?.ap),
      netIncome: num(totals?.netIncome),
      negativePositions: negativeCount,
      zeroCostRows: zeroCostValue,
    },
  };
}

export function buildV150Program() { return [
  { version: 'v131', stream: 'Auth cutover', deliverable: 'Supabase Auth bootstrap, company profile, first-admin path.', status: 'Blueprint + skeleton', priority: 'Critical' },
  { version: 'v132', stream: 'Setup persistence', deliverable: 'Branches, stores, suppliers, items, COA and cost centers sync service.', status: 'Blueprint + skeleton', priority: 'Critical' },
  { version: 'v133', stream: 'Data staging', deliverable: 'CSV/XLSX-ready import staging, validation rows and duplicate keys.', status: 'Blueprint', priority: 'High' },
  { version: 'v134', stream: 'Foodics backend', deliverable: 'Foodics batch staging, mapping persistence, posting status and reversal ledger.', status: 'Blueprint + skeleton', priority: 'Critical' },
  { version: 'v135', stream: 'Inventory backend', deliverable: 'Opening stock, monthly counts, approvals, transfer lifecycle and costing queue.', status: 'Blueprint + skeleton', priority: 'Critical' },
  { version: 'v136', stream: 'Finance backend', deliverable: 'Journal posting, AP/AR, VAT, periods, bank reconciliation and subledgers.', status: 'Blueprint + skeleton', priority: 'Critical' },
  { version: 'v137', stream: 'Posting orchestrator', deliverable: 'Single Edge Function guard for inventory, finance, Foodics and production postings.', status: 'Skeleton added', priority: 'Critical' },
  { version: 'v138', stream: 'Approvals', deliverable: 'Maker-checker workflow, delegation, comments, audit and status lifecycle.', status: 'Skeleton added', priority: 'High' },
  { version: 'v139', stream: 'Attachments', deliverable: 'Storage buckets, document links, signed uploads and attachment policy.', status: 'Skeleton added', priority: 'High' },
  { version: 'v140', stream: 'Reporting views', deliverable: 'Branch P&L, inventory valuation, Foodics settlement and close snapshots.', status: 'Migration-ready', priority: 'High' },
  { version: 'v141', stream: 'Access enforcement', deliverable: 'Server-side permission checks, denied action logs and scope enforcement.', status: 'Migration-ready', priority: 'Critical' },
  { version: 'v142', stream: 'Backup and restore', deliverable: 'Export/import plan, storage backup and rollback controls.', status: 'Skeleton added', priority: 'Medium' },
  { version: 'v143', stream: 'QA automation', deliverable: 'Regression pack, RLS tests and posting guard tests.', status: 'Pack included', priority: 'High' },
  { version: 'v144', stream: 'UI enterprise polish', deliverable: 'Launch-grade UI checklist, forms/tables/timelines/attachments roadmap.', status: 'Roadmap', priority: 'Medium' },
  { version: 'v145', stream: 'Cutover pilot', deliverable: 'Pilot branch plan, freeze, migrate, validate, report-only, accounting-only, full-posting.', status: 'Plan included', priority: 'Critical' },
  { version: 'v146', stream: 'Foodics settlement', deliverable: 'Cash/MADA/delivery/internal settlement workbench specification.', status: 'Blueprint', priority: 'High' },
  { version: 'v147', stream: 'Inventory close', deliverable: 'Monthly inventory lock and close certificate specification.', status: 'Blueprint', priority: 'High' },
  { version: 'v148', stream: 'Finance close', deliverable: 'AP aging, AR aging, bank recon, VAT return and close certificate.', status: 'Blueprint', priority: 'High' },
  { version: 'v149', stream: 'Production traceability', deliverable: 'Raw lot to produced lot to final sale roadmap.', status: 'Roadmap', priority: 'Medium' },
  { version: 'v150', stream: 'Production launch suite', deliverable: 'All above combined into Enterprise v150 cockpit and backend launch artefacts.', status: 'Included', priority: 'Critical' },
]; }

export function buildV150BackendDomains() { return [
  { domain: 'Identity & tenancy', tables: 'companies, profiles, roles, permissions, user_roles, access_scopes', functions: 'auth-bootstrap, has-permission', rls: 'Company + scope + role policies', readiness: 'Migration-ready' },
  { domain: 'Master data', tables: 'branches, stores, bins, items, units, suppliers, cost_centers, chart_accounts', functions: 'setup-sync, import-staging', rls: 'Setup manage/view permissions', readiness: 'Migration-ready' },
  { domain: 'Foodics staging', tables: 'foodics_batches, order_headers, order_lines, payments, mappings, adjustments', functions: 'foodics-staging, foodics-post, foodics-reverse', rls: 'Foodics upload/post permissions', readiness: 'Migration-ready' },
  { domain: 'Inventory', tables: 'stock_movements, lots, counts, count_lines, transfers, approvals, quarantine', functions: 'inventory-posting, cost-rebuild, transfer-post', rls: 'Store-scope policies', readiness: 'Migration-ready' },
  { domain: 'Finance', tables: 'journal_entries, journal_lines, fiscal_periods, ap_ledger, ar_ledger, bank_recon', functions: 'finance-posting, close-period, bank-match', rls: 'Finance permission policies', readiness: 'Migration-ready' },
  { domain: 'Purchasing', tables: 'material_requests, purchase_orders, goods_receipts, supplier_invoices, payments', functions: 'po-approve, grn-post, invoice-match, payment-post', rls: 'Branch/supplier approval policies', readiness: 'Designed' },
  { domain: 'Approvals', tables: 'approval_workflows, approval_steps, approval_actions, delegations', functions: 'approval-workflow', rls: 'Approver visibility + action checks', readiness: 'Migration-ready' },
  { domain: 'Documents', tables: 'document_attachments, document_timelines, comments', functions: 'attachment-vault', rls: 'Document ownership + role policies', readiness: 'Migration-ready' },
  { domain: 'Audit', tables: 'audit_events, denied_actions, posting_events, import_events', functions: 'audit-write, guard-denied', rls: 'Read by audit/admin only', readiness: 'Migration-ready' },
  { domain: 'Reports', tables: 'close_snapshots, report_runs, materialized views', functions: 'report-pack-builder', rls: 'Report permissions', readiness: 'Designed' },
]; }

export function buildV150ApiContracts() { return [
  { endpoint: 'POST /functions/v1/auth-bootstrap', input: 'company, firstAdmin, language', output: 'company_id, profile_id, role_id', guard: 'first-user or service role only' },
  { endpoint: 'POST /functions/v1/setup-sync', input: 'entity, rows, upsertMode, importBatchId', output: 'created, updated, rejected, errors', guard: 'setup.manage + company scope' },
  { endpoint: 'POST /functions/v1/foodics-staging', input: 'batchName, files, rows, mappingProfile', output: 'batch_id, staged_rows, duplicate_keys, validation_summary', guard: 'foodics.batch.upload' },
  { endpoint: 'POST /functions/v1/posting-orchestrator', input: 'documentType, documentId, postingMode, approvalNote', output: 'journal_id, stock_movement_ids, audit_id, status', guard: 'permission + period + lifecycle + balance' },
  { endpoint: 'POST /functions/v1/approval-workflow', input: 'entityType, entityId, action, comment', output: 'next_status, approval_event', guard: 'approver permission + amount/scope' },
  { endpoint: 'POST /functions/v1/attachment-vault', input: 'documentType, documentId, filename, purpose', output: 'signed_upload_url, attachment_id', guard: 'document.attachment.upload' },
  { endpoint: 'POST /functions/v1/report-pack-builder', input: 'period, packType, filters', output: 'report_run_id, file_urls', guard: 'reports.export' },
  { endpoint: 'POST /functions/v1/backup-export', input: 'scope, period, includeAttachments', output: 'backup_manifest, storage_path', guard: 'admin.backup.export' },
]; }

export function buildV150PostingGuard() { return [
  { document: 'Foodics report-only batch', status: 'Allowed without recipes/costs', required: 'Batch staged + branch/payment mapping warnings reviewed', serverAction: 'foodics-staging only' },
  { document: 'Foodics sales-accounting batch', status: 'Requires approval', required: 'No duplicate batch, payment mappings, open period, sales posting permission', serverAction: 'posting-orchestrator:sales-accounting' },
  { document: 'Foodics full ERP batch', status: 'Strict', required: 'Recipes, stock, average cost, branch store, open period, approval', serverAction: 'posting-orchestrator:full-erp' },
  { document: 'Opening stock', status: 'Strict', required: 'Item/store exists or controlled auto-create, open period, inventory.post permission', serverAction: 'inventory-posting:opening-stock' },
  { document: 'Monthly stock count variance', status: 'Strict', required: 'Count sheet uploaded, variance approved, cost center, open inventory period', serverAction: 'inventory-posting:count-variance' },
  { document: 'Supplier payment', status: 'Strict', required: 'Invoice allocation, no overpayment unless advance, approval, open period', serverAction: 'finance-posting:supplier-payment' },
  { document: 'Manual journal', status: 'Strict', required: 'Debit = credit, approval, attachments if required, open period', serverAction: 'finance-posting:manual-journal' },
  { document: 'Production batch', status: 'Strict', required: 'Approved recipe, stock availability, output lot/expiry, open period', serverAction: 'inventory-posting:production' },
]; }

export function buildV150QaSuite() { return [
  { area: 'Build', test: 'Run npm install && npm run build.', expected: 'Build passes with no TypeScript/runtime errors.', priority: 'Critical' },
  { area: 'Empty state', test: 'Open every module with empty local state.', expected: 'No white page; safe empty states render.', priority: 'Critical' },
  { area: 'Setup', test: 'Import branches/stores/items/suppliers/COA sample files.', expected: 'No duplicates; startup sequence is clear.', priority: 'High' },
  { area: 'Foodics menu', test: 'Upload products, ingredients and modifiers exports.', expected: 'Menu items and recipe lines upsert by SKU.', priority: 'High' },
  { area: 'Foodics sales', test: 'Upload order headers, order lines and payments.', expected: 'File detection, validation and issue center work.', priority: 'High' },
  { area: 'Posting modes', test: 'Try report-only, sales accounting-only and full ERP posting.', expected: 'Starter mode allows accounting; full ERP blocks missing recipe/cost/stock.', priority: 'Critical' },
  { area: 'Inventory', test: 'Upload opening stock and monthly count sheet.', expected: 'Opening stock posts; stock count creates approval before variance posting.', priority: 'Critical' },
  { area: 'Finance', test: 'Create balanced and unbalanced manual journals.', expected: 'Balanced posts, unbalanced blocks.', priority: 'Critical' },
  { area: 'Permissions', test: 'Switch users/roles and attempt sensitive actions.', expected: 'Local guard warns; backend guard roadmap visible.', priority: 'High' },
  { area: 'Backend local', test: 'Run supabase start && supabase db reset.', expected: 'Migrations apply cleanly on local Supabase.', priority: 'Critical' },
  { area: 'RLS', test: 'Test storekeeper/finance/audit access with seed users.', expected: 'Only allowed company/scope rows visible.', priority: 'Critical' },
  { area: 'Attachments', test: 'Request signed upload for supplier invoice proof.', expected: 'Signed URL created and document link staged.', priority: 'Medium' },
  { area: 'Reports', test: 'Export readiness, backend, QA and report factory CSVs.', expected: 'Files export with period and current score.', priority: 'Medium' },
]; }

export function buildV150CutoverPlan() { return [
  { wave: '0', title: 'Local freeze', action: 'Freeze v150 package and sample data.', exit: 'QA suite green locally.' },
  { wave: '1', title: 'Supabase local', action: 'Apply migrations locally, seed permissions and sample company.', exit: 'RLS smoke tests pass.' },
  { wave: '2', title: 'Setup persistence', action: 'Wire setup pages to Supabase with local fallback.', exit: 'Branches/stores/items persist after refresh/login.' },
  { wave: '3', title: 'Foodics staging', action: 'Move uploaded Foodics rows to staging tables.', exit: 'Duplicate protection and mapping profiles persist.' },
  { wave: '4', title: 'Posting orchestrator', action: 'Move Foodics, inventory count and journal posting to Edge Functions.', exit: 'Frontend cannot bypass posting guard.' },
  { wave: '5', title: 'Finance pilot', action: 'Run sales-accounting-only for one branch.', exit: 'Sales/VAT/payment reconciliation reviewed daily.' },
  { wave: '6', title: 'Inventory pilot', action: 'Run opening stock, monthly count and variance approvals.', exit: 'Inventory value and GL reconciliation reviewed.' },
  { wave: '7', title: 'Full ERP pilot', action: 'Activate recipes/COGS for selected menu category.', exit: 'Theoretical vs actual report reviewed.' },
  { wave: '8', title: 'Go-live', action: 'Lock old data, migrate final balances, enable production posting.', exit: 'Close certificate signed for first period.' },
]; }

export function buildV150Scores() { return [
  { view: 'Local MVP / prototype', score: '9.3 / 10', note: 'Excellent for local workflow testing and executive demonstration.' },
  { view: 'Serious ERP foundation', score: '8.6 / 10', note: 'Strong connected architecture across Foodics, inventory, finance, purchasing and close controls.' },
  { view: 'Enterprise design direction', score: '9.0 / 10', note: 'Backend, approvals, postings, controls, reports and cutover are now clearly designed.' },
  { view: 'Production readiness', score: '6.1 / 10', note: 'Improving with backend artefacts, but still needs real frontend-to-Supabase wiring and QA.' },
  { view: 'Backend/security readiness', score: '6.7 / 10', note: 'Migrations, RLS, functions and API contracts are much deeper; implementation wiring is next.' },
]; }
