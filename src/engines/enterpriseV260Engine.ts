export type V260Severity = 'ready' | 'info' | 'warning' | 'critical';
export type V260Status = 'ready' | 'partial' | 'blocked' | 'missing';

const asArray = (value: any) => Array.isArray(value) ? value : [];
const num = (value: any) => Number(value || 0);
const rounded = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100;

function sumRows(rows: any[], picker: (row: any) => number) {
  return rounded(rows.reduce((total, row) => total + num(picker(row)), 0));
}

function duplicateKeys(rows: any[], key: string) {
  const seen = new Map<string, number>();
  rows.forEach((row) => {
    const value = String(row?.[key] || '').trim().toLowerCase();
    if (!value) return;
    seen.set(value, (seen.get(value) || 0) + 1);
  });
  return Array.from(seen.entries()).filter(([, count]) => count > 1).map(([value, count]) => ({ value, count }));
}

function postedJournals(state: any) {
  return asArray(state?.journals).filter((j) => !j.status || j.status === 'posted');
}

function journalDiff(state: any) {
  const lines = postedJournals(state).flatMap((journal) => asArray(journal.lines));
  const debit = sumRows(lines, (line) => line.debit);
  const credit = sumRows(lines, (line) => line.credit);
  return { debit, credit, diff: rounded(debit - credit) };
}

function inventoryValue(state: any) {
  return rounded(asArray(state?.stockMovements).reduce((total, movement) => {
    const sign = movement.direction === 'out' ? -1 : 1;
    return total + sign * num(movement.qty) * num(movement.unitCost);
  }, 0));
}

function stockByItemStore(state: any) {
  const map = new Map<string, { storeId: string; itemId: string; qty: number; value: number }>();
  asArray(state?.stockMovements).forEach((movement) => {
    const key = `${movement.storeId || 'unknown'}::${movement.itemId || 'unknown'}`;
    const prev = map.get(key) || { storeId: movement.storeId, itemId: movement.itemId, qty: 0, value: 0 };
    const sign = movement.direction === 'out' ? -1 : 1;
    prev.qty += sign * num(movement.qty);
    prev.value += sign * num(movement.qty) * num(movement.unitCost);
    map.set(key, prev);
  });
  return Array.from(map.values()).map((row) => ({ ...row, qty: rounded(row.qty), value: rounded(row.value) }));
}

