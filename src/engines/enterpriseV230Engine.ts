export type V230Status = 'pass' | 'warning' | 'blocker' | 'info';

export type V230Check = {
  area: string;
  check: string;
  status: V230Status;
  evidence: string;
  owner: string;
  nextAction: string;
};

export type V230PilotStep = {
  id: string;
  stage: string;
  objective: string;
  actions: string[];
  expected: string;
  status: V230Status;
};

export type V230Issue = {
  id: string;
  severity: V230Status;
  module: string;
  issue: string;
  evidence: string;
  fix: string;
};

const n = (value: any) => Number(value || 0);
const rows = (value: any) => Array.isArray(value) ? value : [];
const count = (value: any) => rows(value).length;
const sum = (value: any, fn: (row: any) => number) => rows(value).reduce((t, r) => t + n(fn(r)), 0);
const unique = (value: any, fn: (row: any) => string | undefined) => new Set(rows(value).map(fn).filter(Boolean));
const abs = Math.abs;

export const V230_EXPECTED_SAMPLE = {
  orders: 14,
  doneOrders: 12,
  voidOrders: 1,
  returnedOrders: 1,
  orderLines: 24,
  paymentLines: 13,
  recognizedGross: 1311,
  vatOutput: 171,
  openingInventoryValue: 6383,
  theoreticalCogs: 180.36,
  inventoryAfterSales: 6202.64,
  stockCountShortageValue: 34.16,
  stockCountSurplusValue: 3.75,
};

export function money(value: number) {
  return Number(value || 0).toFixed(2);
}

export function buildV230Metrics(state: any, totals: any) {
  const salesDocs = rows(state?.salesDocuments);
  const journals = rows(state?.journalEntries);
  const journalLines = rows(state?.journalLines);
  const stockMovements = rows(state?.stockMovements);
  const inventoryApprovals = rows(state?.inventoryApprovals);
  const suppliers = rows(state?.suppliers);
  const items = rows(state?.items);
  const stores = rows(state?.stores);
  const branches = rows(state?.branches);
  const recipes = rows(state?.recipeLines);
  const menuItems = rows(state?.menuItems);

  const journalDebit = sum(journalLines, (l) => l.debit);
  const journalCredit = sum(journalLines, (l) => l.credit);
  const journalDiff = abs(journalDebit - journalCredit || n(totals?.trialBalanceDifference));
  const stockValue = n(totals?.stockValue) || sum(stockMovements, (m) => n(m.qty) * n(m.unitCost || m.cost));
  const sales = n(totals?.sales) || sum(salesDocs, (s) => n(s.gross || s.total || s.totalGross));
  const cogs = n(totals?.cogs) || sum(stockMovements.filter((m: any) => String(m.reason || m.type || '').toLowerCase().includes('sale')), (m: any) => abs(n(m.qty)) * n(m.unitCost || m.cost));
  const duplicateSkus = count(items) - unique(items, (x) => x?.sku).size;
  const duplicateStores = count(stores) - unique(stores, (x) => x?.code).size;
  const duplicateBranches = count(branches) - unique(branches, (x) => x?.code).size;
  const missingSupplierCompliance = suppliers.filter((s: any) => !s?.vatNo || !s?.bankName || !s?.bankAccount).length;
  const zeroCostStock = stockMovements.filter((m: any) => n(m.qty) > 0 && n(m.unitCost || m.cost) === 0).length;
  const negativeStockRows = stockMovements.filter((m: any) => n(m.qty) < 0 && n(m.balanceAfter) < 0).length;
  const pendingApprovals = inventoryApprovals.filter((a: any) => String(a?.status || '').toLowerCase() === 'pending').length;
  const foodicsBatches = rows(state?.foodicsBatches);
  const postedFoodicsBatches = foodicsBatches.filter((b: any) => String(b?.status || '').toLowerCase().includes('posted')).length;
  const mappedMenuPercent = menuItems.length ? Math.round(Math.min(100, (recipes.length / Math.max(1, menuItems.length)) * 100)) : 0;

  const blockers = [
    branches.length === 0,
    stores.length === 0,
    items.length === 0,
    duplicateSkus > 0,
    duplicateStores > 0,
    duplicateBranches > 0,
    journalDiff > 0.01,
  ].filter(Boolean).length;
  const warnings = [
    menuItems.length === 0,
    recipes.length === 0,
    stockMovements.length === 0,
    zeroCostStock > 0,
    pendingApprovals > 0,
    missingSupplierCompliance > 0,
    postedFoodicsBatches === 0 && salesDocs.length === 0,
  ].filter(Boolean).length;
  const score = Math.max(0, Math.min(100, Math.round(96 - blockers * 10 - warnings * 3)));

  return {
    score,
    blockers,
    warnings,
    branches: branches.length,
    stores: stores.length,
    items: items.length,
    suppliers: suppliers.length,
    recipes: recipes.length,
    menuItems: menuItems.length,
    mappedMenuPercent,
    stockMovements: stockMovements.length,
    inventoryApprovals: inventoryApprovals.length,
    pendingApprovals,
    stockValue,
    sales,
    cogs,
    grossProfit: sales - cogs,
    journals: journals.length,
    journalLines: journalLines.length,
    journalDiff,
    foodicsBatches: foodicsBatches.length,
    postedFoodicsBatches,
    duplicateSkus,
    duplicateStores,
    duplicateBranches,
    missingSupplierCompliance,
    zeroCostStock,
    negativeStockRows,
  };
}

