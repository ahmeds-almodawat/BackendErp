import { buildSetupPayload, getBackendMode, summarizePayload, validateSetupPayload } from '../services/setupBackendWiring';

const asArray = (value: any) => Array.isArray(value) ? value : [];
const n = (value: any) => Number(value || 0);
const round = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100;

export function rowsToCsv(rows: Array<Record<string, any>>) {
  if (!rows.length) return '';
  const headers = Array.from(rows.reduce<Set<string>>((set, row) => { Object.keys(row || {}).forEach((key) => set.add(key)); return set; }, new Set<string>()));
  const esc = (value: unknown) => {
    const text = String(value ?? '');
    return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
  };
  return [headers.join(','), ...rows.map((row) => headers.map((h) => esc(row[h])).join(','))].join('\n');
}

function journalDiff(state: any) {
  const lines = asArray(state?.journals).filter((j: any) => !j.status || j.status === 'posted').flatMap((j: any) => asArray(j.lines));
  const debit = round(lines.reduce((t: number, l: any) => t + n(l.debit), 0));
  const credit = round(lines.reduce((t: number, l: any) => t + n(l.credit), 0));
  return { debit, credit, diff: round(debit - credit) };
}

function inventoryValue(state: any) {
  return round(asArray(state?.stockMovements).reduce((total: number, m: any) => total + (m.direction === 'out' ? -1 : 1) * n(m.qty) * n(m.unitCost), 0));
}

function stockRows(state: any) {
  const map = new Map<string, { storeId: string; itemId: string; qty: number; value: number }>();
  asArray(state?.stockMovements).forEach((m: any) => {
    const key = `${m.storeId || 'unknown'}::${m.itemId || 'unknown'}`;
    const prev = map.get(key) || { storeId: m.storeId || 'unknown', itemId: m.itemId || 'unknown', qty: 0, value: 0 };
    const sign = m.direction === 'out' ? -1 : 1;
    prev.qty += sign * n(m.qty);
    prev.value += sign * n(m.qty) * n(m.unitCost);
    map.set(key, prev);
  });
  return Array.from(map.values()).map((r) => ({ ...r, qty: round(r.qty), value: round(r.value) }));
}

export function buildV280Snapshot(state: any = {}, totals: any = {}) {
  const setup = validateSetupPayload(state);
  const backend = getBackendMode();
  const jd = journalDiff(state);
  const stock = stockRows(state);
  const negativeStock = stock.filter((r) => r.qty < -0.0001);
  const zeroCostStock = stock.filter((r) => r.qty > 0.0001 && Math.abs(r.value) < 0.0001);
  const payload = buildSetupPayload(state);
  const payloadSummary = summarizePayload(payload);
  const foodicsBatches = asArray(state?.foodicsBatches);
  const approvals = asArray(state?.inventoryApprovals);
  const periods = asArray(state?.fiscalPeriods);
  const audits = asArray(state?.audits);
  const hasSupabaseEnv = backend.mode === 'supabase-ready';
  const dataScore = setup.readiness;
  const postingScore = Math.round(([Math.abs(jd.diff) <= 0.01, negativeStock.length === 0, approvals.length === 0, periods.length > 0, audits.length > 0].filter(Boolean).length / 5) * 100);
  const backendScore = Math.round(([hasSupabaseEnv, payloadSummary.branches > 0, payloadSummary.items > 0, payloadSummary.accounts > 0, payloadSummary.permissions > 0].filter(Boolean).length / 5) * 100);
  const testScore = Math.round(([payloadSummary.branches > 0, payloadSummary.stores > 0, payloadSummary.items > 0, asArray(state?.stockMovements).length > 0, foodicsBatches.length > 0 || n(totals?.salesNet || totals?.sales) > 0].filter(Boolean).length / 5) * 100);
  const blockers = [...setup.issues.filter((i) => i.severity === 'critical').map((i) => i.issue)];
  if (Math.abs(jd.diff) > 0.01) blockers.push(`Journal imbalance ${jd.diff.toFixed(2)}`);
  if (negativeStock.length) blockers.push(`${negativeStock.length} negative stock rows`);
  const warnings = [...setup.issues.filter((i) => i.severity === 'warning').map((i) => i.issue)];
  if (zeroCostStock.length) warnings.push(`${zeroCostStock.length} zero-cost stock rows`);
  if (!hasSupabaseEnv) warnings.push('Supabase environment not configured; local mode is active');
  if (!foodicsBatches.length) warnings.push('No persisted Foodics batch in local state yet');
  const readiness = Math.max(0, Math.min(100, Math.round(dataScore * 0.25 + postingScore * 0.25 + backendScore * 0.25 + testScore * 0.25 - blockers.length * 4 - warnings.length * 1.5)));
  return { readiness, dataScore, postingScore, backendScore, testScore, blockers, warnings, backend, payload, payloadSummary, setupIssues: setup.issues, journal: jd, inventoryValue: inventoryValue(state), negativeStock, zeroCostStock, counts: { foodicsBatches: foodicsBatches.length, stockMovements: asArray(state?.stockMovements).length, approvals: approvals.length, periods: periods.length, audits: audits.length } };
}

