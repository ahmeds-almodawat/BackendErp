export type QualityTone = 'ready' | 'warning' | 'danger' | 'info';

export type QualityCheck = {
  area: string;
  control: string;
  status: QualityTone;
  score: number;
  detail: string;
  nextStep: string;
};

export type LifecycleRow = {
  module: string;
  document: string;
  ref: string;
  status: string;
  risk: QualityTone;
  nextAction: string;
};

const arr = (value: unknown): any[] => Array.isArray(value) ? value : [];
const num = (value: unknown) => Number(value || 0);
const dateOnly = (value: unknown) => String(value || '').slice(0, 10);

export function sumJournalLines(state: any) {
  const journals = arr(state?.journals);
  const debit = journals.flatMap((j) => arr(j.lines)).reduce((s, l) => s + num(l.debit), 0);
  const credit = journals.flatMap((j) => arr(j.lines)).reduce((s, l) => s + num(l.credit), 0);
  return { debit, credit, diff: Math.round((debit - credit) * 100) / 100 };
}

export function getItemBalance(state: any, itemId: string, storeId?: string) {
  return arr(state?.stockMovements)
    .filter((m) => m.itemId === itemId && (!storeId || m.storeId === storeId))
    .reduce((s, m) => s + (m.direction === 'in' ? num(m.qty) : -num(m.qty)), 0);
}

export function getAverageCost(state: any, itemId: string) {
  const inbound = arr(state?.stockMovements).filter((m) => m.itemId === itemId && m.direction === 'in' && num(m.qty) > 0 && num(m.unitCost) > 0);
  const qty = inbound.reduce((s, m) => s + num(m.qty), 0);
  const value = inbound.reduce((s, m) => s + num(m.qty) * num(m.unitCost), 0);
  return qty > 0 ? value / qty : 0;
}

export function buildDocumentLifecycle(state: any): LifecycleRow[] {
  const rows: LifecycleRow[] = [];
  arr(state?.materialRequests).forEach((d) => rows.push({ module: 'Purchasing', document: 'Material Request', ref: d.ref || d.id, status: d.status || 'draft', risk: d.status === 'converted' ? 'ready' : 'warning', nextAction: d.status === 'converted' ? 'Monitor PO' : 'Approve / convert to PO' }));
  arr(state?.purchaseOrders).forEach((d) => rows.push({ module: 'Purchasing', document: 'Purchase Order', ref: d.ref || d.id, status: d.status || 'draft', risk: ['closed','received'].includes(d.status) ? 'ready' : 'warning', nextAction: ['closed','received'].includes(d.status) ? 'Match invoice' : 'Approve / receive / close' }));
  arr(state?.goodsReceipts).forEach((d) => rows.push({ module: 'Purchasing', document: 'GRN', ref: d.ref || d.id, status: d.status || 'draft', risk: d.status === 'posted' ? 'ready' : 'warning', nextAction: d.status === 'posted' ? 'Match supplier invoice' : 'Post GRN' }));
  arr(state?.purchaseInvoices).forEach((d) => rows.push({ module: 'Finance/AP', document: 'Supplier Invoice', ref: d.ref || d.invoiceNo || d.id, status: d.status || 'draft', risk: d.status === 'posted' ? 'ready' : 'warning', nextAction: d.status === 'posted' ? 'Schedule payment' : 'Post invoice' }));
  arr(state?.supplierPayments).forEach((d) => rows.push({ module: 'Finance/AP', document: 'Payment Voucher', ref: d.ref || d.id, status: d.status || 'draft', risk: d.status === 'posted' ? 'ready' : 'warning', nextAction: d.status === 'posted' ? 'Reconcile bank' : 'Post payment' }));
  arr(state?.productions).forEach((d) => rows.push({ module: 'Production', document: 'Production Batch', ref: d.ref || d.id, status: d.status || 'draft', risk: d.status === 'posted' ? 'ready' : 'warning', nextAction: d.status === 'posted' ? 'Trace output lot' : 'Approve / post production' }));
  arr(state?.sales).forEach((d) => rows.push({ module: 'Sales', document: 'Sales Batch / POS', ref: d.ref || d.id, status: d.posted ? 'posted' : 'draft', risk: d.posted ? 'ready' : 'warning', nextAction: d.posted ? 'Reconcile payment' : 'Post sales batch' }));
  arr(state?.journals).forEach((d) => rows.push({ module: 'Finance/GL', document: 'Journal Entry', ref: d.ref || d.id, status: d.status || 'draft', risk: d.status === 'posted' ? 'ready' : d.status === 'reversed' ? 'info' : 'warning', nextAction: d.status === 'posted' ? 'Include in close pack' : 'Review / post / reverse' }));
  arr(state?.inventoryApprovals).forEach((d) => rows.push({ module: 'Inventory', document: 'Inventory Approval', ref: d.ref || d.id, status: d.status || 'pending', risk: d.status === 'posted' ? 'ready' : 'warning', nextAction: d.status === 'posted' ? 'Closed' : 'Approve and post variance' }));
  return rows;
}