export function buildV230Checks(state: any, totals: any): V230Check[] {
  const m = buildV230Metrics(state, totals);
  return [
    { area: 'Setup', check: 'Branches loaded', status: m.branches ? 'pass' : 'blocker', evidence: `${m.branches} branches`, owner: 'Admin', nextAction: m.branches ? 'Ready' : 'Upload branches setup' },
    { area: 'Setup', check: 'Stores loaded', status: m.stores ? 'pass' : 'blocker', evidence: `${m.stores} stores`, owner: 'Admin / Inventory', nextAction: m.stores ? 'Ready' : 'Upload stores and branch links' },
    { area: 'Setup', check: 'Items/SKUs loaded', status: m.items ? 'pass' : 'blocker', evidence: `${m.items} SKUs`, owner: 'Inventory Controller', nextAction: m.items ? 'Ready' : 'Upload item master' },
    { area: 'Data Quality', check: 'Duplicate SKUs', status: m.duplicateSkus ? 'blocker' : 'pass', evidence: `${m.duplicateSkus} duplicate risks`, owner: 'Master Data', nextAction: m.duplicateSkus ? 'Merge/deactivate duplicates' : 'Ready' },
    { area: 'Data Quality', check: 'Duplicate store codes', status: m.duplicateStores ? 'blocker' : 'pass', evidence: `${m.duplicateStores} duplicate risks`, owner: 'Master Data', nextAction: m.duplicateStores ? 'Fix store codes' : 'Ready' },
    { area: 'Supplier', check: 'Supplier VAT/bank compliance', status: m.missingSupplierCompliance ? 'warning' : 'pass', evidence: `${m.missingSupplierCompliance} suppliers missing fields`, owner: 'Procurement / Finance', nextAction: m.missingSupplierCompliance ? 'Complete VAT, bank and representative details' : 'Ready' },
    { area: 'Menu', check: 'Menu and recipes loaded', status: m.menuItems && m.recipes ? 'pass' : 'warning', evidence: `${m.menuItems} menu items / ${m.recipes} recipe lines`, owner: 'Cost Controller / Chef', nextAction: m.recipes ? 'Ready' : 'Import Foodics ingredients or build recipes' },
    { area: 'Inventory', check: 'Opening stock / movements exist', status: m.stockMovements ? 'pass' : 'warning', evidence: `${m.stockMovements} stock movement rows`, owner: 'Storekeeper', nextAction: m.stockMovements ? 'Ready' : 'Upload opening stock or purchase invoice' },
    { area: 'Inventory', check: 'Pending stock count approvals', status: m.pendingApprovals ? 'warning' : 'pass', evidence: `${m.pendingApprovals} pending approvals`, owner: 'Inventory Manager', nextAction: m.pendingApprovals ? 'Approve or reject variance batch' : 'Ready' },
    { area: 'Inventory', check: 'Zero-cost stock exposure', status: m.zeroCostStock ? 'warning' : 'pass', evidence: `${m.zeroCostStock} zero-cost movement rows`, owner: 'Cost Controller', nextAction: m.zeroCostStock ? 'Post purchase/opening cost before full ERP posting' : 'Ready' },
    { area: 'Inventory', check: 'Negative stock exposure', status: m.negativeStockRows ? 'blocker' : 'pass', evidence: `${m.negativeStockRows} negative rows`, owner: 'Storekeeper', nextAction: m.negativeStockRows ? 'Post stock or reverse incorrect movements' : 'Ready' },
    { area: 'Foodics', check: 'Foodics/sales evidence', status: m.foodicsBatches || m.sales > 0 ? 'pass' : 'warning', evidence: `${m.foodicsBatches} batches / SAR ${money(m.sales)} sales`, owner: 'Operations / Finance', nextAction: m.foodicsBatches || m.sales > 0 ? 'Ready' : 'Upload Foodics sample sales' },
    { area: 'Finance', check: 'Journal balance', status: m.journalDiff <= 0.01 ? 'pass' : 'blocker', evidence: `Difference SAR ${money(m.journalDiff)}`, owner: 'Finance', nextAction: m.journalDiff <= 0.01 ? 'Ready' : 'Fix unbalanced journal lines' },
    { area: 'Close', check: 'Pilot close readiness', status: m.score >= 85 ? 'pass' : m.score >= 70 ? 'warning' : 'blocker', evidence: `${m.score}% readiness`, owner: 'Owner / Finance / Operations', nextAction: m.score >= 85 ? 'Run pilot close test' : 'Resolve blockers and rerun QA' },
  ];
}