export function buildV280Program(snapshot: any) {
  return [
    { step: 'v261-v265', track: 'Refactor start', status: 'partial', goal: 'Extract setup/backend wiring services and reduce risk around giant App.tsx', evidence: 'New backend wiring service + v280 module' },
    { step: 'v266-v270', track: 'Setup persistence', status: snapshot.payloadSummary.branches && snapshot.payloadSummary.items ? 'ready-for-dry-run' : 'blocked', goal: 'Prepare branches/stores/items/suppliers/accounts for Supabase sync', evidence: `${snapshot.payloadSummary.branches} branches / ${snapshot.payloadSummary.items} SKUs` },
    { step: 'v271-v275', track: 'Posting hardening', status: snapshot.postingScore >= 80 ? 'ready' : 'partial', goal: 'Route all postings through central guard before backend cutover', evidence: `Posting score ${snapshot.postingScore}%` },
    { step: 'v276-v280', track: 'Pilot QA', status: snapshot.testScore >= 80 ? 'ready' : 'needs-data', goal: 'Make testing repeatable with payload export, dry-run, QA evidence, and issue register', evidence: `Test score ${snapshot.testScore}%` },
  ];
}

export function buildV280PostingMap(snapshot: any) {
  return [
    { document: 'Foodics sales accounting', validate: 'batch + payment mapping + period', permission: 'foodics.batch.post', inventory: 'none', gl: 'sales + VAT + settlement clearing', status: snapshot.counts.foodicsBatches ? 'ready-to-review' : 'needs-batch' },
    { document: 'Foodics full ERP', validate: 'recipes + stock + average cost', permission: 'foodics.batch.full_post', inventory: 'deduct recipe demand', gl: 'sales + VAT + COGS + inventory', status: snapshot.zeroCostStock.length || snapshot.negativeStock.length ? 'blocked' : 'guarded' },
    { document: 'Opening stock', validate: 'store + SKU + qty + unit cost', permission: 'inventory.opening.post', inventory: 'stock in', gl: 'inventory opening equity', status: snapshot.payloadSummary.items ? 'ready' : 'needs-items' },
    { document: 'Monthly stock count variance', validate: 'count batch + approval', permission: 'inventory.count.post', inventory: 'surplus/shortage adjustment', gl: 'inventory variance', status: snapshot.counts.approvals ? 'pending-approval' : 'ready' },
    { document: 'Manual journal', validate: 'debit = credit + open period', permission: 'finance.journal.post', inventory: 'none', gl: 'journal lines', status: Math.abs(snapshot.journal.diff) <= 0.01 ? 'ready' : 'blocked' },
    { document: 'Supplier payment', validate: 'invoice allocation + bank + open period', permission: 'purchasing.payment.post', inventory: 'none', gl: 'AP decrease / bank decrease', status: 'needs-backend-allocation' },
  ];
}

export function buildV280BackendWiringPlan(snapshot: any) {
  return [
    { layer: 'Environment', status: snapshot.backend.canCallEdge ? 'ready' : 'local-only', output: 'VITE_SUPABASE_URL + VITE_SUPABASE_ANON_KEY', next: 'Set .env.local when pilot backend is ready' },
    { layer: 'Setup sync payload', status: snapshot.payloadSummary.items ? 'ready' : 'needs-data', output: 'JSON payload export', next: 'Run dry-run then sync to staging tables' },
    { layer: 'Conflict detection', status: snapshot.blockers.length ? 'blocked' : 'ready', output: 'Duplicate and broken-reference checks', next: 'Resolve blockers before real sync' },
    { layer: 'Edge function dry-run', status: snapshot.backend.canCallEdge ? 'ready' : 'waiting-env', output: 'setup-sync dry-run call', next: 'Connect to setup-sync Edge Function' },
    { layer: 'Audit trail', status: snapshot.counts.audits ? 'partial' : 'missing', output: 'Local audit note', next: 'Move to database audit_events trigger' },
    { layer: 'RLS smoke test', status: 'planned', output: 'company isolation and permission checks', next: 'Create test users and validate branch/store scope' },
  ];
}

