export type V240Severity = 'critical' | 'warning' | 'ready' | 'info';
export type V240StepStatus = 'not_started' | 'in_progress' | 'done' | 'blocked';

export type V240WizardStep = {
  id: string;
  phase: string;
  titleEn: string;
  titleAr: string;
  owner: string;
  module: string;
  requiredFiles: string[];
  expectedResultEn: string;
  expectedResultAr: string;
  validationEn: string;
  validationAr: string;
  status: V240StepStatus;
  blockers: string[];
};

const asArray = <T = any>(value: unknown): T[] => Array.isArray(value) ? value as T[] : [];
const n = (value: unknown) => Number(value || 0) || 0;
const sum = (rows: any[], picker: (row: any) => number) => rows.reduce((acc, row) => acc + picker(row), 0);
const byStatus = (rows: any[], status: string) => rows.filter((r) => String(r.status || '').toLowerCase() === status).length;
const uniqueCount = (rows: any[], key: string) => new Set(rows.map((row) => row?.[key]).filter(Boolean)).size;

export function buildV240Snapshot(state: any, totals: any) {
  const branches = asArray(state?.branches);
  const stores = asArray(state?.stores);
  const items = asArray(state?.items);
  const suppliers = asArray(state?.suppliers);
  const menuItems = asArray(state?.menuItems);
  const recipes = asArray(state?.recipeLines);
  const stock = asArray(state?.stockMovements);
  const journals = asArray(state?.journals);
  const approvals = asArray(state?.inventoryApprovals);
  const audits = asArray(state?.audits);
  const foodicsBatches = asArray(state?.foodicsBatches || state?.foodicsImportBatches || state?.salesBatches);
  const invoices = asArray(state?.purchaseInvoices);
  const payments = asArray(state?.supplierPayments);
  const countApprovals = approvals.filter((a) => String(a.type || a.reason || '').toLowerCase().includes('count') || String(a.ref || '').toLowerCase().includes('count'));
  const zeroCostStock = stock.filter((m) => String(m.direction) === 'in' && n(m.qty) > 0 && n(m.unitCost) <= 0).length;
  const inventoryValue = Number(totals?.inventoryValue ?? sum(stock, (m) => (String(m.direction) === 'in' ? 1 : -1) * n(m.qty) * n(m.unitCost)));
  const debits = sum(journals.flatMap((j: any) => asArray(j.lines)), (l) => n(l.debit));
  const credits = sum(journals.flatMap((j: any) => asArray(j.lines)), (l) => n(l.credit));
  const journalDiff = Math.abs(debits - credits);
  const blockers: string[] = [];
  const warnings: string[] = [];
  if (!branches.length) blockers.push('No branches loaded');
  if (!stores.length) blockers.push('No stores loaded');
  if (!items.length) blockers.push('No items/SKUs loaded');
  if (!menuItems.length) warnings.push('No menu items loaded');
  if (!recipes.length) warnings.push('No recipe lines loaded');
  if (!stock.length) warnings.push('No inventory/opening stock movement loaded');
  if (zeroCostStock) warnings.push(`${zeroCostStock} incoming stock rows have zero cost`);
  if (journalDiff > 0.01) blockers.push(`Journal imbalance ${journalDiff.toFixed(2)}`);
  const setupScore = Math.round(([branches.length, stores.length, items.length, suppliers.length, menuItems.length, recipes.length].filter(Boolean).length / 6) * 100);
  const inventoryScore = Math.round(([stock.length, inventoryValue > 0, approvals.length >= 0, zeroCostStock === 0].filter(Boolean).length / 4) * 100);
  const financeScore = Math.round(([journals.length, journalDiff <= 0.01, invoices.length || payments.length, asArray(state?.chartAccounts).length].filter(Boolean).length / 4) * 100);
  const salesScore = Math.round(([menuItems.length, recipes.length, foodicsBatches.length || asArray(state?.sales).length, journals.length].filter(Boolean).length / 4) * 100);
  const readiness = Math.max(0, Math.min(100, Math.round((setupScore * 0.25) + (inventoryScore * 0.25) + (financeScore * 0.25) + (salesScore * 0.25) - blockers.length * 8 - warnings.length * 2)));
  return {
    readiness,
    setupScore,
    inventoryScore,
    financeScore,
    salesScore,
    blockers,
    warnings,
    counts: {
      branches: branches.length,
      stores: stores.length,
      items: items.length,
      suppliers: suppliers.length,
      menuItems: menuItems.length,
      recipeLines: recipes.length,
      stockMovements: stock.length,
      journals: journals.length,
      purchaseInvoices: invoices.length,
      supplierPayments: payments.length,
      inventoryApprovals: approvals.length,
      countApprovals: countApprovals.length,
      auditEvents: audits.length,
      foodicsBatches: foodicsBatches.length,
    },
    financials: {
      inventoryValue,
      journalDebit: debits,
      journalCredit: credits,
      journalDiff,
      apExposure: Number(totals?.apBalance ?? 0),
      sales: Number(totals?.sales ?? 0),
      cogs: Number(totals?.cogs ?? 0),
      grossProfit: Number(totals?.grossProfit ?? 0),
    },
    quality: {
      duplicateSkus: duplicateKeys(items, 'sku'),
      duplicateStores: duplicateKeys(stores, 'code'),
      duplicateBranches: duplicateKeys(branches, 'code'),
      missingSupplierCompliance: suppliers.filter((s) => !s.vatNo || !s.bankName || !s.bankAccount || !s.representativeName).length,
      menuMissingRecipes: menuItems.filter((m) => !recipes.some((r) => r.menuItemId === m.id)).length,
      zeroCostStock,
      uniqueStockItems: uniqueCount(stock, 'itemId'),
      postedJournals: byStatus(journals, 'posted'),
    },
  };
}

