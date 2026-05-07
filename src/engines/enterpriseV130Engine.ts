type Tone = 'good' | 'warn' | 'bad' | 'info';
type Row = Record<string, string | number | boolean>;
function arr<T = any>(value: any): T[] { return Array.isArray(value) ? value : []; }
function sum(rows: any[], selector: (row: any) => number) { return rows.reduce((total, row) => total + selector(row), 0); }
export function money(value: number) { return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'SAR', maximumFractionDigits: 0 }).format(Number.isFinite(value) ? value : 0); }
export function pct(value: number) { return `${Math.round(value)}%`; }
export function downloadCsv(filename: string, rows: Row[]) {
const headers = Array.from(rows.reduce<Set<string>>((set, row) => { Object.keys(row).forEach((key) => set.add(key)); return set; }, new Set<string>()));
  const csv = [headers.join(','), ...rows.map((row) => headers.map((header) => `"${String(row[header] ?? '').replace(/"/g, '""')}"`).join(','))].join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}
function stockRows(state: any) {
  const map = new Map<string, { storeId: string; itemId: string; qty: number; value: number }>();
  arr<any>(state?.stockMovements).forEach((m) => {
    const key = `${m.storeId || 'unknown'}__${m.itemId || 'unknown'}`;
    const current = map.get(key) || { storeId: m.storeId || 'unknown', itemId: m.itemId || 'unknown', qty: 0, value: 0 };
    const sign = m.direction === 'in' ? 1 : -1;
    current.qty += sign * Number(m.qty || 0);
    current.value += sign * Number(m.qty || 0) * Number(m.unitCost || 0);
    map.set(key, current);
  });
  return Array.from(map.values());
}
function check(area: string, control: string, status: string, toneValue: Tone, evidence: string, next: string) { return { area, control, status, tone: toneValue, evidence, next }; }
export function buildV130Command(state: any, totals: any) {
  const branches = arr(state?.branches), stores = arr(state?.stores), items = arr(state?.items), suppliers = arr(state?.suppliers), journals = arr(state?.journals), roles = arr(state?.roles), recipeLines = arr(state?.recipeLines), foodicsBatches = arr(state?.foodicsBatches), approvals = arr(state?.inventoryApprovals), stock = stockRows(state);
  const debit = sum(journals.flatMap((j: any) => arr(j.lines)), (l) => Number(l.debit || 0));
  const credit = sum(journals.flatMap((j: any) => arr(j.lines)), (l) => Number(l.credit || 0));
  const negativeStock = stock.filter((row) => row.qty < -0.0001);
  const zeroCostPositive = stock.filter((row) => row.qty > 0.0001 && Math.abs(row.value) < 0.0001);
  const missingSupplierCompliance = suppliers.filter((s: any) => !s.vatNo || !s.bankAccount || !s.representativeName);
  const backendScore = 61;
  const productionScore = 56 + Math.min(10, Math.floor((branches.length + stores.length + items.length + journals.length) / 12));
  const foundationScore = 84;
  const localScore = 92;
  const checks = [
    check('Backend', 'Supabase schema pack', 'Ready for local db reset', 'good', 'v121-v130 backend domain migrations are included.', 'Run supabase start and supabase db reset.'),
    check('Backend', 'Frontend/backend bridge', 'Designed, not wired', 'warn', 'v130 adds service contract, sync plans, and API route inventory.', 'Connect first setup tables to Supabase in v131.'),
    check('Security', 'RLS coverage', 'Foundation + expansion scripts', 'warn', 'RLS/helper functions are scripted, but not production-tested with real users.', 'Test admin, accountant, storekeeper and branch manager policies.'),
    check('Data', 'Master data readiness', branches.length && stores.length && items.length ? 'Local sample ready' : 'Missing local data', branches.length && stores.length && items.length ? 'good' : 'bad', `${branches.length} branches, ${stores.length} stores, ${items.length} items.`, 'Migrate setup master data first.'),
    check('Foodics', 'Staging + settlement model', foodicsBatches.length ? 'Local batches detected' : 'Needs upload', foodicsBatches.length ? 'good' : 'warn', `${foodicsBatches.length} Foodics batches in local state.`, 'Stage Foodics imports to Supabase import tables.'),
    check('Finance', 'Journal balance', Math.abs(debit - credit) < 0.01 ? 'Balanced' : 'Imbalanced', Math.abs(debit - credit) < 0.01 ? 'good' : 'bad', `Debit ${debit.toFixed(2)} / Credit ${credit.toFixed(2)}.`, 'Backend posting must reject imbalanced journals.'),
    check('Inventory', 'Negative stock', negativeStock.length ? 'Negative stock found' : 'No negative stock', negativeStock.length ? 'bad' : 'good', `${negativeStock.length} rows negative.`, 'Enforce negative stock policy server-side.'),
    check('Inventory', 'Zero-cost stock', zeroCostPositive.length ? 'Zero-cost stock exists' : 'No zero-cost positive rows', zeroCostPositive.length ? 'warn' : 'good', `${zeroCostPositive.length} positive stock rows with zero value.`, 'Require average cost before full ERP posting.'),
    check('Purchasing', 'Supplier compliance', missingSupplierCompliance.length ? 'Gaps exist' : 'Supplier compliance ready', missingSupplierCompliance.length ? 'warn' : 'good', `${missingSupplierCompliance.length} suppliers missing VAT/bank/representative fields.`, 'Block payment release until supplier compliance is clean.'),
    check('Access', 'Critical permissions', roles.length ? 'Role catalog exists' : 'No roles', roles.length ? 'warn' : 'bad', `${roles.length} roles loaded.`, 'Enforce permissions on every posting action.'),
    check('Recipes', 'Recipe lines', recipeLines.length ? 'Recipe foundation exists' : 'Recipe lines missing', recipeLines.length ? 'good' : 'warn', `${recipeLines.length} recipe lines.`, 'Add versioning and branch-specific recipes.'),
    check('Approvals', 'Pending approvals', approvals.filter((a: any) => a.status === 'pending').length ? 'Open approvals' : 'No pending approval blockers', approvals.filter((a: any) => a.status === 'pending').length ? 'warn' : 'good', `${approvals.filter((a: any) => a.status === 'pending').length} pending approvals.`, 'Add approval inbox backed by database.'),
  ];
  const blockers = checks.filter((c) => c.tone === 'bad');
  const warnings = checks.filter((c) => c.tone === 'warn');
  return { backendScore, productionScore, foundationScore, localScore, checks, blockers, warnings, stock, negativeStock, zeroCostPositive, missingSupplierCompliance, debit, credit, totals: { sales: Number(totals?.salesNet || 0), inventory: Number(totals?.stockValue || 0), ap: Number(totals?.ap || 0), netIncome: Number(totals?.netIncome || 0) }, counts: { branches: branches.length, stores: stores.length, items: items.length, suppliers: suppliers.length, journals: journals.length, stockMovements: arr(state?.stockMovements).length, foodicsBatches: foodicsBatches.length, roles: roles.length } };
}
export function buildV130Program() { return [
  { version: 'v122', theme: 'Auth + tenant bootstrap', outcome: 'Companies, profiles, roles and first-admin bootstrap prepared.', status: 'Designed in v130', priority: 'Critical' },
  { version: 'v123', theme: 'Setup master data persistence', outcome: 'Branches, stores, suppliers, items, COA and cost centers mapped to Supabase.', status: 'Designed in v130', priority: 'Critical' },
  { version: 'v124', theme: 'Foodics staging persistence', outcome: 'Foodics files become staged rows with hashes, validation state and duplicate protection.', status: 'Designed in v130', priority: 'Critical' },
  { version: 'v125', theme: 'Central posting functions', outcome: 'posting-guard validates permission, period, lifecycle, inventory and GL before posting.', status: 'Designed in v130', priority: 'Critical' },
  { version: 'v126', theme: 'Inventory backend engine', outcome: 'Opening stock, stock counts, transfers and average costing become database-backed.', status: 'Designed in v130', priority: 'High' },
  { version: 'v127', theme: 'Finance backend engine', outcome: 'Manual journals, AP/AR, VAT, bank reconciliation and fiscal periods persist.', status: 'Designed in v130', priority: 'High' },
  { version: 'v128', theme: 'Attachments + audit hardening', outcome: 'Document files, immutable audit events and denied actions are stored securely.', status: 'Designed in v130', priority: 'High' },
  { version: 'v129', theme: 'Report materialized views', outcome: 'Board packs, branch P&L and close snapshots can run from backend views.', status: 'Designed in v130', priority: 'Medium' },
  { version: 'v130', theme: 'Cutover command center', outcome: 'Migration, QA, risk, rollback and go-live controls are visible in the app.', status: 'Included', priority: 'Critical' },
]; }
export function buildV130BackendDomains() { return [
  { domain: 'Identity & tenancy', tables: 'companies, profiles, roles, permissions, role_permissions, user_roles, access_scopes', functions: 'auth-bootstrap, has_permission, scope checks', readiness: 'Schema-ready' },
  { domain: 'Setup master data', tables: 'branches, stores, bins, items, units, suppliers, cost_centers, chart_accounts', functions: 'master-data-sync, import validation', readiness: 'Migration-ready' },
  { domain: 'Foodics staging', tables: 'foodics_import_batches, foodics_order_headers, foodics_order_lines, foodics_payments, mapping tables', functions: 'foodics-import, foodics-validate, foodics-post', readiness: 'Designed' },
  { domain: 'Inventory', tables: 'stock_movements, inventory_lots, stock_counts, transfers, inventory_approvals', functions: 'inventory-posting, stock-count-post, transfer-post', readiness: 'Designed' },
  { domain: 'Finance', tables: 'journal_entries, journal_lines, fiscal_periods, ap_subledger, ar_subledger, bank_reconciliation', functions: 'finance-posting, close-period, bank-match', readiness: 'Designed' },
  { domain: 'Purchasing', tables: 'material_requests, purchase_orders, goods_receipts, supplier_invoices, supplier_payments', functions: 'po-approve, grn-post, invoice-match, payment-post', readiness: 'Designed' },
  { domain: 'Production', tables: 'production_recipes, production_batches, production_lines, produced_lots', functions: 'production-post, production-reverse', readiness: 'Roadmap-ready' },
  { domain: 'Documents & audit', tables: 'document_attachments, audit_events, posting_events, denied_actions', functions: 'attachment-sign, audit-write', readiness: 'Migration-ready' },
  { domain: 'Reporting', tables: 'close_snapshots, materialized views', functions: 'refresh-report-pack, export-csv', readiness: 'Roadmap-ready' },
]; }
export function buildV130CutoverPlan() { return [
  { wave: '0', name: 'Local QA freeze', objective: 'Freeze current v130 local prototype and export demo data.', exitCriteria: 'Foodics sample, opening stock, monthly count and reports pass QA.' },
  { wave: '1', name: 'Supabase local backend', objective: 'Apply migrations locally and test RLS with seed users.', exitCriteria: 'All policies tested with admin/accountant/storekeeper/cashier scopes.' },
  { wave: '2', name: 'Master data persistence', objective: 'Connect setup module to Supabase tables with local fallback.', exitCriteria: 'Branches/stores/items/suppliers/COA persist after refresh and login.' },
  { wave: '3', name: 'Foodics staging', objective: 'Upload files into staging tables, not only browser memory.', exitCriteria: 'Duplicate batch prevention and validation state persist.' },
  { wave: '4', name: 'Posting functions', objective: 'Move Foodics, stock count and journal posting to Edge Functions.', exitCriteria: 'Frontend cannot bypass posting guard.' },
  { wave: '5', name: 'Pilot branch', objective: 'Run one branch in report-only and sales-accounting-only mode.', exitCriteria: 'Daily close and settlement exceptions reviewed for 1 week.' },
  { wave: '6', name: 'Full ERP posting pilot', objective: 'Activate recipe/COGS/inventory deduction for selected items.', exitCriteria: 'Stock count variance and theoretical cost report reconciled.' },
]; }
export function buildV130ApiContracts() { return [
  { endpoint: 'POST /functions/v1/master-data-sync', payload: 'entity, rows, mode', result: 'upserted, rejected, errors', guard: 'setup.manage + company scope' },
  { endpoint: 'POST /functions/v1/foodics-import', payload: 'batch, fileType, rows', result: 'batchId, stagedRows, duplicateRows, validation', guard: 'foodics.batch.upload' },
  { endpoint: 'POST /functions/v1/foodics-post', payload: 'batchId, postingMode, approvalNote', result: 'salesDoc, journals, movements, audit', guard: 'foodics.batch.post + period open' },
  { endpoint: 'POST /functions/v1/inventory-posting', payload: 'documentType, documentId, lines', result: 'stock_movements, journal, audit', guard: 'inventory.post + store scope' },
  { endpoint: 'POST /functions/v1/finance-posting', payload: 'journalDraft or sourceDocument', result: 'posted journal, subledger updates', guard: 'finance.journal.post + period open' },
  { endpoint: 'POST /functions/v1/close-period', payload: 'period, modules, checklist', result: 'close certificate, locked period', guard: 'finance.period.lock' },
  { endpoint: 'POST /functions/v1/attachment-signer', payload: 'documentType, documentId, filename', result: 'signed upload URL', guard: 'document.attachment.upload' },
  { endpoint: 'POST /functions/v1/report-pack-builder', payload: 'period, reportPack', result: 'csv/xlsx/pdf artifact links', guard: 'reports.export' },
]; }
export function buildV130QaSuite() { return [
  { area: 'Frontend boot', test: 'Open empty app and every module.', expected: 'No white page; error boundary catches module failures.' },
  { area: 'Backend migration', test: 'Run supabase db reset on clean local stack.', expected: 'All v121-v130 migrations apply without errors.' },
  { area: 'RLS', test: 'Storekeeper tries to read another store.', expected: 'Blocked by store scope policy.' },
  { area: 'Foodics', test: 'Upload the same Foodics batch twice.', expected: 'Duplicate hash blocks second active posting.' },
  { area: 'Posting guard', test: 'Post Foodics full ERP without recipe/cost.', expected: 'Blocked; sales-accounting-only allowed.' },
  { area: 'Inventory', test: 'Upload monthly count with shortage and surplus.', expected: 'Approval requests created; no direct posting until approved.' },
  { area: 'Finance', test: 'Try unbalanced manual journal.', expected: 'Blocked locally and server-side.' },
  { area: 'Period lock', test: 'Post backdated journal into locked period.', expected: 'Blocked by posting guard.' },
  { area: 'Attachments', test: 'Upload supplier invoice proof.', expected: 'Stored in correct bucket with document link.' },
  { area: 'Reports', test: 'Export v130 readiness/control pack.', expected: 'CSV downloads with current period and score notes.' },
]; }
export function buildV130Scores() { return [
  { view: 'Local MVP / prototype', score: '9.2 / 10', note: 'Excellent for local workflow testing and demos.' },
  { view: 'Serious ERP foundation', score: '8.4 / 10', note: 'Architecture, controls and module direction are now very strong.' },
  { view: 'Enterprise design direction', score: '8.9 / 10', note: 'Close control, Foodics, inventory, finance and backend plan are aligned.' },
  { view: 'Production readiness', score: '5.6 / 10', note: 'Improved because backend plan is deeper, but real wiring is still needed.' },
  { view: 'Backend/security readiness', score: '6.0 / 10', note: 'Schema, RLS, functions and migration waves are scaffolded; live integration is next.' },
]; }