export function buildV280QaMatrix(snapshot: any) {
  return [
    { id: 'QA-001', test: 'App boots without white page', expected: 'Dashboard loads and routes switch', status: 'manual' },
    { id: 'QA-002', test: 'Setup payload export', expected: `${snapshot.payloadSummary.branches} branches, ${snapshot.payloadSummary.items} SKUs`, status: snapshot.payloadSummary.items ? 'ready' : 'needs-data' },
    { id: 'QA-003', test: 'Setup validation', expected: 'No critical duplicates or broken references', status: snapshot.blockers.length ? 'blocked' : 'ready' },
    { id: 'QA-004', test: 'Setup sync dry-run', expected: 'Local or Supabase dry-run returns ok', status: snapshot.backend.canCallEdge ? 'ready' : 'local-only' },
    { id: 'QA-005', test: 'Posting guard', expected: 'Unbalanced journals / negative stock block posting', status: snapshot.postingScore >= 80 ? 'ready' : 'review' },
    { id: 'QA-006', test: 'Foodics starter flow', expected: 'Report-only and sales accounting do not require recipes', status: snapshot.counts.foodicsBatches ? 'ready' : 'upload-sample' },
    { id: 'QA-007', test: 'Monthly count variance', expected: 'Variance goes to approval before posting', status: snapshot.counts.approvals ? 'pending-approval' : 'manual' },
    { id: 'QA-008', test: 'Backend pilot mode', expected: 'Env configured and Edge Function reachable', status: snapshot.backend.canCallEdge ? 'ready' : 'waiting-env' },
  ];
}

export function buildV280RefactorMap() {
  return [
    { module: 'Setup', current: 'Mostly inside App.tsx', next: 'src/modules/setup + setupRepository', priority: 'High', reason: 'Master data is first backend sync target' },
    { module: 'Inventory', current: 'Mostly inside App.tsx', next: 'src/modules/inventory + inventoryPostingEngine', priority: 'High', reason: 'Opening stock, counts, transfer, FEFO need a common engine' },
    { module: 'Finance', current: 'Mostly inside App.tsx', next: 'src/modules/finance + financePostingEngine', priority: 'High', reason: 'Journals, periods, vouchers, AP/AR need controlled server-side parity' },
    { module: 'Foodics', current: 'Split module exists', next: 'Persist batch state + staging repository', priority: 'High', reason: 'This is the current operational bridge' },
    { module: 'Enterprise HQ', current: 'Multiple version modules', next: 'Consolidate to one EnterpriseConsole', priority: 'Medium', reason: 'Reduce sidebar/version clutter after pilot' },
    { module: 'Shared UI', current: 'Basic shared components', next: 'DataTable, DrawerForm, Timeline, AttachmentPanel', priority: 'Medium', reason: 'Enterprise polish and consistency' },
  ];
}

export function buildV280ReportFactory(snapshot: any) {
  return [
    { report: 'Setup Sync Evidence', frequency: 'Before backend sync', export: 'JSON + CSV', owner: 'ERP Admin', status: snapshot.payloadSummary.items ? 'ready' : 'needs master data' },
    { report: 'Foodics Pilot Evidence', frequency: 'Each sales test', export: 'CSV/PDF later', owner: 'Operations/Finance', status: snapshot.counts.foodicsBatches ? 'ready' : 'upload sales sample' },
    { report: 'Inventory Count Variance', frequency: 'Monthly', export: 'CSV', owner: 'Storekeeper/Finance', status: snapshot.counts.approvals ? 'pending approvals' : 'ready when count uploaded' },
    { report: 'CFO Smoke Close Pack', frequency: 'Monthly', export: 'CSV/Excel later', owner: 'Finance', status: Math.abs(snapshot.journal.diff) <= 0.01 ? 'ready' : 'journal imbalance' },
    { report: 'Backend Pilot Checklist', frequency: 'Before Supabase pilot', export: 'CSV', owner: 'Technical lead', status: snapshot.backend.canCallEdge ? 'ready' : 'env missing' },
  ];
}