export function buildQualityChecks(state: any): QualityCheck[] {
  const checks: QualityCheck[] = [];
  const journals = arr(state?.journals);
  const unbalanced = journals.filter((j) => {
    const debit = arr(j.lines).reduce((s, l) => s + num(l.debit), 0);
    const credit = arr(j.lines).reduce((s, l) => s + num(l.credit), 0);
    return Math.abs(debit - credit) > 0.01;
  }).length;
  const periods = arr(state?.fiscalPeriods);
  const activePeriod = periods.find((p) => p.status === 'open');
  const roles = arr(state?.roles);
  const permissions = new Set(roles.flatMap((r) => arr(r.permissions)));
  const criticalPermissions = ['finance.journal.post','finance.period.lock','inventory.adjustment.approve','purchasing.grn.post','purchasing.payment.post','sales.post','access.manage'];
  const missingPerms = criticalPermissions.filter((p) => !permissions.has(p));
  const duplicatedSkus = findDuplicates(arr(state?.items).map((i) => i.sku).filter(Boolean));
  const duplicatedAccounts = findDuplicates(arr(state?.chartAccounts).map((a) => a.code).filter(Boolean));
  const orphanStores = arr(state?.stores).filter((s) => s.branchId !== 'main' && !arr(state?.branches).some((b) => b.id === s.branchId)).length;
  const recipeOrphans = arr(state?.recipeLines).filter((r) => !arr(state?.menuItems).some((m) => m.id === r.menuItemId) || !arr(state?.items).some((i) => i.id === r.itemId)).length;
  const missingSupplierControls = arr(state?.suppliers).filter((s) => !s.vatNo || !s.bankAccount || !s.representativeName).length;
  const itemBalances = arr(state?.items).map((item) => ({ item, balance: getItemBalance(state, item.id), cost: getAverageCost(state, item.id) }));
  const negativeStock = itemBalances.filter((r) => r.balance < -0.0001).length;
  const zeroCostStock = itemBalances.filter((r) => r.balance > 0.0001 && r.cost <= 0.0001).length;
  checks.push({ area: 'Finance', control: 'Balanced journals', status: unbalanced ? 'danger' : 'ready', score: unbalanced ? 45 : 100, detail: `${unbalanced} unbalanced journals`, nextStep: unbalanced ? 'Open Journal Register and repair entries before close.' : 'Keep enforcing debit = credit before post.' });
  checks.push({ area: 'Finance', control: 'Open fiscal period', status: activePeriod ? 'ready' : 'warning', score: activePeriod ? 100 : 60, detail: activePeriod ? `Open period: ${activePeriod.code || activePeriod.nameEn}` : 'No open period found', nextStep: activePeriod ? 'Use period lock after close approval.' : 'Create/open current fiscal period.' });
  checks.push({ area: 'Security', control: 'Critical permissions covered', status: missingPerms.length ? 'warning' : 'ready', score: Math.round(((criticalPermissions.length - missingPerms.length) / criticalPermissions.length) * 100), detail: `${missingPerms.length} critical permissions missing from roles`, nextStep: missingPerms.length ? 'Review Access Control and add missing role permissions.' : 'Move to universal button-level enforcement.' });
  checks.push({ area: 'Master Data', control: 'Unique SKU/account codes', status: duplicatedSkus.length || duplicatedAccounts.length ? 'danger' : 'ready', score: duplicatedSkus.length || duplicatedAccounts.length ? 50 : 100, detail: `${duplicatedSkus.length} duplicate SKUs, ${duplicatedAccounts.length} duplicate accounts`, nextStep: 'Block duplicate codes at import and edit.' });
  checks.push({ area: 'Master Data', control: 'Orphan relationships', status: orphanStores || recipeOrphans ? 'danger' : 'ready', score: orphanStores || recipeOrphans ? 55 : 100, detail: `${orphanStores} orphan stores, ${recipeOrphans} orphan recipe rows`, nextStep: 'Repair broken branch/store/item/menu references.' });
  checks.push({ area: 'Suppliers', control: 'Supplier compliance fields', status: missingSupplierControls ? 'warning' : 'ready', score: missingSupplierControls ? 70 : 100, detail: `${missingSupplierControls} suppliers missing VAT/bank/representative data`, nextStep: 'Complete supplier VAT, bank letter, and representative contact.' });
  checks.push({ area: 'Inventory', control: 'Negative stock prevention', status: negativeStock ? 'danger' : 'ready', score: negativeStock ? 40 : 100, detail: `${negativeStock} items have negative stock`, nextStep: 'Block postings that create negative stock unless override approved.' });
  checks.push({ area: 'Inventory', control: 'Zero-cost stock prevention', status: zeroCostStock ? 'warning' : 'ready', score: zeroCostStock ? 65 : 100, detail: `${zeroCostStock} positive-stock items have no cost`, nextStep: 'Post opening stock/purchase invoice with cost before full ERP posting.' });
  return checks;
}

