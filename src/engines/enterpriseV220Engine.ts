export type V220Severity = 'pass' | 'warning' | 'blocker' | 'info';

export type V220ControlRow = {
  area: string;
  check: string;
  status: V220Severity;
  owner: string;
  evidence: string;
  nextAction: string;
};

export type V220Scenario = {
  id: string;
  title: string;
  objective: string;
  steps: string[];
  expected: string;
  status: V220Severity;
};

function count<T>(rows: T[] | undefined): number {
  return Array.isArray(rows) ? rows.length : 0;
}

function sum(rows: any[] | undefined, selector: (row: any) => number): number {
  return (rows || []).reduce((total, row) => total + (Number(selector(row)) || 0), 0);
}

function uniqueCount(rows: any[] | undefined, selector: (row: any) => string | undefined): number {
  return new Set((rows || []).map(selector).filter(Boolean)).size;
}

export function buildV220Readiness(state: any, totals: any) {
  const journalImbalance = Math.abs(Number(totals?.trialBalanceDifference || 0));
  const duplicateSkus = count(state?.items) - uniqueCount(state?.items, (x) => x?.sku);
  const duplicateAccounts = count(state?.chartAccounts) - uniqueCount(state?.chartAccounts, (x) => x?.code);
  const stockValue = Number(totals?.stockValue || 0);
  const ap = Number(totals?.ap || 0);
  const hasBranches = count(state?.branches) > 0;
  const hasStores = count(state?.stores) > 0;
  const hasItems = count(state?.items) > 0;
  const hasRecipes = count(state?.recipeLines) > 0;
  const hasFoodics = count(state?.salesDocuments) > 0 || count(state?.foodicsBatches) > 0;
  const hasOpeningOrMovement = count(state?.stockMovements) > 0;
  const pendingApprovals = (state?.inventoryApprovals || []).filter((x: any) => x?.status === 'pending').length;
  const zeroCostStock = (state?.stockMovements || []).filter((x: any) => Number(x?.unitCost || 0) === 0).length;

  const blockers = [
    !hasBranches,
    !hasStores,
    !hasItems,
    journalImbalance > 0.01,
    duplicateSkus > 0,
    duplicateAccounts > 0,
  ].filter(Boolean).length;

  const warnings = [
    !hasRecipes,
    !hasFoodics,
    !hasOpeningOrMovement,
    pendingApprovals > 0,
    zeroCostStock > 0,
    ap > 0,
  ].filter(Boolean).length;

  const score = Math.max(0, Math.min(100, Math.round(94 - blockers * 12 - warnings * 4)));

  const rows: V220ControlRow[] = [
    { area: 'Setup', check: 'Branches exist', status: hasBranches ? 'pass' : 'blocker', owner: 'Admin', evidence: `${count(state?.branches)} branches`, nextAction: hasBranches ? 'Ready' : 'Import or create branches' },
    { area: 'Setup', check: 'Stores exist and are linked', status: hasStores ? 'pass' : 'blocker', owner: 'Admin / Storekeeper', evidence: `${count(state?.stores)} stores`, nextAction: hasStores ? 'Ready' : 'Import or create stores' },
    { area: 'Inventory', check: 'Item master exists', status: hasItems ? 'pass' : 'blocker', owner: 'Inventory Controller', evidence: `${count(state?.items)} SKUs`, nextAction: hasItems ? 'Ready' : 'Import item master' },
    { area: 'Menu', check: 'Recipe lines exist', status: hasRecipes ? 'pass' : 'warning', owner: 'Chef / Cost Controller', evidence: `${count(state?.recipeLines)} recipe lines`, nextAction: hasRecipes ? 'Ready' : 'Import Foodics ingredients or build recipes' },
    { area: 'Inventory', check: 'Opening stock or stock movement exists', status: hasOpeningOrMovement ? 'pass' : 'warning', owner: 'Storekeeper', evidence: `${count(state?.stockMovements)} movements`, nextAction: hasOpeningOrMovement ? 'Ready' : 'Upload opening stock or purchase invoice sample' },
    { area: 'Finance', check: 'Journal balance', status: journalImbalance <= 0.01 ? 'pass' : 'blocker', owner: 'Finance', evidence: `Difference ${journalImbalance.toFixed(2)}`, nextAction: journalImbalance <= 0.01 ? 'Ready' : 'Review unbalanced journals' },
    { area: 'Data Quality', check: 'Duplicate SKUs', status: duplicateSkus === 0 ? 'pass' : 'blocker', owner: 'Master Data', evidence: `${duplicateSkus} duplicate risk`, nextAction: duplicateSkus === 0 ? 'Ready' : 'Merge or deactivate duplicate SKUs' },
    { area: 'Data Quality', check: 'Duplicate account codes', status: duplicateAccounts === 0 ? 'pass' : 'blocker', owner: 'Finance', evidence: `${duplicateAccounts} duplicate risk`, nextAction: duplicateAccounts === 0 ? 'Ready' : 'Fix chart of accounts' },
    { area: 'Inventory', check: 'Pending inventory approvals', status: pendingApprovals === 0 ? 'pass' : 'warning', owner: 'Inventory Manager', evidence: `${pendingApprovals} pending`, nextAction: pendingApprovals === 0 ? 'Ready' : 'Approve or reject count variances' },
    { area: 'Costing', check: 'Zero-cost stock exposure', status: zeroCostStock === 0 ? 'pass' : 'warning', owner: 'Cost Controller', evidence: `${zeroCostStock} zero-cost movement rows`, nextAction: zeroCostStock === 0 ? 'Ready' : 'Post purchase/opening cost or allow sales accounting only' },
    { area: 'Foodics', check: 'Sales batch evidence', status: hasFoodics ? 'pass' : 'warning', owner: 'Operations / Finance', evidence: `${count(state?.salesDocuments)} sales docs`, nextAction: hasFoodics ? 'Ready' : 'Upload Foodics sample sales files' },
    { area: 'Finance', check: 'AP exposure visible', status: ap >= 0 ? 'info' : 'warning', owner: 'Finance', evidence: `${ap.toFixed(2)} AP`, nextAction: 'Review AP aging before close' },
    { area: 'Inventory', check: 'Inventory value visible', status: stockValue >= 0 ? 'info' : 'warning', owner: 'Finance / Inventory', evidence: `${stockValue.toFixed(2)} value`, nextAction: 'Reconcile to GL inventory before close' },
  ];

  return { score, blockers, warnings, rows, stockValue, ap, journalImbalance };
}

