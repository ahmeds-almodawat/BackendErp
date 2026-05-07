export type Severity = 'good' | 'warn' | 'bad' | 'info';

const arr = (value: unknown): any[] => Array.isArray(value) ? value : [];
const num = (value: unknown) => Number(value || 0);
const today = () => new Date().toISOString().slice(0, 10);

export function calcStockBalances(state: any) {
  const rows: any[] = [];
  const stores = arr(state?.stores);
  const items = arr(state?.items);
  const moves = arr(state?.stockMovements);
  for (const store of stores) {
    for (const item of items) {
      const relevant = moves.filter((m: any) => m.storeId === store.id && m.itemId === item.id);
      const onHand = relevant.reduce((s: number, m: any) => s + (m.direction === 'in' ? 1 : -1) * num(m.qty), 0);
      const inQty = relevant.filter((m: any) => m.direction === 'in').reduce((s: number, m: any) => s + num(m.qty), 0);
      const inValue = relevant.filter((m: any) => m.direction === 'in').reduce((s: number, m: any) => s + num(m.qty) * num(m.unitCost), 0);
      const avgCost = inQty ? inValue / inQty : num(item.standardCost);
      if (Math.abs(onHand) > 0.0001 || relevant.length) {
        rows.push({ store, item, onHand, avgCost, value: onHand * avgCost, movementCount: relevant.length });
      }
    }
  }
  return rows;
}

export function buildDailyCloseRows(state: any, locale: 'en' | 'ar') {
  const L = (en: string, ar: string) => locale === 'ar' ? ar : en;
  const sales = arr(state?.sales);
  const journals = arr(state?.journals);
  const stockMoves = arr(state?.stockMovements);
  const salesJournals = journals.filter((j: any) => String(j.source || '').includes('sale') || String(j.source || '').includes('foodics'));
  const negativeStock = calcStockBalances(state).filter((r) => r.onHand < -0.0001);
  return [
    { control: L('Sales imported / captured', 'تم استيراد/تسجيل المبيعات'), status: sales.length ? 'good' : 'warn', evidence: `${sales.length} ${L('sales documents', 'مستندات بيع')}`, next: sales.length ? L('Review payment settlement', 'مراجعة تسوية المدفوعات') : L('Upload Foodics sales or create trial sales', 'ارفع مبيعات فودكس أو أنشئ مبيعات تجريبية') },
    { control: L('Sales journals posted', 'تم ترحيل قيود المبيعات'), status: salesJournals.length ? 'good' : 'warn', evidence: `${salesJournals.length} ${L('sales journals', 'قيود مبيعات')}`, next: salesJournals.length ? L('Proceed to VAT/payment review', 'الانتقال لمراجعة الضريبة والمدفوعات') : L('Use Sales Accounting Only or Full ERP Posting', 'استخدم ترحيل المبيعات المحاسبي أو الترحيل الكامل') },
    { control: L('COGS / recipe movements generated', 'تم إنشاء تكلفة المبيعات / حركات الوصفة'), status: stockMoves.some((m: any) => String(m.type).includes('sales')) ? 'good' : 'warn', evidence: `${stockMoves.filter((m: any) => String(m.type).includes('sales')).length} ${L('sales stock movements', 'حركات مخزون بيع')}`, next: L('Validate theoretical vs actual food cost', 'تحقق من التكلفة النظرية والفعلية') },
    { control: L('No negative stock after sales', 'لا يوجد مخزون سالب بعد البيع'), status: negativeStock.length ? 'bad' : 'good', evidence: `${negativeStock.length} ${L('negative rows', 'صفوف سالبة')}`, next: negativeStock.length ? L('Post opening stock, GRN, transfer, or stock adjustment', 'رحّل رصيد افتتاحي أو استلام أو تحويل أو تسوية') : L('Ready for stock count review', 'جاهز لمراجعة الجرد') },
    { control: L('Audit trail exists', 'يوجد سجل تدقيق'), status: arr(state?.audits).length || arr(state?.auditLogs).length ? 'good' : 'warn', evidence: `${arr(state?.audits).length + arr(state?.auditLogs).length} ${L('audit rows', 'صفوف تدقيق')}`, next: L('Keep reversal reasons and approval notes mandatory', 'اجعل أسباب العكس وملاحظات الاعتماد إلزامية') },
  ];
}

