export type V120Tone = 'good' | 'warn' | 'bad' | 'info';

function arr(value: unknown): any[] { return Array.isArray(value) ? value : []; }
function num(value: unknown): number { const parsed = Number(value); return Number.isFinite(parsed) ? parsed : 0; }
export function money(value: number): string { return new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(Number(value) || 0) + ' SAR'; }
export function downloadCsv(filename: string, rows: Record<string, unknown>[]) {
  const source = rows.length ? rows : [{ note: 'No rows' }];
  const headers = Array.from(new Set(source.flatMap((row) => Object.keys(row))));
  const escape = (value: unknown) => `"${String(value ?? '').replace(/"/g, '""')}"`;
  const csv = [headers.join(','), ...source.map((row) => headers.map((header) => escape((row as any)[header])).join(','))].join('\n');
  const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url; link.download = filename; document.body.appendChild(link); link.click(); document.body.removeChild(link); URL.revokeObjectURL(url);
}
function duplicates(values: string[]) { const seen = new Set<string>(); const duplicate = new Set<string>(); values.filter(Boolean).forEach((value) => { if (seen.has(value)) duplicate.add(value); seen.add(value); }); return Array.from(duplicate); }
function sum(rows: any[], fn: (row: any) => number): number { return rows.reduce((total, row) => total + num(fn(row)), 0); }
function check(area: string, title: string, status: V120Tone, score: number, evidence: string, action: string) { return { area, title, status, score, evidence, action }; }

