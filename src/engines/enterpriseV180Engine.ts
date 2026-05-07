export type ScoreRow = { view: string; score: string; note: string };
export type ControlRow = { area: string; control: string; status: string; tone: 'good' | 'warn' | 'bad' | 'info'; evidence: string; next: string };
export type RoadmapRow = { version: string; stream: string; deliverable: string; status: string; priority: string };
export type ContractRow = { endpoint: string; purpose: string; input: string; output: string; guard: string };
export type BackendModeRow = { layer: string; localMode: string; supabaseMode: string; cutoverRule: string; readiness: string };

function arr<T>(value: T[] | undefined): T[] { return Array.isArray(value) ? value : []; }
function sum<T>(rows: T[], fn: (row: T) => number): number { return rows.reduce((total, row) => total + (Number(fn(row)) || 0), 0); }
function isoToday(): string { return new Date().toISOString().slice(0, 10); }

export function money(value: number): string { return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'SAR', maximumFractionDigits: 0 }).format(Number(value || 0)); }
export function pct(value: number): string { return `${Math.round(Number(value || 0))}%`; }
export function rowsToCsv(rows: Array<Record<string, unknown>>): string {
  if (!rows.length) return '';
  const headers = Object.keys(rows[0]);
  const esc = (value: unknown) => {
    const text = String(value ?? '');
    return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
  };
  return [headers.join(','), ...rows.map((row) => headers.map((h) => esc(row[h])).join(','))].join('\n');
}
export function downloadCsv(fileName: string, rows: Array<Record<string, unknown>>): void {
  const blob = new Blob([rowsToCsv(rows)], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  a.click();
  URL.revokeObjectURL(url);
}

export function buildV180Scores(): ScoreRow[] {
  return [
    { view: 'Local MVP / prototype', score: '9.4 / 10', note: 'Excellent for end-to-end local trials, Foodics testing, inventory counts and executive demonstration.' },
    { view: 'Serious ERP foundation', score: '8.8 / 10', note: 'Strong architecture across Foodics, inventory, finance, procurement, close controls and backend contracts.' },
    { view: 'Enterprise design direction', score: '9.2 / 10', note: 'Production wiring, posting guard, approvals, attachments, reports and cutover controls are now clearly organized.' },
    { view: 'Production readiness', score: '6.5 / 10', note: 'Improved by wiring foundations, but real Auth/RLS/Edge Function execution and multi-user QA remain next.' },
    { view: 'Backend/security readiness', score: '7.0 / 10', note: 'Backend domains, API contracts, migrations, storage and guard design are deep enough to start real wiring.' },
  ];
}

export function buildV180Command(state: any, totals: any) {
  const branches = arr<any>(state?.branches);
  const stores = arr<any>(state?.stores);
  const items = arr<any>(state?.items);
  const suppliers = arr<any>(state?.suppliers);
  const journals = arr<any>(state?.journals);
  const movements = arr<any>(state?.stockMovements);
  const foodicsProfiles = arr<any>(state?.importProfiles).filter((p) => String(p.importType || '').toLowerCase().includes('foodics'));
  const postedDebit = sum(journals.flatMap((j) => arr<any>(j.lines)), (l) => l.debit);
  const postedCredit = sum(journals.flatMap((j) => arr<any>(j.lines)), (l) => l.credit);
  const duplicateSkus = new Set<string>();
  const seenSkus = new Set<string>();
  items.forEach((item) => { const sku = String(item.sku || '').trim().toLowerCase(); if (!sku) return; if (seenSkus.has(sku)) duplicateSkus.add(sku); seenSkus.add(sku); });
  const missingSupplierCompliance = suppliers.filter((s) => !s.vatNo || !s.bankName || !s.bankAccount || !s.representativeName).length;
  const zeroCostMovements = movements.filter((m) => m.direction === 'in' && Number(m.unitCost || 0) <= 0).length;
  const controls: ControlRow[] = [
    { area: 'Backend mode', control: 'Local/Supabase mode split', status: 'Foundation added', tone: 'good', evidence: 'v180 adds backend bridge plan, mode indicators and cutover package.', next: 'Wire setup pages to Supabase with fallback.' },
    { area: 'Master data', control: 'Setup persistence readiness', status: branches.length && stores.length && items.length ? 'Ready for sync' : 'Needs setup data', tone: branches.length && stores.length && items.length ? 'good' : 'warn', evidence: `${branches.length} branches, ${stores.length} stores, ${items.length} items`, next: 'Run setup import or load trial data before backend sync.' },
    { area: 'Data quality', control: 'Duplicate SKU protection', status: duplicateSkus.size ? 'Blocker' : 'Clean', tone: duplicateSkus.size ? 'bad' : 'good', evidence: `${duplicateSkus.size} duplicate SKU(s)`, next: duplicateSkus.size ? 'Resolve duplicate item SKUs before backend cutover.' : 'Keep unique index in Supabase.' },
    { area: 'Suppliers', control: 'Supplier compliance fields', status: missingSupplierCompliance ? 'Warning' : 'Ready', tone: missingSupplierCompliance ? 'warn' : 'good', evidence: `${missingSupplierCompliance} supplier(s) missing VAT/bank/representative data`, next: 'Complete supplier VAT, bank and representative fields.' },
    { area: 'Foodics', control: 'Foodics import profile', status: foodicsProfiles.length ? 'Profile available' : 'Needs profile', tone: foodicsProfiles.length ? 'good' : 'warn', evidence: `${foodicsProfiles.length} Foodics profile(s)`, next: 'Seed Foodics native mapping profile in backend.' },
    { area: 'Finance', control: 'Journal balance health', status: Math.abs(postedDebit - postedCredit) < 0.01 ? 'Balanced' : 'Blocker', tone: Math.abs(postedDebit - postedCredit) < 0.01 ? 'good' : 'bad', evidence: `Debit ${postedDebit.toFixed(2)} / Credit ${postedCredit.toFixed(2)}`, next: 'Block posting if journals are unbalanced.' },
    { area: 'Inventory', control: 'Zero-cost receipts', status: zeroCostMovements ? 'Warning' : 'Ready', tone: zeroCostMovements ? 'warn' : 'good', evidence: `${zeroCostMovements} receipt movement(s) with zero cost`, next: 'Use purchase/opening stock with cost before full ERP COGS posting.' },
    { area: 'Attachments', control: 'Document vault', status: 'Designed', tone: 'warn', evidence: 'Storage buckets and attachment-vault functions are scaffolded.', next: 'Connect document upload buttons to Supabase Storage.' },
    { area: 'Approvals', control: 'Maker-checker', status: 'Designed', tone: 'warn', evidence: 'Approval workflow tables/functions are scaffolded.', next: 'Enforce approval on posting actions.' },
    { area: 'Cutover', control: 'Pilot readiness', status: 'Pilot path defined', tone: 'good', evidence: 'v180 includes branch pilot and fallback playbooks.', next: 'Choose one pilot branch and one month.' },
  ];
  const blockers = controls.filter((c) => c.tone === 'bad');
  const warnings = controls.filter((c) => c.tone === 'warn');
  const score = Math.max(0, Math.min(100, 100 - blockers.length * 14 - warnings.length * 4));
  return {
    date: isoToday(),
    score,
    blockers,
    warnings,
    controls,
    metrics: {
      branches: branches.length,
      stores: stores.length,
      items: items.length,
      suppliers: suppliers.length,
      inventoryValue: Number(totals?.stockValue || 0),
      sales: Number(totals?.sales || 0),
      grossProfit: Number(totals?.grossProfit || 0),
      ap: Number(totals?.ap || 0),
      journals: journals.length,
      stockMovements: movements.length,
    },
  };
}

export function buildV180Program(): RoadmapRow[] {
  const streams = ['Auth + app mode', 'Setup persistence', 'Master data control', 'Foodics staging', 'Posting orchestrator', 'Inventory hardening', 'Finance hardening', 'Approvals', 'Attachments', 'Board reports', 'UI polish', 'QA'];
  return Array.from({ length: 30 }).map((_, index) => {
    const version = `v${151 + index}`;
    const stream = streams[index % streams.length];
    const deliverables: Record<string, string> = {
      'Auth + app mode': 'Local/Supabase mode bridge, backend status and Auth bootstrap readiness.',
      'Setup persistence': 'Supabase-ready services for branches, stores, suppliers, items, COA and cost centers.',
      'Master data control': 'Duplicate, inactive, orphan and compliance checks before backend sync.',
      'Foodics staging': 'Persistent batch lifecycle, row staging, mapping history and duplicate protection design.',
      'Posting orchestrator': 'Central posting contract for Foodics, inventory, finance, production and purchasing.',
      'Inventory hardening': 'Transfer lifecycle, FEFO, reservations, in-transit and inventory lock readiness.',
      'Finance hardening': 'AP/AR aging, vouchers, bank matching, depreciation and period close roadmap.',
      'Approvals': 'Maker-checker engine, delegation and approval comments for critical documents.',
      'Attachments': 'Attachment vault policy and Supabase Storage bucket mapping.',
      'Board reports': 'Report factory definitions for owner, CFO, Foodics settlement and food cost intelligence.',
      'UI polish': 'Enterprise page polish, status badges, empty states, export actions and Arabic labels.',
      'QA': 'Regression suite for setup, Foodics, inventory count, finance, backend and cutover.'
    };
    return { version, stream, deliverable: deliverables[stream], status: index < 18 ? 'Included in v180 patch' : 'Blueprint-ready', priority: index < 10 ? 'Critical' : index < 22 ? 'High' : 'Medium' };
  });
}

export function buildV180BackendModes(): BackendModeRow[] {
  return [
    { layer: 'Authentication', localMode: 'Local Admin selector', supabaseMode: 'Supabase Auth profiles + company isolation', cutoverRule: 'Enable after first admin bootstrap', readiness: 'Scaffolded' },
    { layer: 'Setup master data', localMode: 'localStorage arrays', supabaseMode: 'branches/stores/items/suppliers/cost_centers/chart_accounts tables', cutoverRule: 'Sync setup first; lock local seed after validation', readiness: 'Service-ready' },
    { layer: 'Foodics import', localMode: 'browser CSV parsing and local batch register', supabaseMode: 'foodics_import_batches + staged rows + mapping profiles', cutoverRule: 'Move upload to staging before posting', readiness: 'Migration-ready' },
    { layer: 'Posting', localMode: 'frontend posting helpers', supabaseMode: 'posting-orchestrator Edge Function with DB transaction', cutoverRule: 'No direct frontend posting after pilot', readiness: 'Contract-ready' },
    { layer: 'Attachments', localMode: 'placeholder panels', supabaseMode: 'signed upload to Storage + document_attachments table', cutoverRule: 'Require attachments by document policy', readiness: 'Designed' },
    { layer: 'Audit', localMode: 'auditLogs array', supabaseMode: 'audit_events + denied_actions + posting_events triggers', cutoverRule: 'Audit trigger required before production posting', readiness: 'Migration-ready' },
    { layer: 'Reporting', localMode: 'computed views and CSV exports', supabaseMode: 'reporting views/materialized snapshots + report-pack-builder', cutoverRule: 'Use backend views after data cutover', readiness: 'Designed' },
  ];
}

export function buildV180PostingOrchestrator(): ControlRow[] {
  return [
    { area: 'Foodics sales accounting', control: 'Approve + open period + payment mapping + duplicate batch check', status: 'Contract-ready', tone: 'good', evidence: 'Posting mode exists locally; Edge Function contract defined.', next: 'Move journal creation to posting-orchestrator.' },
    { area: 'Foodics full ERP', control: 'Recipe + stock + cost + branch store + approval', status: 'Strict design', tone: 'good', evidence: 'Starter mode prevents recipes from blocking sales accounting.', next: 'Implement transaction-safe stock and COGS posting.' },
    { area: 'Opening stock', control: 'Controlled item auto-create, cost validation, opening journal', status: 'Local working', tone: 'good', evidence: 'Opening stock upload added in v39/v40.', next: 'Persist opening stock batches and approval status.' },
    { area: 'Monthly count variance', control: 'Generate sheet, upload count, approve variance, post shortage/surplus', status: 'Local working', tone: 'good', evidence: 'v41 count sheets working perfectly per user test.', next: 'Move variance approval to backend workflow.' },
    { area: 'Supplier payment', control: 'Invoice allocation + no overpayment + period + approval', status: 'Partial', tone: 'warn', evidence: 'Invoice allocation exists locally; payment run needs backend allocation ledger.', next: 'Add AP ledger and payment voucher register.' },
    { area: 'Manual journal', control: 'Balanced lines + approval + attachments + period', status: 'Partial', tone: 'warn', evidence: 'Balanced journal guard exists; approval/attachment wiring pending.', next: 'Backend journal workflow and immutable posting.' },
    { area: 'Production batch', control: 'Approved production recipe + input lots + output lot/expiry + yield variance', status: 'Blueprint', tone: 'warn', evidence: 'Production concept exists; traceability pending.', next: 'Add raw lot to output lot traceability.' },
  ];
}

export function buildV180MasterDataControls(state: any): ControlRow[] {
  const branches = arr<any>(state?.branches);
  const stores = arr<any>(state?.stores);
  const items = arr<any>(state?.items);
  const suppliers = arr<any>(state?.suppliers);
  const accounts = arr<any>(state?.chartAccounts);
  const recipes = arr<any>(state?.recipeLines);
  const menuItems = arr<any>(state?.menuItems);
  const storeBranchMiss = stores.filter((s) => s.branchId !== 'main' && !branches.some((b) => b.id === s.branchId)).length;
  const recipeMissingItem = recipes.filter((r) => !items.some((i) => i.id === r.itemId)).length;
  const recipeMissingMenu = recipes.filter((r) => !menuItems.some((m) => m.id === r.menuItemId)).length;
  const duplicateAccountCodes = new Set<string>();
  const seenAccounts = new Set<string>();
  accounts.forEach((a) => { const code = String(a.code || '').trim(); if (!code) return; if (seenAccounts.has(code)) duplicateAccountCodes.add(code); seenAccounts.add(code); });
  return [
    { area: 'Branches', control: 'At least one branch', status: branches.length ? 'Ready' : 'Missing', tone: branches.length ? 'good' : 'bad', evidence: `${branches.length} branch(es)`, next: 'Create/import branches.' },
    { area: 'Stores', control: 'Store linked to branch/main', status: storeBranchMiss ? 'Broken links' : 'Ready', tone: storeBranchMiss ? 'bad' : 'good', evidence: `${storeBranchMiss} broken store branch links`, next: 'Fix branch-store relationship before backend sync.' },
    { area: 'Items', control: 'Item/SKU catalogue', status: items.length ? 'Ready' : 'Missing', tone: items.length ? 'good' : 'bad', evidence: `${items.length} item(s)`, next: 'Upload item master or native Foodics ingredients.' },
    { area: 'Suppliers', control: 'Supplier compliance', status: suppliers.filter((s) => !s.vatNo || !s.bankAccount).length ? 'Warning' : 'Ready', tone: suppliers.filter((s) => !s.vatNo || !s.bankAccount).length ? 'warn' : 'good', evidence: `${suppliers.filter((s) => !s.vatNo || !s.bankAccount).length} missing VAT/bank`, next: 'Complete VAT and bank fields.' },
    { area: 'Chart of accounts', control: 'Unique account codes', status: duplicateAccountCodes.size ? 'Duplicates' : 'Ready', tone: duplicateAccountCodes.size ? 'bad' : 'good', evidence: `${duplicateAccountCodes.size} duplicate account code(s)`, next: 'Fix duplicate accounts before migration.' },
    { area: 'Recipes', control: 'Recipe line integrity', status: recipeMissingItem || recipeMissingMenu ? 'Broken recipe references' : 'Ready', tone: recipeMissingItem || recipeMissingMenu ? 'bad' : 'good', evidence: `${recipeMissingItem} missing ingredient refs, ${recipeMissingMenu} missing menu refs`, next: 'Repair recipe mapping before full ERP posting.' },
  ];
}

export function buildV180ApiContracts(): ContractRow[] {
  return [
    { endpoint: 'POST /functions/v1/backend-health', purpose: 'Check Supabase project, RLS, migrations and storage readiness.', input: 'company_id?', output: 'status, migrations, buckets, rls_summary', guard: 'authenticated admin/audit' },
    { endpoint: 'POST /functions/v1/setup-sync', purpose: 'Upsert setup entities from frontend or import staging.', input: 'entity, rows, upsertMode, dryRun', output: 'created, updated, rejected, errors', guard: 'settings.master.manage' },
    { endpoint: 'POST /functions/v1/master-data-validate', purpose: 'Validate duplicates, missing references and compliance fields before cutover.', input: 'entitySet, company_id', output: 'blockers, warnings, score', guard: 'settings.master.manage or audit' },
    { endpoint: 'POST /functions/v1/foodics-staging', purpose: 'Stage Foodics headers, lines, payments, products, ingredients and modifiers.', input: 'batchName, files, rows, mappingProfileId', output: 'batch_id, validation_summary', guard: 'foodics.batch.upload' },
    { endpoint: 'POST /functions/v1/posting-orchestrator', purpose: 'Transaction-safe posting for sales, inventory, finance and production.', input: 'documentType, documentId, postingMode, approvalId', output: 'journal_id, stock_ids, audit_id, status', guard: 'permission + period + lifecycle' },
    { endpoint: 'POST /functions/v1/approval-workflow', purpose: 'Maker-checker submit/approve/reject/delegate flow.', input: 'entityType, entityId, action, comment, delegateTo?', output: 'next_status, action_id', guard: 'approver permission + scope/amount' },
    { endpoint: 'POST /functions/v1/attachment-vault', purpose: 'Signed upload/download for controlled document attachments.', input: 'documentType, documentId, purpose, filename', output: 'signed_url, attachment_id', guard: 'document.attachment.upload/view' },
    { endpoint: 'POST /functions/v1/period-close', purpose: 'Run close checklist, lock/unlock period and create close certificate.', input: 'period, branchId?, closeType, action', output: 'close_snapshot_id, status, blockers', guard: 'finance.period.lock' },
  ];
}

export function buildV180InventoryHardening(): ControlRow[] {
  return [
    { area: 'Transfers', control: 'Request → approve → dispatch → in-transit → receive', status: 'Next build', tone: 'warn', evidence: 'Transfer docs exist but lifecycle needs depth.', next: 'Create transfer lifecycle tables and UI.' },
    { area: 'Costing', control: 'Central weighted-average engine', status: 'Required', tone: 'warn', evidence: 'Average cost exists locally but should be centralized and server-side.', next: 'Move costing to inventory-posting function.' },
    { area: 'FEFO', control: 'Nearest expiry suggestion', status: 'Designed', tone: 'warn', evidence: 'Lots/expiry exist; issue suggestion pending.', next: 'Add FEFO issue preview before production/sales consumption.' },
    { area: 'Reservations', control: 'Reserved and committed stock', status: 'Designed', tone: 'info', evidence: 'Needed for transfer, production and sales reservation.', next: 'Add stock_reservations table.' },
    { area: 'Inventory close', control: 'Lock stock period after count approval', status: 'Designed', tone: 'info', evidence: 'Enterprise close checks exist.', next: 'Enforce lock in posting orchestrator.' },
  ];
}

export function buildV180FinanceHardening(): ControlRow[] {
  return [
    { area: 'AP', control: 'AP aging and payment voucher register', status: 'Partial', tone: 'warn', evidence: 'AP payment run exists; aging/register need backend ledger.', next: 'Add AP ledger table and aging view.' },
    { area: 'AR', control: 'Customer/delivery-app receivables aging', status: 'Designed', tone: 'info', evidence: 'AR concept exists; Foodics settlement needs receivable subledger.', next: 'Add AR ledger and settlement workbench.' },
    { area: 'Bank', control: 'Bank reconciliation matching rules', status: 'Designed', tone: 'info', evidence: 'Bank recon lines exist but matching rules are manual.', next: 'Add matching rules and exception workflow.' },
    { area: 'Journals', control: 'Recurring journals and journal approval', status: 'Designed', tone: 'warn', evidence: 'Manual journal exists; approval/recurrence pending.', next: 'Add recurring journal setup and approval workflow.' },
    { area: 'Fixed assets', control: 'Depreciation batch and disposal', status: 'Designed', tone: 'info', evidence: 'Fixed assets concept exists.', next: 'Add depreciation run + disposal posting.' },
    { area: 'Statements', control: 'Excel/PDF financial pack', status: 'Designed', tone: 'info', evidence: 'CSV reports exist; PDF/Excel formatted pack pending.', next: 'Implement report-pack-builder.' },
  ];
}

export function buildV180QaSuite(): RoadmapRow[] {
  return [
    { version: 'QA-01', stream: 'Build', deliverable: 'Run npm install, npm run build, and open every route.', status: 'Manual test required', priority: 'Critical' },
    { version: 'QA-02', stream: 'Setup', deliverable: 'Import branches, stores, items, suppliers, cost centers and COA.', status: 'Manual test required', priority: 'Critical' },
    { version: 'QA-03', stream: 'Foodics', deliverable: 'Upload native products, ingredients, modifiers, headers, lines and payments.', status: 'Manual test required', priority: 'Critical' },
    { version: 'QA-04', stream: 'Foodics', deliverable: 'Auto-map by SKU, open issue drilldowns and post sales-accounting-only.', status: 'Manual test required', priority: 'Critical' },
    { version: 'QA-05', stream: 'Inventory', deliverable: 'Upload opening stock, generate monthly count sheet and post approved variance.', status: 'Manual test required', priority: 'Critical' },
    { version: 'QA-06', stream: 'Finance', deliverable: 'Create manual journal, verify trial balance and period lock warnings.', status: 'Manual test required', priority: 'High' },
    { version: 'QA-07', stream: 'Backend', deliverable: 'Run supabase start, db reset, and inspect migrations/functions.', status: 'Manual test required', priority: 'Critical' },
    { version: 'QA-08', stream: 'RLS', deliverable: 'Smoke-test admin, finance, storekeeper and branch-scoped access.', status: 'Planned', priority: 'Critical' },
    { version: 'QA-09', stream: 'Cutover', deliverable: 'Export v180 readiness, backend mode, API contracts and QA files.', status: 'Ready to export', priority: 'High' },
  ];
}