export function buildSettlementRows(state: any, locale: 'en' | 'ar') {
  const L = (en: string, ar: string) => locale === 'ar' ? ar : en;
  const sales = arr(state?.sales);
  const journals = arr(state?.journals);
  const methods = new Map<string, number>();
  for (const s of sales) methods.set(s.paymentMethod || 'Unmapped', (methods.get(s.paymentMethod || 'Unmapped') || 0) + num(s.qty));
  const rows = Array.from(methods.entries()).map(([method, qty]) => ({
    method,
    source: L('Local sales documents / Foodics mapped method', 'مستندات البيع المحلية / طريقة دفع فودكس'),
    expected: qty,
    account: method.toLowerCase().includes('cash') ? '1010 Cash on Hand' : method.toLowerCase().includes('mada') || method.toLowerCase().includes('card') ? '1100 POS/Card Clearing' : '1200 Receivable / clearing',
    control: L('Needs settlement statement match before final close', 'يتطلب مطابقة كشف التسوية قبل الإغلاق النهائي'),
    status: 'warn' as Severity,
  }));
  if (!rows.length) rows.push({ method: L('No payment methods yet', 'لا توجد طرق دفع بعد'), source: '-', expected: 0, account: '-', control: L('Upload Foodics payments or post sales accounting batch', 'ارفع مدفوعات فودكس أو رحّل دفعة مبيعات محاسبية'), status: 'bad' as Severity });
  const bankExceptions = arr(state?.bankReconLines).filter((r: any) => r.status !== 'matched').length;
  rows.push({ method: L('Bank reconciliation exceptions', 'استثناءات مطابقة البنك'), source: 'bankReconLines', expected: bankExceptions, account: '1020 Bank Accounts', control: L('Unmatched bank lines must be cleared before finance close', 'يجب تسوية البنود البنكية غير المطابقة قبل الإغلاق المالي'), status: bankExceptions ? 'warn' : 'good' });
  rows.push({ method: L('Sales journal support', 'دعم قيود المبيعات'), source: 'journals', expected: journals.filter((j: any) => String(j.source || '').includes('sale')).length, account: '4000 / 2150 / 1100', control: L('Every posted sales batch should have journal evidence', 'كل دفعة مبيعات مرحلة يجب أن يكون لها قيد داعم'), status: journals.filter((j: any) => String(j.source || '').includes('sale')).length ? 'good' : 'warn' });
  return rows;
}

export function buildAgingRows(state: any, locale: 'en' | 'ar') {
  const L = (en: string, ar: string) => locale === 'ar' ? ar : en;
  const invoices = arr(state?.purchaseInvoices).filter((i: any) => i.status === 'posted');
  const payments = arr(state?.supplierPayments).filter((p: any) => p.status === 'posted');
  const byInvoicePaid = (ref: string) => payments.filter((p: any) => p.invoiceRef === ref).reduce((s: number, p: any) => s + num(p.amount), 0);
  return invoices.map((inv: any) => {
    const total = arr(inv.lines).reduce((s: number, l: any) => s + num(l.qty) * num(l.unitCost) * (1 + num(l.vatRate) / 100), 0);
    const balance = Math.max(0, total - byInvoicePaid(inv.ref));
    const age = Math.max(0, Math.floor((new Date(today()).getTime() - new Date(inv.invoiceDate || today()).getTime()) / 86400000));
    return {
      type: 'AP', ref: inv.ref, party: arr(state?.suppliers).find((s: any) => s.id === inv.supplierId)?.name || inv.supplierId, date: inv.invoiceDate,
      total, paid: byInvoicePaid(inv.ref), balance, bucket: age <= 30 ? '0-30' : age <= 60 ? '31-60' : age <= 90 ? '61-90' : '90+', risk: balance > 0 && age > 60 ? L('Overdue', 'متأخر') : balance > 0 ? L('Open', 'مفتوح') : L('Paid', 'مدفوع'),
    };
  });
}