export function buildV230PilotSteps(state: any, totals: any): V230PilotStep[] {
  const m = buildV230Metrics(state, totals);
  return [
    { id: 'PILOT-001', stage: 'Boot', objective: 'Open app and confirm no white page.', actions: ['Double-click START_ERP_LOCAL.bat', 'Open app', 'Switch language', 'Open Dashboard'], expected: 'App opens in both Arabic and English.', status: 'pass' },
    { id: 'PILOT-010', stage: 'Setup', objective: 'Load/setup master data.', actions: ['Import branches', 'Import stores', 'Import items', 'Import suppliers', 'Import cost centers'], expected: 'Master data score has no blockers.', status: m.branches && m.stores && m.items ? 'pass' : 'warning' },
    { id: 'PILOT-020', stage: 'Inventory', objective: 'Establish opening stock and cost.', actions: ['Inventory → Opening Stock Upload', 'Upload opening stock CSV', 'Post opening stock'], expected: 'Inventory value becomes positive and stock ledger has rows.', status: m.stockValue > 0 ? 'pass' : 'warning' },
    { id: 'PILOT-030', stage: 'Foodics menu', objective: 'Import native Foodics menu bundle.', actions: ['Sales/POS → Menu Import', 'Upload products', 'Upload ingredients', 'Upload modifiers', 'Import native bundle'], expected: 'Menu items and recipe lines are created/mapped by SKU.', status: m.menuItems && m.recipes ? 'pass' : 'warning' },
    { id: 'PILOT-040', stage: 'Foodics sales', objective: 'Upload sales and resolve issues.', actions: ['Upload order headers', 'Upload order lines', 'Upload payments', 'Auto-map by SKU', 'Open issue center'], expected: 'No hard blockers for sales accounting-only posting.', status: m.foodicsBatches || m.sales > 0 ? 'pass' : 'warning' },
    { id: 'PILOT-050', stage: 'Posting', objective: 'Run sales accounting-only posting first.', actions: ['Posting', 'Select Sales Accounting Only', 'Approve batch', 'Post'], expected: 'Sales/VAT/payment journal is created without requiring full recipe deduction.', status: m.journals > 0 ? 'pass' : 'info' },
    { id: 'PILOT-060', stage: 'Full ERP guard', objective: 'Confirm full ERP posting blocks missing inventory/costs.', actions: ['Select Full ERP Posting', 'Review blockers', 'Open issue center'], expected: 'Full posting only passes when recipes, stock and cost are ready.', status: m.zeroCostStock || m.negativeStockRows ? 'warning' : 'pass' },
    { id: 'PILOT-070', stage: 'Stock count', objective: 'Generate and upload monthly count.', actions: ['Inventory → Monthly Stock Count', 'Generate count sheet', 'Upload counted quantities', 'Create variance approval', 'Approve'], expected: 'Shortage/surplus is calculated and posted only after approval.', status: m.inventoryApprovals ? 'info' : 'warning' },
    { id: 'PILOT-080', stage: 'Finance close', objective: 'Check trial balance, AP, VAT and close readiness.', actions: ['Finance → Trial Balance', 'Finance → VAT', 'Enterprise v230 → Pilot Close'], expected: 'Journal difference is zero and close blockers are explained.', status: m.journalDiff <= 0.01 ? 'pass' : 'blocker' },
    { id: 'PILOT-090', stage: 'Export pack', objective: 'Export pilot evidence for review.', actions: ['Enterprise v230', 'Export pilot checklist', 'Export issue register', 'Export expected results'], expected: 'CSV evidence pack is downloaded.', status: 'pass' },
  ];
}

