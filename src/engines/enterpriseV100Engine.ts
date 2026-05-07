export type V100Tone = 'good' | 'warn' | 'bad' | 'info';

function arr(value: unknown): any[] {
  return Array.isArray(value) ? value : [];
}

function num(value: unknown): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function money(value: number): string {
  return new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(Number(value) || 0) + ' SAR';
}

export function sum(rows: any[], fn: (row: any) => number): number {
  return rows.reduce((total, row) => total + (Number(fn(row)) || 0), 0);
}

export function downloadCsv(filename: string, rows: Record<string, unknown>[]) {
  const headers = rows.length ? Array.from(new Set(rows.flatMap((row) => Object.keys(row)))) : ['note'];
  const escape = (value: unknown) => `"${String(value ?? '').replace(/"/g, '""')}"`;
  const csv = [headers.join(','), ...(rows.length ? rows : [{ note: 'No rows' }]).map((row) => headers.map((header) => escape((row as any)[header])).join(','))].join('\n');
  const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export function buildV100Readiness(state: any, totals: any) {
  const branches = arr(state?.branches);
  const stores = arr(state?.stores);
  const suppliers = arr(state?.suppliers);
  const items = arr(state?.items);
  const menuItems = arr(state?.menuItems);
  const recipeLines = arr(state?.recipeLines);
  const stockMovements = arr(state?.stockMovements);
  const journals = arr(state?.journals);
  const postedJournals = journals.filter((j) => j.status === 'posted');
  const purchaseInvoices = arr(state?.purchaseInvoices);
  const purchaseOrders = arr(state?.purchaseOrders);
  const goodsReceipts = arr(state?.goodsReceipts);
  const supplierPayments = arr(state?.supplierPayments);
  const salesDocs = arr(state?.sales);
  const foodicsBatches = arr(state?.foodicsBatches ?? state?.foodicsBatchRegister ?? state?.foodicsBatchHistory);
  const inventoryApprovals = arr(state?.inventoryApprovals);
  const fiscalPeriods = arr(state?.fiscalPeriods);
  const roles = arr(state?.roles);
  const employees = arr(state?.employees);
  const bankReconLines = arr(state?.bankReconLines);
  const productionRecipes = arr(state?.productionRecipes);
  const productions = arr(state?.productions);

  const itemNames = new Map(items.map((item) => [item.id, item.nameEn ?? item.sku]));
  const storeNames = new Map(stores.map((store) => [store.id, store.nameEn ?? store.code]));

  const stockByItemStore = new Map<string, { itemId: string; storeId: string; qty: number; value: number }>();
  stockMovements.forEach((movement) => {
    const key = `${movement.storeId}::${movement.itemId}`;
    const current = stockByItemStore.get(key) ?? { itemId: movement.itemId, storeId: movement.storeId, qty: 0, value: 0 };
    const sign = movement.direction === 'in' ? 1 : -1;
    current.qty += sign * num(movement.qty);
    current.value += sign * num(movement.qty) * num(movement.unitCost);
    stockByItemStore.set(key, current);
  });
  const stockRows = [...stockByItemStore.values()].map((row) => ({
    ...row,
    itemName: itemNames.get(row.itemId) ?? row.itemId,
    storeName: storeNames.get(row.storeId) ?? row.storeId,
    avgCost: row.qty ? row.value / row.qty : 0,
  }));
  const negativeStock = stockRows.filter((row) => row.qty < -0.0001);
  const zeroCostStock = stockRows.filter((row) => row.qty > 0 && Math.abs(row.value) < 0.0001);
  const stockValue = sum(stockRows, (row) => row.value);

  const journalDebit = sum(postedJournals.flatMap((journal) => arr(journal.lines)), (line) => num(line.debit));
  const journalCredit = sum(postedJournals.flatMap((journal) => arr(journal.lines)), (line) => num(line.credit));
  const journalDifference = Math.abs(journalDebit - journalCredit);

  const missingRecipeMenu = menuItems.filter((menu) => !recipeLines.some((line) => line.menuItemId === menu.id));
  const suppliersMissingInfo = suppliers.filter((supplier) => !supplier.vatNo || !supplier.bankAccount || !supplier.representativeName);
  const duplicateSkus = findDuplicates(items.map((item) => item.sku).filter(Boolean));
  const duplicateAccounts = findDuplicates(arr(state?.chartAccounts).map((account) => account.code).filter(Boolean));
  const pendingApprovals = inventoryApprovals.filter((approval) => approval.status === 'pending');
  const postedFoodics = foodicsBatches.filter((batch) => String(batch.status ?? '').toLowerCase().includes('posted') || batch.postedAt);
  const unmatchedBank = bankReconLines.filter((line) => !line.matchedJournalRef && !line.matchedJournalId);
  const apExposure = Math.max(0, num(totals?.apBalance) || (sum(purchaseInvoices.filter((invoice) => invoice.status === 'posted'), (invoice) => invoice.lines ? sum(arr(invoice.lines), (line) => num(line.qty) * num(line.unitCost) * (1 + num(line.vatRate) / 100)) : 0) - sum(supplierPayments.filter((p) => p.status === 'posted'), (p) => num(p.amount))));

  const checks = [
    check('Backend', 'Supabase production backend', 'Local trial only; Auth/RLS/Edge Functions not active yet.', 'Build v101 backend foundation.', 'bad', 2),
    check('Finance', 'Balanced posted journals', journalDifference < 0.01 ? 'Posted journals are balanced.' : `Debit/credit difference ${journalDifference.toFixed(2)}.`, journalDifference < 0.01 ? 'Maintain period close discipline.' : 'Review unbalanced journals before close.', journalDifference < 0.01 ? 'good' : 'bad', journalDifference < 0.01 ? 9 : 2),
    check('Inventory', 'Negative stock protection', negativeStock.length ? `${negativeStock.length} item/store rows are negative.` : 'No negative stock rows detected.', negativeStock.length ? 'Post opening stock, transfers, GRN or correct recipe mappings.' : 'Enable hard negative-stock blocking in backend.', negativeStock.length ? 'bad' : 'good', negativeStock.length ? 3 : 8),
    check('Inventory', 'Zero-cost stock protection', zeroCostStock.length ? `${zeroCostStock.length} stock rows have quantity but zero value.` : 'No zero-cost stock exposure detected.', zeroCostStock.length ? 'Post purchase/opening cost before full COGS posting.' : 'Lock full ERP posting when costs are missing.', zeroCostStock.length ? 'warn' : 'good', zeroCostStock.length ? 5 : 8),
    check('Foodics', 'Foodics posting readiness', foodicsBatches.length ? `${foodicsBatches.length} Foodics batch rows/history detected.` : 'No Foodics batch registered in local state.', foodicsBatches.length ? 'Continue settlement and reversal testing.' : 'Upload Foodics sample, validate, approve and post.', foodicsBatches.length ? 'warn' : 'bad', foodicsBatches.length ? 6 : 3),
    check('Recipes', 'Recipe coverage', missingRecipeMenu.length ? `${missingRecipeMenu.length} menu items do not have recipe lines.` : 'Menu recipe coverage is complete for local data.', missingRecipeMenu.length ? 'Use menu import/recipe builder before full ERP posting.' : 'Add versioning and approval workflow.', missingRecipeMenu.length ? 'warn' : 'good', missingRecipeMenu.length ? 5 : 8),
    check('Purchasing', 'Procurement document chain', purchaseOrders.length && goodsReceipts.length && purchaseInvoices.length ? 'PO/GRN/invoice records detected.' : 'Procurement chain is incomplete in local data.', 'Add partial receiving, backorders and variance approval.', purchaseOrders.length && goodsReceipts.length && purchaseInvoices.length ? 'warn' : 'bad', purchaseOrders.length && goodsReceipts.length && purchaseInvoices.length ? 6 : 3),
    check('Finance', 'AP exposure', apExposure > 0 ? `AP exposure ${money(apExposure)}.` : 'No AP exposure detected.', apExposure > 0 ? 'Review AP aging and payment run before close.' : 'Confirm AP data is complete.', apExposure > 0 ? 'warn' : 'info', apExposure > 0 ? 6 : 5),
    check('Access', 'Role and permission coverage', roles.length ? `${roles.length} role(s) detected.` : 'No configured role detected.', roles.length ? 'Enforce permission checks on every sensitive action.' : 'Create owner/admin role and assign permissions.', roles.length ? 'warn' : 'bad', roles.length ? 6 : 2),
    check('Master Data', 'Supplier compliance profile', suppliersMissingInfo.length ? `${suppliersMissingInfo.length} suppliers are missing VAT/bank/representative information.` : 'Supplier compliance fields look complete.', suppliersMissingInfo.length ? 'Complete supplier files before AP/payment live use.' : 'Add attachment requirements and supplier approvals.', suppliersMissingInfo.length ? 'warn' : 'good', suppliersMissingInfo.length ? 5 : 8),
    check('Data Quality', 'Duplicate master codes', duplicateSkus.length || duplicateAccounts.length ? `Duplicates: ${duplicateSkus.length} SKU, ${duplicateAccounts.length} account.` : 'No duplicate SKU/account codes detected.', duplicateSkus.length || duplicateAccounts.length ? 'Clean duplicates and block future duplicates.' : 'Move duplicate checks to database unique constraints.', duplicateSkus.length || duplicateAccounts.length ? 'bad' : 'good', duplicateSkus.length || duplicateAccounts.length ? 2 : 9),
    check('Close', 'Fiscal period setup', fiscalPeriods.length ? `${fiscalPeriods.length} fiscal period(s) configured.` : 'No fiscal periods configured.', fiscalPeriods.length ? 'Add module close status by period.' : 'Create current period and define lock rules.', fiscalPeriods.length ? 'warn' : 'bad', fiscalPeriods.length ? 6 : 2),
    check('HR', 'People readiness', employees.length ? `${employees.length} employee(s) in local data.` : 'HR is still scaffold-level.', 'Build payroll/attendance later after backend stabilization.', employees.length ? 'info' : 'warn', employees.length ? 5 : 3),
    check('Production', 'Prep/manufacturing readiness', productionRecipes.length ? `${productionRecipes.length} production recipe(s) detected.` : 'No production recipes detected.', productions.length ? 'Add lot traceability and yield variance.' : 'Add production batches, approval, yield variance and expiry.', productionRecipes.length ? 'warn' : 'info', productionRecipes.length ? 6 : 4),
  ];

  const score = Math.round(sum(checks, (row) => row.score) / Math.max(1, checks.length) * 10);
  return {
    score,
    checks,
    counts: {
      branches: branches.length,
      stores: stores.length,
      suppliers: suppliers.length,
      items: items.length,
      menuItems: menuItems.length,
      recipeLines: recipeLines.length,
      stockMovements: stockMovements.length,
      journals: journals.length,
      postedJournals: postedJournals.length,
      purchaseInvoices: purchaseInvoices.length,
      purchaseOrders: purchaseOrders.length,
      goodsReceipts: goodsReceipts.length,
      supplierPayments: supplierPayments.length,
      salesDocs: salesDocs.length,
      foodicsBatches: foodicsBatches.length,
      postedFoodics: postedFoodics.length,
      pendingApprovals: pendingApprovals.length,
      fiscalPeriods: fiscalPeriods.length,
      roles: roles.length,
      employees: employees.length,
    },
    stockRows,
    negativeStock,
    zeroCostStock,
    missingRecipeMenu,
    suppliersMissingInfo,
    duplicateSkus,
    duplicateAccounts,
    pendingApprovals,
    unmatchedBank,
    stockValue,
    journalDebit,
    journalCredit,
    journalDifference,
    apExposure,
    salesRevenue: num(totals?.salesRevenue),
    grossProfit: num(totals?.grossProfit),
    backendReadiness: 40,
    productionReadiness: 48,
    prototypeReadiness: 92,
  };
}

function check(area: string, control: string, detail: string, action: string, status: V100Tone, score: number) {
  return { area, control, detail, action, status, score };
}

function findDuplicates(values: string[]) {
  const seen = new Set<string>();
  const duplicates = new Set<string>();
  values.forEach((value) => {
    const key = String(value).trim().toLowerCase();
    if (!key) return;
    if (seen.has(key)) duplicates.add(value);
    seen.add(key);
  });
  return [...duplicates];
}

export function buildV100Roadmap() {
  return [
    { version: 'v88', title: 'Backend architecture design', deliverable: 'Supabase schema/RLS/Edge Function blueprint', status: 'Included in v100 blueprint' },
    { version: 'v89', title: 'Posting engine hardening', deliverable: 'Central posting guard map for all high-risk documents', status: 'Included in v100 controls' },
    { version: 'v90', title: 'Permission enforcement matrix', deliverable: 'Critical action map and maker-checker requirement', status: 'Included in v100 controls' },
    { version: 'v91', title: 'Inventory close pack', deliverable: 'Stock count, negative/zero-cost, FEFO and transfer readiness', status: 'Included in v100 controls' },
    { version: 'v92', title: 'Foodics settlement pack', deliverable: 'Cash, card, delivery app, internal settlement workflow', status: 'Included in v100 controls' },
    { version: 'v93', title: 'Finance close pack', deliverable: 'AP/AR/VAT/bank/journals/month close readiness', status: 'Included in v100 controls' },
    { version: 'v94', title: 'Procurement variance pack', deliverable: 'PO/GRN/invoice price and quantity variance controls', status: 'Included in v100 controls' },
    { version: 'v95', title: 'Production traceability roadmap', deliverable: 'Raw lot → prep batch → final sale traceability plan', status: 'Included in v100 controls' },
    { version: 'v96', title: 'Report factory', deliverable: 'Board/CFO/operations report catalogue', status: 'Included in v100 controls' },
    { version: 'v97', title: 'Data quality governance', deliverable: 'Duplicate/orphan/missing data checks', status: 'Included in v100 controls' },
    { version: 'v98', title: 'UI polish roadmap', deliverable: 'Drawers, timelines, attachments, saved views, Arabic polish', status: 'Included in v100 controls' },
    { version: 'v99', title: 'QA readiness', deliverable: 'Regression suite and production-readiness checklist', status: 'Included in v100 controls' },
    { version: 'v100', title: 'Enterprise production readiness cockpit', deliverable: 'Unified operating suite with launch score and next backend plan', status: 'Delivered in this patch' },
  ];
}

export function buildV100BackendPlan() {
  return [
    { wave: '1', layer: 'Auth & tenancy', deliverable: 'Supabase Auth, profiles, branch/store/cost-center scope', priority: 'Critical', owner: 'Platform' },
    { wave: '1', layer: 'Core schema', deliverable: 'Branches, stores, suppliers, items, recipes, COA, fiscal periods', priority: 'Critical', owner: 'Platform + Finance' },
    { wave: '1', layer: 'RLS', deliverable: 'Role/scope policies and admin break-glass function', priority: 'Critical', owner: 'Security' },
    { wave: '2', layer: 'Foodics staging', deliverable: 'Import batches, source rows, mappings, validation issues, approvals', priority: 'High', owner: 'Operations' },
    { wave: '2', layer: 'Posting functions', deliverable: 'Server-side Foodics, stock count, purchase, journal and payment posting', priority: 'Critical', owner: 'Finance + Platform' },
    { wave: '2', layer: 'Audit triggers', deliverable: 'Immutable row-level before/after audit trail', priority: 'Critical', owner: 'Audit' },
    { wave: '3', layer: 'Storage buckets', deliverable: 'PO, GRN, invoices, payment proofs, journals, supplier docs, stock counts', priority: 'High', owner: 'Operations' },
    { wave: '3', layer: 'Backups & monitoring', deliverable: 'Daily backup, restore test, error logs, import recovery', priority: 'High', owner: 'IT' },
  ];
}

export function buildV100ReportFactory() {
  return [
    { pack: 'Owner Executive Pack', reports: 'Sales, gross profit, cash, inventory value, AP, close score, exceptions', format: 'PDF + Excel', priority: 'High' },
    { pack: 'CFO Monthly Close Pack', reports: 'Trial balance, P&L, balance sheet, AP/AR aging, VAT, bank exceptions', format: 'Excel + PDF', priority: 'High' },
    { pack: 'Foodics Settlement Pack', reports: 'Orders vs payments, cash, MADA, delivery apps, refunds, voids, VAT', format: 'Excel', priority: 'High' },
    { pack: 'Inventory Control Pack', reports: 'Opening stock, count variance, negative/zero cost, expiry, slow moving, valuation', format: 'Excel', priority: 'High' },
    { pack: 'Menu Engineering Pack', reports: 'Top items, low margin items, theoretical cost, actual variance, pricing alerts', format: 'Dashboard + Excel', priority: 'Medium' },
    { pack: 'Procurement Pack', reports: 'Supplier spend, PO/GRN/invoice variance, price variance, due payments', format: 'Excel', priority: 'Medium' },
  ];
}

export function buildV100QaSuite() {
  return [
    { test: 'Empty app boot', expected: 'Dashboard loads without white page; error boundary active', priority: 'Critical' },
    { test: 'Setup bootstrap import', expected: 'Branches/stores/items/cost centers imported or created', priority: 'Critical' },
    { test: 'Opening stock upload', expected: 'Stock movements and values created; unknown SKU auto-create works only when enabled', priority: 'Critical' },
    { test: 'Monthly stock count', expected: 'Count sheet generated, uploaded, variance approval created, approval posts stock/GL', priority: 'Critical' },
    { test: 'Foodics native menu import', expected: 'Products/ingredients/modifiers detected and menu/recipes created', priority: 'Critical' },
    { test: 'Foodics sales upload', expected: 'Headers/lines/payments detected, mapped and validated', priority: 'Critical' },
    { test: 'Sales accounting-only posting', expected: 'Posts revenue/VAT/payment clearing even when recipes are missing', priority: 'High' },
    { test: 'Full ERP posting', expected: 'Blocks missing recipe/cost/stock; posts sales/COGS/stock when ready', priority: 'Critical' },
    { test: 'Controlled reversal', expected: 'Reversal reason required; original history retained; opposite journals/stock created', priority: 'High' },
    { test: 'Finance close', expected: 'Trial balance balanced, AP/VAT/bank exceptions visible', priority: 'High' },
    { test: 'Enterprise v100 exports', expected: 'Control pack, roadmap, backend plan and QA suite export without crash', priority: 'Medium' },
  ];
}