export function buildTransferPlanRows(state: any, locale: 'en' | 'ar') {
  const L = (en: string, ar: string) => locale === 'ar' ? ar : en;
  const balances = calcStockBalances(state);
  const lows = balances.filter((r) => r.onHand > 0 && r.onHand < num(r.item.minStock || 0));
  const surplus = balances.filter((r) => r.onHand > num(r.item.maxStock || 0) && num(r.item.maxStock || 0) > 0);
  const rows = lows.slice(0, 30).map((low) => {
    const donor = surplus.find((s) => s.item.id === low.item.id && s.store.id !== low.store.id);
    return { item: low.item.nameEn || low.item.sku, sku: low.item.sku, targetStore: low.store.nameEn || low.store.code, currentQty: low.onHand, minStock: low.item.minStock || 0, suggestedSource: donor ? (donor.store.nameEn || donor.store.code) : L('Purchase required', 'يتطلب شراء'), suggestedQty: donor ? Math.max(0, Math.min(num(low.item.reorderPoint || low.item.minStock || 1), donor.onHand - num(donor.item.maxStock || donor.item.minStock || 0))) : Math.max(0, num(low.item.reorderPoint || low.item.minStock || 1) - low.onHand), status: donor ? L('Transfer candidate', 'مرشح تحويل') : L('PO/GRN candidate', 'مرشح شراء/استلام') };
  });
  return rows.length ? rows : [{ item: L('No low-stock transfer candidates', 'لا توجد مقترحات تحويل لنقص المخزون'), sku: '-', targetStore: '-', currentQty: 0, minStock: 0, suggestedSource: '-', suggestedQty: 0, status: L('OK', 'جيد') }];
}

export function buildMenuEngineeringRows(state: any, locale: 'en' | 'ar') {
  const L = (en: string, ar: string) => locale === 'ar' ? ar : en;
  const sales = arr(state?.sales); const menuItems = arr(state?.menuItems); const recipeLines = arr(state?.recipeLines); const moves = arr(state?.stockMovements);
  const avgCost = (itemId: string) => { const ins = moves.filter((m: any) => m.itemId === itemId && m.direction === 'in' && num(m.unitCost) > 0); const q = ins.reduce((s: number, m: any) => s + num(m.qty), 0); const v = ins.reduce((s: number, m: any) => s + num(m.qty) * num(m.unitCost), 0); return q ? v / q : num(arr(state?.items).find((i: any) => i.id === itemId)?.standardCost); };
  return menuItems.map((m: any) => { const soldQty = sales.filter((s: any) => s.menuItemId === m.id).reduce((s: number, row: any) => s + num(row.qty), 0); const recipeCost = recipeLines.filter((r: any) => r.menuItemId === m.id).reduce((s: number, r: any) => s + num(r.qty) * (1 + num(r.wastagePct) / 100) * avgCost(r.itemId), 0); const priceNet = m.priceIncludesVat ? num(m.sellingPrice) / (1 + num(m.vatRate) / 100) : num(m.sellingPrice); const margin = priceNet - recipeCost; const marginPct = priceNet ? margin / priceNet * 100 : 0; const classification = soldQty >= 10 && marginPct >= 60 ? L('Star', 'نجم') : soldQty >= 10 && marginPct < 60 ? L('High sales / low margin', 'مبيعات عالية / هامش منخفض') : soldQty < 10 && marginPct >= 60 ? L('Puzzle', 'لغز') : L('Dog / review', 'ضعيف / مراجعة'); return { code: m.code, item: m.nameEn, soldQty, priceNet, recipeCost, margin, marginPct, classification }; });
}