export function buildV120Readiness(state: any, totals: any) {
  const branches = arr(state?.branches); const stores = arr(state?.stores); const suppliers = arr(state?.suppliers); const items = arr(state?.items); const menuItems = arr(state?.menuItems); const recipeLines = arr(state?.recipeLines); const stockMovements = arr(state?.stockMovements); const journals = arr(state?.journals); const purchaseInvoices = arr(state?.purchaseInvoices); const purchaseOrders = arr(state?.purchaseOrders); const goodsReceipts = arr(state?.goodsReceipts); const supplierPayments = arr(state?.supplierPayments); const inventoryApprovals = arr(state?.inventoryApprovals); const foodicsBatches = arr(state?.foodicsBatches ?? state?.foodicsBatchRegister ?? state?.foodicsBatchHistory); const fiscalPeriods = arr(state?.fiscalPeriods); const roles = arr(state?.roles); const employees = arr(state?.employees); const productions = arr(state?.productions); const productionRecipes = arr(state?.productionRecipes); const binLocations = arr(state?.binLocations); const inventoryLots = arr(state?.inventoryLots); const chartAccounts = arr(state?.chartAccounts); const bankReconLines = arr(state?.bankReconLines);
  const itemNames = new Map(items.map((item) => [item.id, item.nameEn ?? item.sku ?? item.id]));
  const storeNames = new Map(stores.map((store) => [store.id, store.nameEn ?? store.code ?? store.id]));
  const stockMap = new Map<string, { itemId: string; storeId: string; qty: number; value: number }>();
  stockMovements.forEach((m) => { const key = `${m.storeId}::${m.itemId}`; const row = stockMap.get(key) ?? { itemId: m.itemId, storeId: m.storeId, qty: 0, value: 0 }; const sign = m.direction === 'in' ? 1 : -1; row.qty += sign * num(m.qty); row.value += sign * num(m.qty) * num(m.unitCost); stockMap.set(key, row); });
  const stockRows = [...stockMap.values()].map((row) => ({ ...row, itemName: itemNames.get(row.itemId) ?? row.itemId, storeName: storeNames.get(row.storeId) ?? row.storeId, avgCost: row.qty ? row.value / row.qty : 0 }));
  const negativeStock = stockRows.filter((row) => row.qty < -0.0001); const zeroCostStock = stockRows.filter((row) => row.qty > 0.0001 && Math.abs(row.value) < 0.0001); const stockValue = sum(stockRows, (row) => row.value);
  const postedJournals = journals.filter((j) => j.status === 'posted'); const journalLines = postedJournals.flatMap((journal) => arr(journal.lines)); const debit = sum(journalLines, (line) => line.debit); const credit = sum(journalLines, (line) => line.credit); const journalDiff = Math.abs(debit - credit);
  const missingRecipes = menuItems.filter((menu) => !recipeLines.some((line) => line.menuItemId === menu.id)); const duplicateSkus = duplicates(items.map((item) => String(item.sku ?? '')).filter(Boolean)); const duplicateAccounts = duplicates(chartAccounts.map((account) => String(account.code ?? '')).filter(Boolean)); const suppliersMissingCompliance = suppliers.filter((supplier) => !supplier.vatNo || !supplier.bankAccount || !supplier.representativeName || !supplier.representativePhone); const pendingInventoryApprovals = inventoryApprovals.filter((approval) => approval.status === 'pending'); const unmatchedBank = bankReconLines.filter((line) => !line.matchedJournalRef && !line.matchedJournalId); const foodicsPosted = foodicsBatches.filter((batch) => String(batch.status ?? '').toLowerCase().includes('posted') || batch.postedAt);
  const backendReady = false; const apExposure = num(totals?.ap) || num(totals?.apBalance) || Math.max(0, sum(purchaseInvoices.filter((i) => i.status === 'posted'), (invoice) => sum(arr(invoice.lines), (line) => num(line.qty) * num(line.unitCost) * (1 + num(line.vatRate) / 100))) - sum(supplierPayments.filter((p) => p.status === 'posted'), (p) => p.amount));
  const checks = [
    check('Backend', 'Supabase/Auth/RLS production foundation', backendReady ? 'good' : 'bad', backendReady ? 9 : 2, backendReady ? 'Backend is active.' : 'Current package is still local-first. Production backend is not active.', 'Start v121 Supabase foundation: Auth, database, RLS, storage, audit and posting Edge Functions.'),
    check('Accounting', 'Posted journal balance', journalDiff < 0.01 ? 'good' : 'bad', journalDiff < 0.01 ? 9 : 2, journalDiff < 0.01 ? 'Posted journal debit/credit are balanced.' : `Journal difference is ${journalDiff.toFixed(2)}.`, 'Block period close when journals are unbalanced.'),
    check('Inventory', 'Negative stock protection', negativeStock.length ? 'bad' : 'good', negativeStock.length ? 3 : 8, negativeStock.length ? `${negativeStock.length} item/store balances are negative.` : 'No negative balances detected in local stock map.', 'Enable hard negative-stock blocking and transfer in-transit status.'),
    check('Inventory', 'Zero-cost stock protection', zeroCostStock.length ? 'warn' : 'good', zeroCostStock.length ? 5 : 8, zeroCostStock.length ? `${zeroCostStock.length} item/store balances have stock value exposure with zero cost.` : 'No zero-cost stock exposure detected.', 'Require opening or purchase cost before full ERP posting.'),
    check('Foodics', 'Foodics batch readiness', foodicsBatches.length ? 'warn' : 'bad', foodicsBatches.length ? 6 : 3, foodicsBatches.length ? `${foodicsBatches.length} Foodics batch rows/history detected.` : 'No Foodics batch currently registered.', 'Upload sample Foodics files and test posting/reversal before backend.'),
    check('Recipes', 'Recipe coverage', missingRecipes.length ? 'warn' : 'good', missingRecipes.length ? 5 : 8, missingRecipes.length ? `${missingRecipes.length} menu items have no recipe lines.` : 'Menu items have recipe line coverage in local data.', 'Add versioning/effective dates and branch-specific recipes.'),
    check('Procurement', 'PO/GRN/Invoice control', purchaseOrders.length && goodsReceipts.length && purchaseInvoices.length ? 'warn' : 'bad', purchaseOrders.length && goodsReceipts.length && purchaseInvoices.length ? 6 : 3, `PO: ${purchaseOrders.length}, GRN: ${goodsReceipts.length}, Supplier invoices: ${purchaseInvoices.length}.`, 'Add strict partial receipt, backorder and variance enforcement.'),
    check('Data Quality', 'Duplicate SKU/account control', duplicateSkus.length || duplicateAccounts.length ? 'bad' : 'good', duplicateSkus.length || duplicateAccounts.length ? 3 : 8, duplicateSkus.length || duplicateAccounts.length ? `Duplicate SKUs: ${duplicateSkus.join('; ') || 'none'}, duplicate accounts: ${duplicateAccounts.join('; ') || 'none'}.` : 'No duplicate SKU/account detected.', 'Block duplicate master data in import staging.'),
    check('Suppliers', 'Supplier compliance master data', suppliersMissingCompliance.length ? 'warn' : 'good', suppliersMissingCompliance.length ? 5 : 8, suppliersMissingCompliance.length ? `${suppliersMissingCompliance.length} suppliers missing VAT/bank/representative details.` : 'Supplier compliance fields look complete.', 'Require supplier VAT, bank and representative before PO/payment approval.'),
    check('People', 'HR/payroll readiness', employees.length ? 'warn' : 'bad', employees.length ? 5 : 2, employees.length ? `${employees.length} employees available for workflow testing.` : 'No employee master data loaded.', 'Build employee documents, schedules, attendance correction and payroll posting.'),
    check('Production', 'Prep kitchen traceability', productionRecipes.length && productions.length ? 'warn' : 'bad', productionRecipes.length && productions.length ? 6 : 3, `Production recipes: ${productionRecipes.length}, production batches: ${productions.length}.`, 'Add raw lot → produced lot → final sale traceability and yield variance.'),
    check('Storage', 'Lots/bins foundation', inventoryLots.length && binLocations.length ? 'warn' : 'bad', inventoryLots.length && binLocations.length ? 6 : 3, `Lots: ${inventoryLots.length}, bins: ${binLocations.length}.`, 'Add FEFO and bin-level count/scanning in backend.'),
  ];
  const critical = checks.filter((c) => c.status === 'bad'); const warnings = checks.filter((c) => c.status === 'warn'); const readinessScore = Math.round(checks.reduce((total, c) => total + c.score, 0) / checks.length * 10); const localPrototypeScore = 92; const foundationScore = Math.min(85, Math.round(readinessScore * 0.62 + 28)); const productionScore = Math.min(56, Math.round(readinessScore * 0.35 + (backendReady ? 35 : 14))); const backendScore = backendReady ? 75 : 43;
  return { readinessScore, localPrototypeScore, foundationScore, productionScore, backendScore, checks, critical, warnings, negativeStock, zeroCostStock, missingRecipes, pendingInventoryApprovals, unmatchedBank, suppliersMissingCompliance, stockRows, stockValue, debit, credit, journalDiff, apExposure, foodicsBatches, foodicsPosted, counts: { branches: branches.length, stores: stores.length, items: items.length, menuItems: menuItems.length, recipeLines: recipeLines.length, stockMovements: stockMovements.length, journals: journals.length, purchaseOrders: purchaseOrders.length, purchaseInvoices: purchaseInvoices.length, goodsReceipts: goodsReceipts.length, supplierPayments: supplierPayments.length, fiscalPeriods: fiscalPeriods.length, roles: roles.length, employees: employees.length, productions: productions.length, productionRecipes: productionRecipes.length } };
}