export function buildV260Snapshot(state: any = {}, totals: any = {}) {
  const branches = asArray(state.branches);
  const stores = asArray(state.stores);
  const suppliers = asArray(state.suppliers);
  const items = asArray(state.items);
  const menuItems = asArray(state.menuItems);
  const recipes = asArray(state.recipeLines);
  const costCenters = asArray(state.costCenters);
  const accounts = asArray(state.chartAccounts);
  const journals = asArray(state.journals);
  const stockMovements = asArray(state.stockMovements);
  const approvals = asArray(state.inventoryApprovals);
  const foodicsBatches = asArray(state.foodicsBatches);
  const audits = asArray(state.audits);
  const employees = asArray(state.employees);
  const roles = asArray(state.roles);
  const permissions = asArray(state.permissions);
  const periods = asArray(state.fiscalPeriods);
  const payments = asArray(state.supplierPayments);
  const invoices = asArray(state.purchaseInvoices);
  const supplierComplianceGaps = suppliers.filter((s) => !s.vatNo || !s.bankName || !s.bankAccount || !s.representativeName || !s.representativePhone);
  const menuMissingRecipes = menuItems.filter((m) => !recipes.some((r) => r.menuItemId === m.id));
  const stockRows = stockByItemStore(state);
  const negativeStock = stockRows.filter((r) => r.qty < -0.0001);
  const zeroCostStock = stockRows.filter((r) => r.qty > 0.0001 && Math.abs(r.value) < 0.0001);
  const jd = journalDiff(state);
  const invValue = inventoryValue(state);
  const duplicateSkus = duplicateKeys(items, 'sku');
  const duplicateStores = duplicateKeys(stores, 'code');
  const duplicateBranches = duplicateKeys(branches, 'code');
  const duplicateAccounts = duplicateKeys(accounts, 'code');
  const setupScore = Math.round(([
    branches.length > 0,
    stores.length > 0,
    suppliers.length > 0,
    items.length > 0,
    costCenters.length > 0,
    accounts.length > 0,
    duplicateSkus.length === 0,
    duplicateStores.length === 0,
    supplierComplianceGaps.length === 0,
  ].filter(Boolean).length / 9) * 100);
  const inventoryScore = Math.round(([
    stockMovements.length > 0,
    invValue > 0,
    negativeStock.length === 0,
    zeroCostStock.length === 0,
    approvals.length === 0,
  ].filter(Boolean).length / 5) * 100);
  const salesScore = Math.round(([
    menuItems.length > 0,
    recipes.length > 0,
    foodicsBatches.length > 0 || num(totals.salesNet || totals.sales) > 0,
    menuMissingRecipes.length === 0,
  ].filter(Boolean).length / 4) * 100);
  const financeScore = Math.round(([
    accounts.length > 0,
    journals.length > 0,
    Math.abs(jd.diff) <= 0.01,
    periods.length > 0,
    invoices.length > 0 || payments.length > 0,
  ].filter(Boolean).length / 5) * 100);
  const backendScore = Math.round(([
    Boolean((import.meta as any).env?.VITE_SUPABASE_URL),
    Boolean((import.meta as any).env?.VITE_SUPABASE_ANON_KEY),
    permissions.length > 0,
    roles.length > 0,
    audits.length > 0,
  ].filter(Boolean).length / 5) * 100);
  const blockers: string[] = [];
  const warnings: string[] = [];
  if (!branches.length) blockers.push('No branches loaded');
  if (!stores.length) blockers.push('No stores loaded');
  if (!items.length) blockers.push('No items/SKUs loaded');
  if (!accounts.length) blockers.push('Chart of accounts missing');
  if (Math.abs(jd.diff) > 0.01) blockers.push(`Posted journals are not balanced by ${jd.diff.toFixed(2)}`);
  if (negativeStock.length) blockers.push(`${negativeStock.length} item/store balances are negative`);
  if (duplicateSkus.length) blockers.push(`${duplicateSkus.length} duplicate SKU code groups`);
  if (duplicateAccounts.length) blockers.push(`${duplicateAccounts.length} duplicate account code groups`);
  if (!stockMovements.length) warnings.push('No stock movements yet; opening stock or purchases are required for full ERP posting');
  if (!foodicsBatches.length && num(totals.salesNet || totals.sales) <= 0) warnings.push('No Foodics/sales batch detected yet');
  if (zeroCostStock.length) warnings.push(`${zeroCostStock.length} item/store balances have quantity with zero value`);
  if (supplierComplianceGaps.length) warnings.push(`${supplierComplianceGaps.length} suppliers need VAT/bank/representative completion`);
  if (menuMissingRecipes.length) warnings.push(`${menuMissingRecipes.length} menu items are missing recipe lines`);
  if (!((import.meta as any).env?.VITE_SUPABASE_URL)) warnings.push('Supabase environment is not configured; local trial mode is active');
  const readiness = Math.max(0, Math.min(100, Math.round(
    setupScore * 0.22 + inventoryScore * 0.20 + salesScore * 0.18 + financeScore * 0.20 + backendScore * 0.20 - blockers.length * 5 - warnings.length * 1.5
  )));
  return {
    readiness,
    setupScore,
    inventoryScore,
    salesScore,
    financeScore,
    backendScore,
    blockers,
    warnings,
    counts: {
      branches: branches.length,
      stores: stores.length,
      suppliers: suppliers.length,
      items: items.length,
      menuItems: menuItems.length,
      recipeLines: recipes.length,
      costCenters: costCenters.length,
      accounts: accounts.length,
      journals: journals.length,
      stockMovements: stockMovements.length,
      inventoryApprovals: approvals.length,
      foodicsBatches: foodicsBatches.length,
      employees: employees.length,
      roles: roles.length,
      permissions: permissions.length,
      fiscalPeriods: periods.length,
      auditEvents: audits.length,
      purchaseInvoices: invoices.length,
      supplierPayments: payments.length,
    },
    money: {
      inventoryValue: invValue,
      salesNet: num(totals.salesNet || totals.sales),
      cogs: num(totals.cogs),
      grossProfit: num(totals.grossProfit),
      ap: num(totals.ap || totals.apBalance),
      journalDebit: jd.debit,
      journalCredit: jd.credit,
      journalDiff: jd.diff,
    },
    quality: {
      duplicateSkus,
      duplicateStores,
      duplicateBranches,
      duplicateAccounts,
      supplierComplianceGaps: supplierComplianceGaps.length,
      menuMissingRecipes: menuMissingRecipes.length,
      negativeStock: negativeStock.length,
      zeroCostStock: zeroCostStock.length,
      stockRows: stockRows.length,
    },
  };
}

