export type V87Severity = 'good' | 'warn' | 'bad' | 'info';

export type V87Check = {
  area: string;
  control: string;
  status: V87Severity;
  score: number;
  detail: string;
  action: string;
};

const arr = (v: unknown): any[] => Array.isArray(v) ? v : [];
const sum = (rows: any[], fn: (row: any) => number) => rows.reduce((total, row) => total + (Number(fn(row)) || 0), 0);

export function money(value: number) {
  return `${(Number(value) || 0).toLocaleString(undefined, { maximumFractionDigits: 2 })} SAR`;
}

export function pct(value: number) {
  return `${Math.round((Number(value) || 0) * 100)}%`;
}

export function getAverageCost(state: any, itemId: string) {
  const movements = arr(state?.stockMovements).filter((m) => m.itemId === itemId && m.direction === 'in' && Number(m.unitCost) > 0 && Number(m.qty) > 0);
  const qty = sum(movements, (m) => Number(m.qty));
  const value = sum(movements, (m) => Number(m.qty) * Number(m.unitCost));
  return qty > 0 ? value / qty : 0;
}

export function getStockByItemStore(state: any) {
  const rows = new Map<string, { storeId: string; itemId: string; qty: number; value: number }>();
  for (const movement of arr(state?.stockMovements)) {
    const key = `${movement.storeId}::${movement.itemId}`;
    const current = rows.get(key) ?? { storeId: movement.storeId, itemId: movement.itemId, qty: 0, value: 0 };
    const signedQty = movement.direction === 'in' ? Number(movement.qty) || 0 : -(Number(movement.qty) || 0);
    current.qty += signedQty;
    current.value += signedQty * (Number(movement.unitCost) || getAverageCost(state, movement.itemId));
    rows.set(key, current);
  }
  return Array.from(rows.values());
}