function duplicateKeys(rows: any[], key: string) {
  const seen = new Map<string, number>();
  rows.forEach((row) => {
    const value = String(row?.[key] || '').trim();
    if (!value) return;
    seen.set(value, (seen.get(value) || 0) + 1);
  });
  return Array.from(seen.entries()).filter(([, count]) => count > 1).map(([value, count]) => ({ value, count }));
}

export function buildV240Wizard(state: any, snapshot = buildV240Snapshot(state, {})): V240WizardStep[] {
  const counts = snapshot.counts;
  const quality = snapshot.quality;
  const hasSetup = counts.branches > 0 && counts.stores > 0 && counts.items > 0;
  return [
    {
      id: 'setup-master-data', phase: '01', titleEn: 'Setup master data', titleAr: 'تحميل البيانات الأساسية', owner: 'Admin / Data steward', module: 'Import / Export',
      requiredFiles: ['01_branches_setup.csv', '02_stores_setup.csv', '03_items_setup_zero_cost.csv', '04_cost_centers_setup.csv', '05_suppliers_setup_full.csv', '06_chart_accounts_setup.csv'],
      expectedResultEn: 'Branches, stores, items, suppliers, cost centers, and accounts are available.', expectedResultAr: 'الفروع والمخازن والأصناف والموردون ومراكز التكلفة والحسابات جاهزة.',
      validationEn: `${counts.branches} branches, ${counts.stores} stores, ${counts.items} SKUs`, validationAr: `${counts.branches} فرع، ${counts.stores} مخزن، ${counts.items} صنف`,
      status: hasSetup ? 'done' : 'not_started', blockers: hasSetup ? [] : ['Upload setup master data files'],
    },
    {
      id: 'opening-stock', phase: '02', titleEn: 'Post opening stock', titleAr: 'ترحيل المخزون الافتتاحي', owner: 'Storekeeper / Finance', module: 'Inventory',
      requiredFiles: ['01_opening_stock_upload.csv'], expectedResultEn: 'Stock exists with quantity and cost before sales posting.', expectedResultAr: 'يوجد مخزون بكميات وتكلفة قبل ترحيل المبيعات.',
      validationEn: `${counts.stockMovements} stock movements, value ${snapshot.financials.inventoryValue.toFixed(2)}`, validationAr: `${counts.stockMovements} حركة مخزون، قيمة ${snapshot.financials.inventoryValue.toFixed(2)}`,
      status: counts.stockMovements > 0 ? 'done' : hasSetup ? 'in_progress' : 'blocked', blockers: hasSetup ? [] : ['Setup master data first'],
    },
    {
      id: 'foodics-menu', phase: '03', titleEn: 'Import Foodics menu bundle', titleAr: 'استيراد قائمة فودكس', owner: 'Operations / Menu owner', module: 'Sales / POS Trial',
      requiredFiles: ['01_foodics_products_export.csv', '02_foodics_products_ingredients_export.csv', '03_foodics_products_modifiers_export.csv'], expectedResultEn: 'Menu items and recipe lines are available for SKU auto mapping.', expectedResultAr: 'أصناف البيع وبنود الوصفات جاهزة للربط التلقائي بالكود.',
      validationEn: `${counts.menuItems} menu items, ${counts.recipeLines} recipe lines`, validationAr: `${counts.menuItems} صنف بيع، ${counts.recipeLines} بند وصفة`,
      status: counts.menuItems > 0 && counts.recipeLines > 0 ? 'done' : 'in_progress', blockers: [],
    },
    {
      id: 'foodics-sales', phase: '04', titleEn: 'Upload Foodics sales files', titleAr: 'رفع ملفات مبيعات فودكس', owner: 'Restaurant accountant', module: 'Sales / POS Trial',
      requiredFiles: ['01_foodics_orders_headers_export.csv', '02_foodics_order_lines_export.csv', '03_foodics_payments_export.csv'], expectedResultEn: 'Sales batch validates with zero payment difference in sample pack.', expectedResultAr: 'دفعة المبيعات تتحقق بدون فرق مدفوعات في عينة الاختبار.',
      validationEn: `${counts.foodicsBatches} Foodics/local sales batches`, validationAr: `${counts.foodicsBatches} دفعات فودكس/مبيعات محلية`,
      status: counts.foodicsBatches > 0 || counts.journals > 0 ? 'done' : 'not_started', blockers: [],
    },
    {
      id: 'sales-posting', phase: '05', titleEn: 'Post starter sales accounting', titleAr: 'ترحيل محاسبة المبيعات المبدئية', owner: 'Finance', module: 'Sales / POS Trial / Finance',
      requiredFiles: [], expectedResultEn: 'Sales, VAT, payment clearing, and journals are created without forcing inventory if recipe/cost is not ready.', expectedResultAr: 'إنشاء المبيعات والضريبة والتسويات والقيود دون إجبار المخزون إذا لم تجهز الوصفات/التكلفة.',
      validationEn: `${counts.journals} journals, difference ${snapshot.financials.journalDiff.toFixed(2)}`, validationAr: `${counts.journals} قيد، فرق ${snapshot.financials.journalDiff.toFixed(2)}`,
      status: counts.journals > 0 && snapshot.financials.journalDiff <= 0.01 ? 'done' : 'in_progress', blockers: snapshot.financials.journalDiff > 0.01 ? ['Fix unbalanced journals'] : [],
    },
    {
      id: 'monthly-count', phase: '06', titleEn: 'Upload monthly stock count', titleAr: 'رفع الجرد الشهري', owner: 'Storekeeper / Controller', module: 'Inventory',
      requiredFiles: ['02_monthly_stock_count_after_sales_upload.csv'], expectedResultEn: 'Shortage/surplus variances go to approval before posting.', expectedResultAr: 'فروقات العجز/الزيادة تذهب للاعتماد قبل الترحيل.',
      validationEn: `${counts.inventoryApprovals} inventory approvals, ${counts.countApprovals} count-related`, validationAr: `${counts.inventoryApprovals} اعتماد مخزون، ${counts.countApprovals} متعلق بالجرد`,
      status: counts.inventoryApprovals > 0 ? 'done' : 'not_started', blockers: counts.stockMovements > 0 ? [] : ['Post opening stock first'],
    },
    {
      id: 'close-evidence', phase: '07', titleEn: 'Export close evidence pack', titleAr: 'تصدير ملف أدلة الإغلاق', owner: 'Finance controller', module: 'Enterprise v240',
      requiredFiles: [], expectedResultEn: 'Pilot evidence pack and issue register are exported.', expectedResultAr: 'تصدير حزمة أدلة التجربة وسجل الملاحظات.',
      validationEn: `${snapshot.blockers.length} blockers, ${snapshot.warnings.length} warnings`, validationAr: `${snapshot.blockers.length} عوائق، ${snapshot.warnings.length} تحذيرات`,
      status: snapshot.blockers.length === 0 ? 'done' : 'in_progress', blockers: snapshot.blockers,
    },
  ];
}