export function buildV260Milestones(snapshot: ReturnType<typeof buildV260Snapshot>) {
  return [
    { stage: '01', area: 'Sample workflow', status: snapshot.counts.branches && snapshot.counts.items ? 'ready' : 'blocked', owner: 'Admin', action: 'Load/import setup master data, Foodics menu, opening stock, sales, and monthly count.', evidence: 'Setup counts, inventory value, Foodics batch, count approvals.' },
    { stage: '02', area: 'Foodics close', status: snapshot.salesScore >= 75 ? 'ready' : 'partial', owner: 'Finance / Operations', action: 'Validate payment mapping, discounts/voids/returns, report-only, sales accounting, and full ERP guard.', evidence: 'Foodics batch status and reconciliation exports.' },
    { stage: '03', area: 'Inventory close', status: snapshot.inventoryScore >= 80 ? 'ready' : 'partial', owner: 'Storekeeper / Controller', action: 'Post opening stock, generate count sheet, upload count, approve variance, review negative/zero-cost exposure.', evidence: 'Stock ledger and variance approval register.' },
    { stage: '04', area: 'Finance close', status: snapshot.financeScore >= 80 ? 'ready' : 'partial', owner: 'Finance Manager', action: 'Review GL, AP, VAT, trial balance, period lock, and close pack.', evidence: 'Balanced journals and close checklist export.' },
    { stage: '05', area: 'Backend pilot', status: snapshot.backendScore >= 60 ? 'partial' : 'missing', owner: 'Technical lead', action: 'Configure Supabase env, run migrations locally, dry-run setup sync, and test RLS smoke cases.', evidence: 'Backend readiness export and migration log.' },
  ];
}

export function buildV260TestingMatrix(snapshot: ReturnType<typeof buildV260Snapshot>) {
  const base = [
    ['BOOT-001', 'App boots with empty local data', 'No white page, dashboard loads, navigation works', 'Manual', snapshot.readiness >= 0 ? 'ready' : 'blocked'],
    ['SETUP-010', 'Import setup files', 'Branches, stores, items, suppliers, accounts loaded with no duplicates', 'Import / Export', snapshot.setupScore >= 80 ? 'ready' : 'partial'],
    ['INV-020', 'Post opening stock', 'Inventory value becomes positive and stock ledger is populated', 'Inventory', snapshot.counts.stockMovements > 0 ? 'ready' : 'partial'],
    ['INV-030', 'Monthly stock count variance', 'Count upload creates approval rows before posting', 'Inventory', snapshot.counts.inventoryApprovals > 0 ? 'ready' : 'partial'],
    ['FOOD-040', 'Foodics menu import', 'Menu items and recipes are available for SKU auto-map', 'Sales / POS', snapshot.counts.menuItems && snapshot.counts.recipeLines ? 'ready' : 'partial'],
    ['FOOD-050', 'Foodics sales import', 'Orders, lines, payments validate and reconcile', 'Sales / POS', snapshot.counts.foodicsBatches > 0 ? 'ready' : 'partial'],
    ['FIN-060', 'Sales accounting-only posting', 'Revenue, VAT, and payment clearing journal balanced', 'Finance', Math.abs(snapshot.money.journalDiff) <= 0.01 ? 'ready' : 'blocked'],
    ['ERP-070', 'Full ERP posting guard', 'Missing stock/recipe/cost blocks only full ERP mode, not report-only mode', 'Sales / POS', snapshot.quality.negativeStock === 0 ? 'ready' : 'partial'],
    ['CLOSE-080', 'Pilot close certificate', 'No critical blockers and evidence pack exported', 'Enterprise v260', snapshot.blockers.length === 0 ? 'ready' : 'blocked'],
    ['BACK-090', 'Backend dry-run', 'Supabase env configured and setup sync dry-run returns expected structure', 'Backend', snapshot.backendScore >= 60 ? 'partial' : 'missing'],
  ];
  return base.map(([id, test, expected, module, status]) => ({ id, test, expected, module, status }));
}