export function buildPostingGuardRows(state: any) {
  const activePeriod = arr(state?.fiscalPeriods).find((p) => p.status === 'open');
  const checks = buildQualityChecks(state);
  const financeBlockers = checks.filter((c) => c.status === 'danger');
  return [
    { event: 'Foodics full ERP posting', required: 'Mapped branch, mapped item, mapped payment, recipe, available costed stock, open period', current: financeBlockers.length ? 'Blocked by critical quality issues' : 'Ready for controlled trial', action: 'Run Foodics validation and approve batch before posting' },
    { event: 'Stock count variance post', required: 'Approved count batch, open period, variance account, cost center', current: activePeriod ? 'Period available' : 'No open period', action: 'Approve from Inventory Approval Queue' },
    { event: 'Supplier payment post', required: 'Open invoice allocation, payment permission, open period, bank/cash account', current: activePeriod ? 'Guardable locally' : 'No open period', action: 'Use AP Payment Run / Supplier Payments' },
    { event: 'Manual journal post', required: 'Balanced lines, open period, journal permission', current: activePeriod ? 'Guardable locally' : 'No open period', action: 'Use Finance Manual Journal' },
    { event: 'Production batch post', required: 'Approved recipe, available raw stock, output item, open period', current: 'Needs stronger lifecycle enforcement', action: 'Next: production order approval + reversal' },
  ];
}

export function buildCloseReadiness(state: any) {
  const checks = buildQualityChecks(state);
  const score = Math.round(checks.reduce((s, c) => s + c.score, 0) / Math.max(checks.length, 1));
  const blockers = checks.filter((c) => c.status === 'danger');
  const warnings = checks.filter((c) => c.status === 'warning');
  return { score, blockers, warnings, ready: blockers.length === 0 && score >= 85 };
}

function findDuplicates(values: string[]) {
  const seen = new Set<string>();
  const dupes = new Set<string>();
  values.forEach((v) => { const key = String(v).trim().toLowerCase(); if (!key) return; if (seen.has(key)) dupes.add(v); seen.add(key); });
  return Array.from(dupes);
}

export function buildExportRows(state: any) {
  return [
    ...buildQualityChecks(state).map((c) => ({ section: 'quality_check', area: c.area, item: c.control, status: c.status, score: c.score, detail: c.detail, next_step: c.nextStep })),
    ...buildDocumentLifecycle(state).map((r) => ({ section: 'lifecycle', area: r.module, item: `${r.document} ${r.ref}`, status: r.status, score: r.risk === 'ready' ? 100 : r.risk === 'warning' ? 65 : 45, detail: r.nextAction, next_step: r.nextAction })),
  ];
}