export function buildV240Issues(snapshot: ReturnType<typeof buildV240Snapshot>) {
  const issues: { id: string; severity: V240Severity; module: string; issue: string; fix: string }[] = [];
  snapshot.blockers.forEach((issue, index) => issues.push({ id: `BLK-${index + 1}`, severity: 'critical', module: 'Core', issue, fix: 'Resolve before pilot close approval.' }));
  snapshot.warnings.forEach((issue, index) => issues.push({ id: `WRN-${index + 1}`, severity: 'warning', module: 'Core', issue, fix: 'Review during sample-data QA.' }));
  if (snapshot.quality.duplicateSkus.length) issues.push({ id: 'DQ-SKU', severity: 'critical', module: 'Setup', issue: `${snapshot.quality.duplicateSkus.length} duplicate SKU codes`, fix: 'Merge/deactivate duplicate SKUs before backend sync.' });
  if (snapshot.quality.menuMissingRecipes) issues.push({ id: 'DQ-REC', severity: 'warning', module: 'Recipes', issue: `${snapshot.quality.menuMissingRecipes} menu items missing recipes`, fix: 'Allowed for starter sales accounting, blocked for full ERP posting.' });
  if (snapshot.quality.missingSupplierCompliance) issues.push({ id: 'DQ-SUP', severity: 'warning', module: 'Suppliers', issue: `${snapshot.quality.missingSupplierCompliance} suppliers missing VAT/bank/representative fields`, fix: 'Complete supplier compliance before pilot.' });
  if (!issues.length) issues.push({ id: 'OK-001', severity: 'ready', module: 'Pilot', issue: 'No critical local blockers detected', fix: 'Proceed with guided sample test and export evidence.' });
  return issues;
}