export function buildV120Program() {
  return ['Backend schema foundation','Auth + tenancy + RLS','Posting Edge Functions','Foodics staging backend','Inventory costing engine','Transfer lifecycle','Finance close controls','Purchasing variance engine','Recipe versioning','Production traceability','Foodics settlement pack','Board report factory','Attachment vault','Data migration center','Permission enforcement','UI design system','HR readiness','QA automation','Deployment playbook','Production Boardroom Cockpit'].map((theme, i) => ({ version: `v${101 + i}`, theme, deliverable: [
    'Production PostgreSQL table map for branches, stores, items, Foodics staging, inventory, GL, AP/AR, approvals and audit.',
    'Tenant/company, user, role, branch/store scope policies, and secure profile bootstrap.',
    'Server-side posting guard for Foodics, stock count, GRN, invoice, payment and journals.',
    'Import batches, row staging, mapping profiles, duplicate hash, posting status and reversal tables.',
    'Weighted average, lot status, FEFO proposal, available/reserved/in-transit/quarantine stock.',
    'Transfer request → approve → dispatch → receive, with in-transit balance and audit.',
    'Period close checklist, journal approval, AP/AR aging, bank reconciliation workbench.',
    'PR, quotations, PO, partial GRN, invoice match, variance rules and supplier returns.',
    'Recipe versions, approvals, effective dates, branch-specific recipes and cost history.',
    'Raw lot → production lot → sales traceability, expiry and yield variance.',
    'Cash, MADA, delivery apps, internal hospitality and refund settlement workflows.',
    'Excel/PDF board pack, CFO pack, Foodics settlement pack and inventory risk pack.',
    'Storage buckets, attachment policy, invoices/GRNs/payment proof/journal support.',
    'XLSX import, staged validation, approval, rollback, error files and import audit.',
    'Universal action guard, denied-action log, temporary access and delegation.',
    'Drawer forms, advanced tables, saved views, document timeline and Arabic polish.',
    'Employee docs, schedules, attendance correction, leave/overtime, payroll posting plan.',
    'Regression suites and acceptance checklists for all critical workflows.',
    'Environment variables, backup strategy, monitoring, release checklist and rollback plan.',
    'Combined production-readiness command center and next-action board.',
  ][i], status: i === 19 ? 'This patch' : 'Design ready' }));
}
export function buildV120BackendSchema() { return [
  { domain: 'Identity', object: 'companies, profiles, roles, permissions, user_roles, access_scopes', owner: 'Admin / Security', priority: 'Critical' },
  { domain: 'Master Data', object: 'branches, stores, bins, items, units, suppliers, customers, cost_centers', owner: 'Operations / Finance', priority: 'Critical' },
  { domain: 'Foodics', object: 'foodics_import_batches, foodics_order_headers, foodics_order_lines, foodics_payments, foodics_mappings', owner: 'Sales / IT', priority: 'Critical' },
  { domain: 'Inventory', object: 'stock_movements, inventory_lots, stock_counts, stock_count_lines, inventory_approvals, transfers', owner: 'Supply Chain', priority: 'Critical' },
  { domain: 'Finance', object: 'chart_accounts, journal_entries, journal_lines, fiscal_periods, ap_subledger, ar_subledger, bank_recon', owner: 'Finance', priority: 'Critical' },
  { domain: 'Purchasing', object: 'material_requests, purchase_requests, purchase_orders, goods_receipts, supplier_invoices, supplier_payments', owner: 'Procurement', priority: 'High' },
  { domain: 'Production', object: 'production_recipes, production_batches, production_lines, produced_lots', owner: 'Kitchen / Cost Control', priority: 'High' },
  { domain: 'Attachments', object: 'document_attachments, storage buckets, attachment_policies', owner: 'Admin / Finance', priority: 'High' },
  { domain: 'Audit', object: 'audit_events, denied_actions, posting_events, reversal_events', owner: 'Audit', priority: 'Critical' },
  { domain: 'Reports', object: 'materialized views for branch P&L, inventory value, AP aging, settlement, food cost', owner: 'BI / Finance', priority: 'Medium' },
]; }
export function buildV120QaSuite() { return [
  { flow: 'Boot safety', test: 'Open empty app, switch every route, confirm no white page.', expected: 'All pages render empty states safely.' },
  { flow: 'Setup bootstrap', test: 'Import branches, stores, items, cost centers and suppliers.', expected: 'Records created without duplicate code warnings.' },
  { flow: 'Foodics menu', test: 'Upload products, ingredients and modifiers.', expected: 'Menu items and recipes created; SKU auto-map works.' },
  { flow: 'Foodics sales', test: 'Upload order headers, order lines and payments.', expected: 'Validation cockpit shows clear blockers/warnings and issue drilldowns.' },
  { flow: 'Starter posting', test: 'Post Sales Accounting Only with missing recipes.', expected: 'Allowed; no inventory/COGS posting required.' },
  { flow: 'Full ERP posting', test: 'Add inventory/costs/recipes then post full ERP.', expected: 'Sales, VAT, COGS and stock movements generated.' },
  { flow: 'Reversal', test: 'Reverse posted Foodics batch with reason.', expected: 'Original history preserved and reversal entries created.' },
  { flow: 'Opening stock', test: 'Upload opening stock with unknown SKU auto-create enabled.', expected: 'Missing SKUs created for starter trial and stock posted.' },
  { flow: 'Monthly count', test: 'Generate count sheet, upload counted qty, approve variance.', expected: 'Shortage/surplus approvals and journals generated.' },
  { flow: 'Finance', test: 'Post balanced manual journal, view GL and trial balance.', expected: 'No debit/credit difference.' },
  { flow: 'Close cockpit', test: 'Open v120 board, export readiness and QA packs.', expected: 'CSV exports download and scores update from local state.' },
]; }
export function buildV120ReportFactory() { return [
  { report: 'Owner Executive Board Pack', format: 'PDF + Excel', sections: 'Sales, gross profit, stock risk, AP exposure, Foodics close, monthly close certificate' },
  { report: 'CFO Close Pack', format: 'Excel', sections: 'Trial balance, P&L, balance sheet, AP/AR aging, VAT, bank recon, journal exceptions' },
  { report: 'Foodics Settlement Pack', format: 'Excel', sections: 'Cash, card/MADA, delivery apps, internal hospitality, refunds, voids, payment differences' },
  { report: 'Inventory Control Pack', format: 'Excel', sections: 'Stock value, zero-cost stock, negative stock, lot/expiry exposure, count variance, in-transit stock' },
  { report: 'Food Cost Intelligence Pack', format: 'Excel + charts', sections: 'Theoretical vs actual, recipe cost, item margin, menu engineering, branch food cost trend' },
  { report: 'Procurement Pack', format: 'Excel', sections: 'Supplier spend, PO/GRN/invoice variance, AP due, price history, supplier returns' },
]; }
export function buildV120ScoreNotes() { return [
  { score: 'Local MVP / Prototype', value: '9.2 / 10', note: 'Strong workflow demonstration, error boundary, samples, Foodics, inventory and close controls.' },
  { score: 'Serious ERP Foundation', value: '8.2 / 10', note: 'Good architecture direction; needs real backend and enforcement.' },
  { score: 'Enterprise Design Direction', value: '8.7 / 10', note: 'Control layers are strong: Foodics, inventory, finance, purchasing, close, QA and launch plan.' },
  { score: 'Production Readiness', value: '5.0 / 10', note: 'Improved planning, but still local-first and not safe for live company books.' },
  { score: 'Backend/Security Readiness', value: '4.4 / 10', note: 'Blueprint exists. Implementation of Supabase Auth/RLS/Edge Functions is the real next milestone.' },
]; }