export function buildV230IssueRegister(state: any, totals: any): V230Issue[] {
  const m = buildV230Metrics(state, totals);
  const issues: V230Issue[] = [];
  const add = (condition: boolean, issue: V230Issue) => { if (condition) issues.push(issue); };
  add(!m.branches, { id: 'ISS-SETUP-001', severity: 'blocker', module: 'Setup', issue: 'No branches loaded', evidence: '0 branches', fix: 'Upload branches setup CSV before testing branch/store scope.' });
  add(!m.stores, { id: 'ISS-SETUP-002', severity: 'blocker', module: 'Setup', issue: 'No stores loaded', evidence: '0 stores', fix: 'Upload stores setup CSV and link each store to branch.' });
  add(!m.items, { id: 'ISS-SETUP-003', severity: 'blocker', module: 'Setup', issue: 'No item master loaded', evidence: '0 SKUs', fix: 'Upload item master or allow opening stock auto-create only for trial.' });
  add(m.duplicateSkus > 0, { id: 'ISS-DQ-001', severity: 'blocker', module: 'Data Quality', issue: 'Duplicate SKUs detected', evidence: `${m.duplicateSkus} duplicate risk`, fix: 'Merge duplicate SKUs or deactivate duplicates.' });
  add(m.missingSupplierCompliance > 0, { id: 'ISS-SUP-001', severity: 'warning', module: 'Suppliers', issue: 'Supplier compliance fields incomplete', evidence: `${m.missingSupplierCompliance} suppliers missing VAT/bank data`, fix: 'Complete supplier VAT number, bank account, representative details.' });
  add(!m.recipes, { id: 'ISS-MENU-001', severity: 'warning', module: 'Recipes', issue: 'Recipes missing', evidence: '0 recipe lines', fix: 'Import Foodics products ingredients or build recipe lines manually.' });
  add(!m.stockMovements, { id: 'ISS-INV-001', severity: 'warning', module: 'Inventory', issue: 'Opening stock not posted', evidence: '0 stock movement rows', fix: 'Upload opening stock sample before full ERP posting.' });
  add(m.zeroCostStock > 0, { id: 'ISS-INV-002', severity: 'warning', module: 'Inventory', issue: 'Zero-cost stock exposure', evidence: `${m.zeroCostStock} zero-cost movement rows`, fix: 'Post purchase invoice/opening cost before full ERP posting.' });
  add(m.negativeStockRows > 0, { id: 'ISS-INV-003', severity: 'blocker', module: 'Inventory', issue: 'Negative stock risk', evidence: `${m.negativeStockRows} negative rows`, fix: 'Post stock, adjust recipes, or reverse incorrect movements.' });
  add(m.pendingApprovals > 0, { id: 'ISS-INV-004', severity: 'warning', module: 'Inventory', issue: 'Inventory variance approvals pending', evidence: `${m.pendingApprovals} pending`, fix: 'Review and approve/reject variance batch.' });
  add(m.journalDiff > 0.01, { id: 'ISS-FIN-001', severity: 'blocker', module: 'Finance', issue: 'Unbalanced journals', evidence: `Difference SAR ${money(m.journalDiff)}`, fix: 'Review journal register and fix debit/credit mismatch.' });
  add(!m.foodicsBatches && m.sales <= 0, { id: 'ISS-POS-001', severity: 'warning', module: 'Foodics', issue: 'No sales batch evidence', evidence: 'No Foodics batch or local sales total', fix: 'Upload sample Foodics sales files and test report-only/sales accounting-only flow.' });
  return issues;
}