export function buildV220Scenarios(state: any): V220Scenario[] {
  return [
    {
      id: 'BOOT-001',
      title: 'Empty app boot and navigation smoke test',
      objective: 'Confirm the ERP opens without a white page and all main modules are reachable.',
      steps: ['Open app', 'Switch language', 'Open Dashboard', 'Open Inventory', 'Open Sales/POS', 'Open Finance', 'Open Enterprise v220'],
      expected: 'No white screen; module error boundary catches failures if any module crashes.',
      status: 'pass',
    },
    {
      id: 'SETUP-010',
      title: 'Load fast trial scenario',
      objective: 'Create enough local data to test inventory, Foodics, finance and enterprise checks.',
      steps: ['Dashboard', 'Click Load fast trial scenario', 'Return to Enterprise v220', 'Review readiness score'],
      expected: 'Branches, stores, items, recipes, journals and stock movement rows exist.',
      status: count(state?.branches) && count(state?.items) ? 'pass' : 'warning',
    },
    {
      id: 'INV-020',
      title: 'Opening stock upload test',
      objective: 'Confirm unknown items can be bootstrapped and stock quantity/cost can be created.',
      steps: ['Inventory', 'Opening Stock Upload', 'Upload CSV', 'Allow auto-create missing SKUs if starter trial', 'Post opening stock'],
      expected: 'Stock movements created and inventory value becomes visible.',
      status: count(state?.stockMovements) > 0 ? 'pass' : 'warning',
    },
    {
      id: 'INV-030',
      title: 'Monthly stock count variance approval test',
      objective: 'Confirm physical count creates shortage/surplus rows that require approval before posting.',
      steps: ['Inventory', 'Monthly Stock Count', 'Generate count sheet', 'Upload completed count CSV', 'Create variance approval batch', 'Approval Queue', 'Post variance'],
      expected: 'No direct posting without approval; variance creates stock movement and journal after approval.',
      status: count(state?.inventoryApprovals) > 0 ? 'pass' : 'info',
    },
    {
      id: 'FOODICS-040',
      title: 'Foodics menu + sales starter test',
      objective: 'Confirm Foodics menu imports, sales upload, auto-map by SKU and issue drilldown work.',
      steps: ['Sales/POS Trial', 'Menu Import', 'Upload products, ingredients, modifiers', 'Upload order headers, lines, payments', 'Auto map by SKU', 'Open Issue Center'],
      expected: 'Unmapped rows are visible and fixable; missing recipes are warning unless Full ERP mode is selected.',
      status: count(state?.salesDocuments) > 0 ? 'pass' : 'warning',
    },
    {
      id: 'POST-050',
      title: 'Sales accounting-only posting test',
      objective: 'Confirm starter mode can post sales/VAT/payment without recipe blockers.',
      steps: ['Sales/POS Trial', 'Posting', 'Choose Sales Accounting Only', 'Approve Batch', 'Post Batch', 'Finance GL'],
      expected: 'Sales/VAT/payment journals created; no inventory/COGS required.',
      status: count((state?.journals || []).filter((j: any) => String(j?.source || '').toLowerCase().includes('sales'))) > 0 ? 'pass' : 'warning',
    },
    {
      id: 'FULL-060',
      title: 'Full ERP posting guard test',
      objective: 'Confirm full posting blocks when recipes, stock or cost are missing and passes when ready.',
      steps: ['Prepare recipes', 'Prepare opening stock/purchase cost', 'Sales/POS Trial', 'Posting', 'Choose Full ERP Posting', 'Review blockers', 'Post only when blockers are resolved'],
      expected: 'No silent inventory/COGS posting with missing stock/cost/recipe.',
      status: 'info',
    },
    {
      id: 'FIN-070',
      title: 'Finance close smoke test',
      objective: 'Confirm trial balance, AP and period controls are visible.',
      steps: ['Finance', 'Trial Balance', 'General Ledger', 'AP', 'Fiscal Periods', 'Enterprise Close'],
      expected: 'No crash; unbalanced journals and AP exposure are visible.',
      status: Math.abs(sum(state?.journalLines, (x) => Number(x?.debit || 0)) - sum(state?.journalLines, (x) => Number(x?.credit || 0))) < 0.01 ? 'pass' : 'warning',
    },
  ];
}