export function calculateV87Readiness(state: any, totals: any) {
  const journals = arr(state?.journals);
  const postedJournals = journals.filter((j) => j.status === 'posted');
  const unbalancedJournals = journals.filter((j) => {
    const debit = sum(arr(j.lines), (l) => Number(l.debit));
    const credit = sum(arr(j.lines), (l) => Number(l.credit));
    return Math.abs(debit - credit) > 0.01;
  });
  const stockRows = getStockByItemStore(state);
  const negativeStock = stockRows.filter((r) => r.qty < -0.0001);
  const zeroCostStock = stockRows.filter((r) => r.qty > 0 && getAverageCost(state, r.itemId) <= 0);
  const suppliers = arr(state?.suppliers);
  const weakSuppliers = suppliers.filter((s) => !s.vatNo || !s.bankAccount || !s.representativeName || !s.representativePhone);
  const recipeLines = arr(state?.recipeLines);
  const menuItems = arr(state?.menuItems);
  const missingRecipeMenu = menuItems.filter((m) => !recipeLines.some((r) => r.menuItemId === m.id));
  const periods = arr(state?.fiscalPeriods);
  const openPeriods = periods.filter((p) => p.status !== 'closed' && p.status !== 'locked');
  const approvals = arr(state?.inventoryApprovals).filter((a) => a.status === 'pending');
  const foodicsBatches = arr(state?.foodicsBatches ?? state?.foodicsBatchRegister);
  const postedFoodics = foodicsBatches.filter((b) => String(b.status || '').includes('posted'));
  const payments = arr(state?.supplierPayments).filter((p) => p.status === 'posted');
  const invoices = arr(state?.purchaseInvoices).filter((p) => p.status === 'posted');
  const invoiceTotal = sum(invoices, (inv) => sum(arr(inv.lines), (l) => (Number(l.qty) * Number(l.unitCost) * (1 + (Number(l.vatRate) || 0) / 100)) - (Number(l.discount) || 0)));
  const paymentTotal = sum(payments, (p) => Number(p.amount));
  const apBalance = Math.max(0, invoiceTotal - paymentTotal);
  const checks: V87Check[] = [
    {
      area: 'Finance',
      control: 'Balanced journal control',
      status: unbalancedJournals.length ? 'bad' : 'good',
      score: unbalancedJournals.length ? 0 : 10,
      detail: `${unbalancedJournals.length} unbalanced journals found out of ${journals.length}`,
      action: unbalancedJournals.length ? 'Open Finance > Journal Register and correct/reverse unbalanced drafts.' : 'Keep posting through controlled journal engine.',
    },
    {
      area: 'Finance',
      control: 'Open fiscal period readiness',
      status: openPeriods.length ? 'good' : 'bad',
      score: openPeriods.length ? 10 : 0,
      detail: `${openPeriods.length} open/available fiscal periods`,
      action: openPeriods.length ? 'Use period locks before month close.' : 'Create current fiscal period before posting transactions.',
    },
    {
      area: 'Inventory',
      control: 'Negative stock protection',
      status: negativeStock.length ? 'bad' : 'good',
      score: negativeStock.length ? 2 : 10,
      detail: `${negativeStock.length} negative item/store balances`,
      action: negativeStock.length ? 'Post opening stock, purchase receipts, transfers, or reverse wrong issues.' : 'Enable negative-stock block before backend launch.',
    },
    {
      area: 'Inventory',
      control: 'Zero-cost stock protection',
      status: zeroCostStock.length ? 'warn' : 'good',
      score: zeroCostStock.length ? 5 : 10,
      detail: `${zeroCostStock.length} positive stock balances with zero/unknown cost`,
      action: zeroCostStock.length ? 'Post purchase invoice or opening stock with cost before full ERP sales posting.' : 'Stock can support COGS calculation.',
    },
    {
      area: 'Foodics',
      control: 'Foodics batch posting visibility',
      status: postedFoodics.length ? 'good' : 'warn',
      score: postedFoodics.length ? 10 : 6,
      detail: `${postedFoodics.length} posted Foodics batches in local register`,
      action: postedFoodics.length ? 'Reconcile Foodics sales to payments and VAT.' : 'Run report-only or sales-accounting-only posting for a sample Foodics batch.',
    },
    {
      area: 'Recipes',
      control: 'Menu recipe coverage',
      status: missingRecipeMenu.length ? 'warn' : 'good',
      score: missingRecipeMenu.length ? 5 : 10,
      detail: `${missingRecipeMenu.length} menu items without recipe lines`,
      action: missingRecipeMenu.length ? 'Import Foodics ingredient file or create recipe versions before full ERP posting.' : 'Recipes are ready for theoretical costing.',
    },
    {
      area: 'Purchasing',
      control: 'AP/payment visibility',
      status: apBalance > 0 ? 'warn' : 'good',
      score: apBalance > 0 ? 7 : 10,
      detail: `Estimated AP balance is ${money(apBalance)}`,
      action: apBalance > 0 ? 'Review AP aging and payment run before finance close.' : 'No estimated AP exposure in local data.',
    },
    {
      area: 'Master Data',
      control: 'Supplier compliance data',
      status: weakSuppliers.length ? 'warn' : 'good',
      score: weakSuppliers.length ? 6 : 10,
      detail: `${weakSuppliers.length} suppliers missing VAT/bank/representative details`,
      action: weakSuppliers.length ? 'Complete supplier VAT, bank, representative name and representative phone.' : 'Supplier master data looks controlled.',
    },
    {
      area: 'Approvals',
      control: 'Pending inventory approvals',
      status: approvals.length ? 'warn' : 'good',
      score: approvals.length ? 6 : 10,
      detail: `${approvals.length} pending inventory approval requests`,
      action: approvals.length ? 'Approve/reject monthly stock count variance before inventory close.' : 'No pending inventory variance approvals.',
    },
    {
      area: 'Backend',
      control: 'Production launch readiness',
      status: 'bad',
      score: 3,
      detail: 'Still local-first; database/auth/RLS/server posting not active yet.',
      action: 'Start Supabase backend foundation after local close cycle is validated.',
    },
  ];
  const score = Math.round(sum(checks, (c) => c.score) / Math.max(1, checks.length) * 10);
  return { checks, score, negativeStock, zeroCostStock, weakSuppliers, missingRecipeMenu, apBalance, postedJournals: postedJournals.length };
}

export function buildV87ActionPlan(state: any, totals: any) {
  const readiness = calculateV87Readiness(state, totals);
  return readiness.checks
    .filter((c) => c.status !== 'good')
    .map((c, index) => ({
      priority: index + 1,
      area: c.area,
      issue: c.control,
      severity: c.status,
      action: c.action,
      owner: c.area === 'Backend' ? 'System Admin / Developer' : c.area === 'Finance' ? 'Finance Manager' : c.area === 'Inventory' ? 'Storekeeper / Operations' : c.area === 'Foodics' ? 'Operations / Finance' : 'Module Owner',
    }));
}

export function makeCsv(name: string, rows: Record<string, unknown>[]) {
  const headers = Array.from(rows.reduce<Set<string>>((set, row) => {
    Object.keys(row).forEach((key) => set.add(key));
    return set;
  }, new Set<string>()));
  const escape = (value: unknown) => `"${String(value ?? '').replace(/"/g, '""')}"`;
  const csv = [headers.join(','), ...rows.map((row) => headers.map((h) => escape(row[h])).join(','))].join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}