export function buildV240ExpectedResults() {
  return [
    { metric: 'Foodics order headers', expected: '14', tolerance: '0', why: 'Confirms sales header import sample is complete' },
    { metric: 'Done orders', expected: '12', tolerance: '0', why: 'Void and returned order are excluded/handled separately' },
    { metric: 'Void orders', expected: '1', tolerance: '0', why: 'Void should not post revenue/VAT/COGS' },
    { metric: 'Returned orders', expected: '1', tolerance: '0', why: 'Return should reduce revenue/VAT and reconcile payments' },
    { metric: 'Foodics order lines', expected: '24', tolerance: '0', why: 'Confirms item-line file was uploaded' },
    { metric: 'Payment lines', expected: '13', tolerance: '0', why: 'Confirms payment file was uploaded' },
    { metric: 'Recognized gross after void/return', expected: '1,311.00', tolerance: '0.50', why: 'Core Foodics reconciliation amount' },
    { metric: 'Payment total', expected: '1,311.00', tolerance: '0.50', why: 'Should match recognized gross in the smooth sample' },
    { metric: 'VAT output', expected: '171.00', tolerance: '0.50', why: 'VAT from sample Foodics orders' },
    { metric: 'Opening inventory value', expected: '6,383.00', tolerance: '1.00', why: 'Confirms opening stock loaded with cost' },
    { metric: 'Theoretical COGS', expected: '180.36', tolerance: '2.00', why: 'Recipe-cost expectation for smooth sample' },
    { metric: 'Inventory value after sales', expected: '6,202.64', tolerance: '3.00', why: 'Opening inventory less theoretical COGS' },
    { metric: 'Stock count shortage value', expected: '34.16', tolerance: '2.00', why: 'Monthly count shortage sample' },
    { metric: 'Stock count surplus value', expected: '3.75', tolerance: '2.00', why: 'Monthly count surplus sample' },
  ];
}

export function buildV240PilotReports(snapshot: ReturnType<typeof buildV240Snapshot>) {
  return [
    { report: 'Pilot Readiness Certificate', owner: 'Controller', score: snapshot.readiness, status: snapshot.blockers.length ? 'Needs action' : 'Ready', export: 'CSV/PDF later' },
    { report: 'Foodics Starter Posting Pack', owner: 'Finance', score: snapshot.salesScore, status: snapshot.salesScore >= 70 ? 'Ready' : 'Needs Foodics data', export: 'CSV now' },
    { report: 'Inventory Count Variance Pack', owner: 'Storekeeper', score: snapshot.inventoryScore, status: snapshot.counts.inventoryApprovals ? 'Ready' : 'Needs count upload', export: 'CSV now' },
    { report: 'CFO Smoke Close Pack', owner: 'CFO', score: snapshot.financeScore, status: snapshot.financials.journalDiff <= 0.01 ? 'Ready' : 'Unbalanced', export: 'CSV now' },
    { report: 'Backend Pilot Checklist', owner: 'IT/Admin', score: 72, status: 'Design ready', export: 'CSV now' },
  ];
}

export function rowsToCsv(rows: Record<string, any>[]) {
  if (!rows.length) return '';
  const headers = Array.from(rows.reduce<Set<string>>((set, row) => { Object.keys(row).forEach((key) => set.add(key)); return set; }, new Set<string>()));
  const escape = (value: any) => `"${String(value ?? '').replace(/"/g, '""')}"`;
  return [headers.join(','), ...rows.map((row) => headers.map((h) => escape(row[h])).join(','))].join('\n');
}