export function buildApprovalInboxRows(state: any, locale: 'en' | 'ar') {
  const L = (en: string, ar: string) => locale === 'ar' ? ar : en;
  return [
    ...arr(state?.inventoryApprovals).filter((r: any) => r.status === 'pending').map((r: any) => ({ module: L('Inventory', 'المخزون'), ref: r.ref, type: r.requestType, status: r.status, risk: num(r.qty) * num(r.unitCost), next: L('Approve or reject variance', 'اعتماد أو رفض الفرق') })),
    ...arr(state?.materialRequests).filter((r: any) => ['submitted', 'draft'].includes(r.status)).map((r: any) => ({ module: L('Purchasing', 'المشتريات'), ref: r.ref, type: 'material_request', status: r.status, risk: arr(r.lines).length, next: L('Approve or convert to PO', 'اعتماد أو تحويل إلى أمر شراء') })),
    ...arr(state?.journals).filter((j: any) => j.status === 'draft').map((j: any) => ({ module: L('Finance', 'المالية'), ref: j.ref, type: 'journal', status: j.status, risk: arr(j.lines).reduce((s: number, l: any) => s + num(l.debit), 0), next: L('Review and post/reject', 'مراجعة وترحيل/رفض') })),
  ];
}

export function buildRegressionRows(locale: 'en' | 'ar') {
  const L = (en: string, ar: string) => locale === 'ar' ? ar : en;
  return [
    { test: L('Empty app does not crash', 'التطبيق الفارغ لا يتعطل'), steps: L('Open app without trial data and navigate all modules', 'افتح التطبيق دون بيانات وجرب كل الوحدات'), expected: L('Safe empty states appear', 'تظهر حالات فارغة آمنة'), priority: 'P0' },
    { test: L('Foodics starter flow', 'دورة فودكس الأولية'), steps: L('Import menu, upload sales, auto-map by SKU, validate, report-only', 'استيراد القائمة، رفع المبيعات، المطابقة بالـ SKU، التحقق، تقرير فقط'), expected: L('No recipe blocker for report-only', 'لا يوجد منع بسبب الوصفة في تقرير فقط'), priority: 'P0' },
    { test: L('Sales accounting only', 'ترحيل المبيعات المحاسبي فقط'), steps: L('Approve and post accounting-only batch', 'اعتماد وترحيل دفعة محاسبية فقط'), expected: L('VAT and payment journals generated without stock deduction', 'إنشاء قيود الضريبة والمدفوعات دون خصم مخزون'), priority: 'P0' },
    { test: L('Full ERP posting gate', 'بوابة الترحيل الكامل'), steps: L('Try full posting without recipes/stock/costs', 'جرب الترحيل الكامل دون وصفات/مخزون/تكاليف'), expected: L('Blocked with drilldown issues', 'يتم المنع مع روابط معالجة'), priority: 'P0' },
    { test: L('Monthly stock count', 'الجرد الشهري'), steps: L('Generate count sheet, fill counted_qty, upload, approve variance', 'إنشاء كشف جرد، تعبئة الكمية، الرفع، اعتماد الفرق'), expected: L('Shortage/surplus approval and GL movement', 'اعتماد عجز/زيادة وحركة مالية'), priority: 'P0' },
    { test: L('Period close readiness', 'جاهزية إغلاق الفترة'), steps: L('Review Enterprise HQ and close cockpit after sales and stock count', 'مراجعة مركز المؤسسة ولوحة الإغلاق بعد المبيعات والجرد'), expected: L('Blockers/warnings reflect current data', 'العوائق والتحذيرات تعكس البيانات'), priority: 'P1' },
    { test: L('Reversal safety', 'سلامة العكس'), steps: L('Reverse a posted Foodics batch with reason', 'عكس دفعة فودكس مرحلة مع سبب'), expected: L('Original evidence remains and reversal audit is created', 'يبقى الأصل ويتم إنشاء تدقيق للعكس'), priority: 'P1' },
  ];
}