export function buildV260IssueRegister(snapshot: ReturnType<typeof buildV260Snapshot>) {
  const rows: any[] = [];
  snapshot.blockers.forEach((issue, index) => rows.push({ id: `CRIT-${String(index + 1).padStart(3, '0')}`, severity: 'critical', module: 'Core', issue, fix: 'Resolve before pilot close or production cutover.' }));
  snapshot.warnings.forEach((issue, index) => rows.push({ id: `WARN-${String(index + 1).padStart(3, '0')}`, severity: 'warning', module: 'Core', issue, fix: 'Review during pilot QA and document if accepted.' }));
  if (!rows.length) rows.push({ id: 'OK-001', severity: 'ready', module: 'Pilot', issue: 'No active critical local issues detected', fix: 'Proceed with QA evidence export and pilot review.' });
  return rows;
}

export function buildV260ReportFactory(snapshot: ReturnType<typeof buildV260Snapshot>) {
  return [
    { report: 'Pilot Readiness Certificate', owner: 'Project owner', status: snapshot.blockers.length ? 'blocked' : 'ready', purpose: 'Confirms local test flows are stable enough for pilot review.' },
    { report: 'Foodics Close Pack', owner: 'Restaurant accountant', status: snapshot.salesScore >= 75 ? 'ready' : 'partial', purpose: 'Sales, payment, VAT, void/return, and settlement evidence.' },
    { report: 'Inventory Count Variance Pack', owner: 'Store controller', status: snapshot.inventoryScore >= 80 ? 'ready' : 'partial', purpose: 'Opening stock, monthly count, shortage/surplus, approval status.' },
    { report: 'CFO Smoke Close Pack', owner: 'Finance manager', status: snapshot.financeScore >= 80 ? 'ready' : 'partial', purpose: 'Trial balance, AP, VAT, bank, and period-close smoke checks.' },
    { report: 'Backend Cutover Readiness', owner: 'Technical lead', status: snapshot.backendScore >= 60 ? 'partial' : 'missing', purpose: 'Supabase env, schema, RLS, functions, storage, audit, and backup readiness.' },
  ];
}

export function buildV260BackendPlan() {
  return [
    { wave: '01', layer: 'Supabase environment', status: 'planned', action: 'Fill VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY, then run local Supabase reset.' },
    { wave: '02', layer: 'Setup persistence', status: 'designed', action: 'Persist branches, stores, suppliers, items, accounts, cost centers, roles, permissions.' },
    { wave: '03', layer: 'Foodics staging', status: 'designed', action: 'Store upload batches, row staging, mappings, issue resolutions, approval state, and reversal state.' },
    { wave: '04', layer: 'Posting orchestrator', status: 'designed', action: 'Move critical posting from frontend into Edge Functions with database transactions.' },
    { wave: '05', layer: 'Attachment vault', status: 'designed', action: 'Enable storage buckets for invoices, GRNs, stock count sheets, journals, and supplier docs.' },
    { wave: '06', layer: 'RLS and audit', status: 'designed', action: 'Enforce company/branch/store scope and immutable audit records.' },
  ];
}

export function rowsToCsv(rows: any[]) {
  if (!rows.length) return '';
  const headers = Array.from(rows.reduce<Set<string>>((set, row) => {
    Object.keys(row || {}).forEach((key) => set.add(key));
    return set;
  }, new Set<string>()));
  const esc = (value: any) => `"${String(value ?? '').replace(/"/g, '""')}"`;
  return [headers.join(','), ...rows.map((row) => headers.map((header) => esc(row?.[header])).join(','))].join('\n');
}