export function buildV230ExpectedResults(state: any, totals: any) {
  const m = buildV230Metrics(state, totals);
  return [
    { metric: 'Order headers', expected: V230_EXPECTED_SAMPLE.orders, actual: count(state?.foodicsOrderHeaders) || count(state?.salesDocuments) || 0, tolerance: 0, status: 'info' },
    { metric: 'Foodics order lines', expected: V230_EXPECTED_SAMPLE.orderLines, actual: count(state?.foodicsOrderLines) || 0, tolerance: 0, status: 'info' },
    { metric: 'Payment lines', expected: V230_EXPECTED_SAMPLE.paymentLines, actual: count(state?.foodicsPayments) || 0, tolerance: 0, status: 'info' },
    { metric: 'Recognized gross after void/return', expected: V230_EXPECTED_SAMPLE.recognizedGross, actual: m.sales, tolerance: 5, status: abs(m.sales - V230_EXPECTED_SAMPLE.recognizedGross) <= 5 ? 'pass' : 'warning' },
    { metric: 'VAT output', expected: V230_EXPECTED_SAMPLE.vatOutput, actual: n(totals?.vatOutput) || sum(state?.journalLines, (l) => String(l?.accountName || '').toLowerCase().includes('vat') ? n(l.credit) - n(l.debit) : 0), tolerance: 5, status: 'info' },
    { metric: 'Opening inventory value', expected: V230_EXPECTED_SAMPLE.openingInventoryValue, actual: m.stockValue, tolerance: 100, status: m.stockValue > 0 ? 'pass' : 'warning' },
    { metric: 'Theoretical COGS from recipes', expected: V230_EXPECTED_SAMPLE.theoreticalCogs, actual: m.cogs, tolerance: 50, status: m.cogs > 0 ? 'pass' : 'warning' },
    { metric: 'Stock count shortage value', expected: V230_EXPECTED_SAMPLE.stockCountShortageValue, actual: sum(state?.inventoryApprovals, (a) => String(a?.type || a?.direction || '').toLowerCase().includes('short') ? n(a.value || a.amount) : 0), tolerance: 10, status: 'info' },
    { metric: 'Stock count surplus value', expected: V230_EXPECTED_SAMPLE.stockCountSurplusValue, actual: sum(state?.inventoryApprovals, (a) => String(a?.type || a?.direction || '').toLowerCase().includes('surplus') ? n(a.value || a.amount) : 0), tolerance: 10, status: 'info' },
  ];
}

export function toCsv(rowsIn: any[]) {
  if (!rowsIn.length) return '';
  const headers = Object.keys(rowsIn[0]);
  const esc = (v: any) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  return [headers.join(','), ...rowsIn.map((r) => headers.map((h) => esc(r[h])).join(','))].join('\n');
}