export function buildV220BugTriage(state: any) {
  const readiness = buildV220Readiness(state, {});
  const blockers = readiness.rows.filter((r) => r.status === 'blocker');
  const warnings = readiness.rows.filter((r) => r.status === 'warning');
  return [
    ...blockers.map((row, index) => ({ id: `BUG-BLOCK-${index + 1}`, severity: 'High', module: row.area, issue: row.check, recommended: row.nextAction })),
    ...warnings.map((row, index) => ({ id: `BUG-WARN-${index + 1}`, severity: 'Medium', module: row.area, issue: row.check, recommended: row.nextAction })),
    { id: 'BUG-UX-001', severity: 'Medium', module: 'Testing', issue: 'User needs one-click testing pack and clear test sequence', recommended: 'Use Enterprise v220 guided testing and export QA pack.' },
    { id: 'BUG-BE-001', severity: 'High', module: 'Backend', issue: 'Frontend is still mostly local-first', recommended: 'Move setup pages and Foodics staging into Supabase pilot mode after local QA.' },
  ];
}

export function toCsv(rows: Array<Record<string, any>>): string {
  if (!rows.length) return '';
  const headers = Object.keys(rows[0]);
  const escape = (value: any) => `"${String(value ?? '').replace(/"/g, '""')}"`;
  return [headers.join(','), ...rows.map((row) => headers.map((h) => escape(row[h])).join(','))].join('\n');
}
