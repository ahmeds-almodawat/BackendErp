
export type PilotStepKey = 'seed.masters' | 'post.purchase.invoice' | 'post.supplier.payment' | 'post.production.batch' | 'post.pos.day' | 'post.stock.adjustment' | 'close.vat.period';
export type PilotResult = { ok: boolean; stepKey: string; message: string; state: any; proof: Record<string, unknown>; warnings: string[] };

const today = () => new Date().toISOString().slice(0, 10);
const nowIso = () => new Date().toISOString();
const id = (prefix: string) => `${prefix}-${Math.random().toString(36).slice(2, 10)}`;
const arr = <T = any>(value: unknown): T[] => Array.isArray(value) ? value as T[] : [];
const audit = (state: any, action: string, entity: string, ref: string, note: string) => ({ ...state, audits: [{ id: id('AUD'), at: nowIso(), action, entity, ref, user: 'pilot-automation', note }, ...arr(state.audits)] });

export const V452_PILOT_STEPS = [
  ['seed.masters', 'Create pilot master data', 'Setup', 'Creates branch, stores, supplier, items, menu, recipe, accounts, users, and open period.'],
  ['post.purchase.invoice', 'Create and post purchase invoice', 'Purchasing / Inventory / Finance', 'Creates posted invoice, inventory movements, AP/VAT/GL journal evidence.'],
  ['post.supplier.payment', 'Create and post supplier payment', 'AP / Cash / Finance', 'Creates posted supplier payment and AP settlement journal.'],
  ['post.production.batch', 'Create and post production batch', 'Production / Inventory', 'Consumes flour and outputs semi-finished dough with journal evidence.'],
  ['post.pos.day', 'Create and post POS day', 'Sales / POS', 'Creates sales revenue, VAT output, COGS, and recipe consumption evidence.'],
  ['post.stock.adjustment', 'Create and post stock adjustment', 'Inventory', 'Creates damage adjustment and stock variance journal.'],
  ['close.vat.period', 'Settle VAT and close pilot period', 'Finance Close', 'Creates VAT settlement journal and closes the pilot period.'],
].map(([key, title, module, effect], index) => ({ key, title, module, effect, sequence: index + 1, safety: 'Local/demo only. Uses PILOT-* references and never calls production posting services.' }));

function ensure<T extends Record<string, any>>(rows: T[], field: string, value: string, record: T) { return rows.some((x) => String(x[field]) === value) ? rows : [...rows, record]; }
function acct(code: string, nameEn: string, type: string) { return { id: `PILOT-ACC-${code}`, code, nameEn, nameAr: nameEn, type, active: true, requireCostCenter: false }; }
function lineTotals(line: any) { const net = Number(line.qty || 0) * Number(line.unitCost || 0) - Number(line.discount || 0); const vat = net * (Number(line.vatRate || 0) / 100); return { net, vat, total: net + vat }; }
function invoiceTotals(inv: any) { return arr(inv.lines).reduce((s: any, l: any) => { const t = lineTotals(l); return { net: s.net + t.net, vat: s.vat + t.vat, total: s.total + t.total }; }, { net: 0, vat: 0, total: 0 }); }
function stock(state: any, storeId: string, itemId: string) { return arr(state.stockMovements).filter((m: any) => m.storeId === storeId && m.itemId === itemId).reduce((s: number, m: any) => s + (m.direction === 'in' ? Number(m.qty || 0) : -Number(m.qty || 0)), 0); }
function avgCost(state: any, itemId: string) { const ms = arr(state.stockMovements).filter((m: any) => m.itemId === itemId && m.direction === 'in' && Number(m.unitCost || 0) > 0); const q = ms.reduce((s: number, m: any) => s + Number(m.qty || 0), 0); const v = ms.reduce((s: number, m: any) => s + Number(m.qty || 0) * Number(m.unitCost || 0), 0); return q ? v / q : Number(arr(state.items).find((i: any) => i.id === itemId)?.standardCost || 0); }
function applied(state: any) { return Array.from(new Set(arr(state.audits).filter((a: any) => String(a.ref || '').startsWith('PILOT-AUTO:')).map((a: any) => String(a.ref).replace('PILOT-AUTO:', '')))); }

export function pilotAutomationSnapshot(state: any) {
  const done = applied(state);
  const lines = arr(state.journals).flatMap((j: any) => arr(j.lines));
  const debit = lines.reduce((s: number, l: any) => s + Number(l.debit || 0), 0);
  const credit = lines.reduce((s: number, l: any) => s + Number(l.credit || 0), 0);
  return {
    score: Math.round((done.length / V452_PILOT_STEPS.length) * 100),
    appliedSteps: done,
    journalDifference: Math.abs(debit - credit),
    counts: {
      suppliers: arr(state.suppliers).length,
      items: arr(state.items).length,
      purchaseInvoices: arr(state.purchaseInvoices).length,
      supplierPayments: arr(state.supplierPayments).length,
      productions: arr(state.productions).length,
      sales: arr(state.sales).length,
      stockMovements: arr(state.stockMovements).length,
      journals: arr(state.journals).length,
      audits: arr(state.audits).length,
    },
  };
}

export function resetPilotAutomation(state: any) {
  const pilot = (v: unknown) => String(v || '').includes('PILOT');
  const next = {
    ...state,
    branches: arr(state.branches).filter((x: any) => !pilot(x.code)),
    stores: arr(state.stores).filter((x: any) => !pilot(x.code)),
    suppliers: arr(state.suppliers).filter((x: any) => !pilot(x.code)),
    items: arr(state.items).filter((x: any) => !pilot(x.sku)),
    menuItems: arr(state.menuItems).filter((x: any) => !pilot(x.code)),
    itemCategories: arr(state.itemCategories).filter((x: any) => !pilot(x.id)),
    menuCategories: arr(state.menuCategories).filter((x: any) => !pilot(x.id)),
    recipeLines: arr(state.recipeLines).filter((x: any) => !pilot(x.id)),
    productionRecipes: arr(state.productionRecipes).filter((x: any) => !pilot(x.code)),
    costCenters: arr(state.costCenters).filter((x: any) => !pilot(x.code)),
    chartAccounts: arr(state.chartAccounts).filter((x: any) => !pilot(x.id)),
    fiscalPeriods: arr(state.fiscalPeriods).filter((x: any) => !pilot(x.code)),
    employees: arr(state.employees).filter((x: any) => !pilot(x.code)),
    userAccounts: arr(state.userAccounts).filter((x: any) => !pilot(x.email)),
    purchaseInvoices: arr(state.purchaseInvoices).filter((x: any) => !pilot(x.ref)),
    supplierPayments: arr(state.supplierPayments).filter((x: any) => !pilot(x.ref)),
    productions: arr(state.productions).filter((x: any) => !pilot(x.ref)),
    sales: arr(state.sales).filter((x: any) => !pilot(x.ref)),
    stockMovements: arr(state.stockMovements).filter((x: any) => !pilot(x.ref)),
    journals: arr(state.journals).filter((x: any) => !pilot(x.ref)),
    inventoryApprovals: arr(state.inventoryApprovals).filter((x: any) => !pilot(x.ref)),
    audits: arr(state.audits).filter((x: any) => !pilot(x.ref)),
  };
  return audit(next, 'reset', 'pilot_automation', 'PILOT-AUTO:reset', 'Removed pilot automation records.');
}

export function applyPilotStep(state: any, stepKey: string): PilotResult {
  try {
    if (stepKey === 'seed.masters') return seedMasters(state);
    if (stepKey === 'post.purchase.invoice') return postPurchaseInvoice(state);
    if (stepKey === 'post.supplier.payment') return postSupplierPayment(state);
    if (stepKey === 'post.production.batch') return postProductionBatch(state);
    if (stepKey === 'post.pos.day') return postPosDay(state);
    if (stepKey === 'post.stock.adjustment') return postStockAdjustment(state);
    if (stepKey === 'close.vat.period') return closeVatPeriod(state);
    return { ok: false, stepKey, message: `Unknown step: ${stepKey}`, state, proof: {}, warnings: [] };
  } catch (error) {
    return { ok: false, stepKey, message: error instanceof Error ? error.message : String(error), state, proof: {}, warnings: [] };
  }
}

export function applyAllPilotSteps(state: any): PilotResult {
  let current = state; const proof: Record<string, unknown> = {}; const warnings: string[] = [];
  for (const step of V452_PILOT_STEPS) { const r = applyPilotStep(current, step.key); if (!r.ok) return { ...r, state: current, proof, warnings: [...warnings, ...r.warnings] }; current = r.state; proof[step.key] = r.proof; warnings.push(...r.warnings); }
  return { ok: true, stepKey: 'all', message: 'Full pilot scenario generated safely.', state: current, proof, warnings };
}

function seedMasters(state: any): PilotResult {
  let next = { ...state };
  next.branches = ensure(arr(next.branches), 'code', 'PILOT-BR1', { id: 'PILOT-BR1', code: 'PILOT-BR1', nameEn: 'Pilot Branch', nameAr: 'فرع تجريبي', location: 'Training', active: true });
  next.stores = ensure(arr(next.stores), 'code', 'PILOT-MAIN', { id: 'PILOT-STORE-MAIN', code: 'PILOT-MAIN', nameEn: 'Pilot Main Store', nameAr: 'مخزن رئيسي تجريبي', branchId: 'PILOT-BR1', type: 'central', active: true });
  next.stores = ensure(next.stores, 'code', 'PILOT-KITCHEN', { id: 'PILOT-STORE-KITCHEN', code: 'PILOT-KITCHEN', nameEn: 'Pilot Kitchen Store', nameAr: 'مخزن مطبخ تجريبي', branchId: 'PILOT-BR1', type: 'kitchen', active: true });
  next.suppliers = ensure(arr(next.suppliers), 'code', 'PILOT-SUP', { id: 'PILOT-SUP', code: 'PILOT-SUP', name: 'Pilot Food Supplier', vatNo: '300000000000003', paymentTerms: '30 days', contactName: 'Pilot Contact', phone: '0500000000', email: 'pilot.supplier@example.com', bankName: 'Pilot Bank', bankAccount: 'SA0000000000000000000000', representativeName: 'Pilot Rep', representativePhone: '0500000001', active: true });
  next.itemCategories = ensure(arr(next.itemCategories), 'id', 'PILOT-ICAT-RAW', { id: 'PILOT-ICAT-RAW', kind: 'item', nameEn: 'Pilot Raw Materials', nameAr: 'مواد خام تجريبية', active: true });
  next.menuCategories = ensure(arr(next.menuCategories), 'id', 'PILOT-MCAT-MENU', { id: 'PILOT-MCAT-MENU', kind: 'menu', nameEn: 'Pilot Menu', nameAr: 'قائمة تجريبية', active: true });
  const items = [
    ['PILOT-ITEM-FLOUR','PILOT-FLOUR','Pilot Flour',4,false], ['PILOT-ITEM-CHEESE','PILOT-CHEESE','Pilot Cheese',22,false], ['PILOT-ITEM-SAUCE','PILOT-SAUCE','Pilot Sauce',9,false], ['PILOT-ITEM-DOUGH','PILOT-DOUGH','Pilot Dough',7,true]
  ];
  next.items = arr(next.items); items.forEach(([itemId, sku, nameEn, cost, semi]) => { next.items = ensure(next.items, 'sku', sku as string, { id: itemId, sku, nameEn, nameAr: nameEn, category: 'Pilot Raw Materials', purchaseUnit: 'kg', consumptionUnit: 'kg', conversionFactor: 1, standardCost: cost, minStock: 5, maxStock: 200, reorderPoint: 15, isSemiFinished: semi, active: true }); });
  next.menuItems = ensure(arr(next.menuItems), 'code', 'PILOT-PIZZA', { id: 'PILOT-MENU-PIZZA', code: 'PILOT-PIZZA', nameEn: 'Pilot Pizza', nameAr: 'بيتزا تجريبية', category: 'Pilot Menu', sellingPrice: 45, vatRate: 15, priceIncludesVat: true, active: true });
  if (!arr(next.recipeLines).some((x: any) => x.id === 'PILOT-RECIPE-DOUGH')) next.recipeLines = [...arr(next.recipeLines), { id: 'PILOT-RECIPE-DOUGH', menuItemId: 'PILOT-MENU-PIZZA', itemId: 'PILOT-ITEM-DOUGH', qty: 0.25, unit: 'kg', wastagePct: 2 }, { id: 'PILOT-RECIPE-CHEESE', menuItemId: 'PILOT-MENU-PIZZA', itemId: 'PILOT-ITEM-CHEESE', qty: 0.12, unit: 'kg', wastagePct: 1 }, { id: 'PILOT-RECIPE-SAUCE', menuItemId: 'PILOT-MENU-PIZZA', itemId: 'PILOT-ITEM-SAUCE', qty: 0.08, unit: 'kg', wastagePct: 1 }];
  next.productionRecipes = ensure(arr(next.productionRecipes), 'code', 'PILOT-DOUGH-RECIPE', { id: 'PILOT-PROD-RECIPE', code: 'PILOT-DOUGH-RECIPE', nameEn: 'Pilot Dough Recipe', nameAr: 'وصفة عجين تجريبية', outputItemId: 'PILOT-ITEM-DOUGH', baseOutputQty: 10, outputUnit: 'kg', defaultExpiryDays: 2, active: true, lines: [{ id: 'PILOT-PROD-LINE-FLOUR', itemId: 'PILOT-ITEM-FLOUR', qty: 10, unit: 'kg', wastagePct: 3 }] });
  next.costCenters = ensure(arr(next.costCenters), 'code', 'PILOT-CC-KITCHEN', { id: 'PILOT-CC-KITCHEN', code: 'PILOT-CC-KITCHEN', nameEn: 'Pilot Kitchen Cost Center', nameAr: 'مركز تكلفة مطبخ تجريبي', branchId: 'PILOT-BR1', budget: 0, active: true });
  next.chartAccounts = arr(next.chartAccounts); [acct('1010','Cash','asset'),acct('1020','Bank','asset'),acct('1300','Inventory','asset'),acct('1310','Semi-finished Inventory','asset'),acct('1400','VAT Input','asset'),acct('2100','Accounts Payable','liability'),acct('2200','VAT Output','liability'),acct('2300','VAT Settlement','liability'),acct('4000','Sales Revenue','revenue'),acct('5000','COGS','cogs'),acct('5100','Stock Variance','expense')].forEach((a) => { next.chartAccounts = ensure(next.chartAccounts, 'code', a.code, a); });
  next.fiscalPeriods = ensure(arr(next.fiscalPeriods), 'code', 'PILOT-2026-05', { id: 'PILOT-PERIOD-2026-05', code: 'PILOT-2026-05', nameEn: 'Pilot Period', nameAr: 'فترة تجريبية', startDate: today().slice(0,8)+'01', endDate: today().slice(0,8)+'28', status: 'open' });
  next = audit(next, 'apply', 'pilot_automation', 'PILOT-AUTO:seed.masters', 'Generated pilot master data.');
  return { ok: true, stepKey: 'seed.masters', message: 'Pilot master data created.', state: next, proof: { branch: 'PILOT-BR1', supplier: 'PILOT-SUP', items: 4 }, warnings: [] };
}

function postPurchaseInvoice(state: any): PilotResult {
  if (!arr(state.items).some((x: any) => x.sku === 'PILOT-FLOUR')) return { ok: false, stepKey: 'post.purchase.invoice', message: 'Run master data first.', state, proof: {}, warnings: [] };
  if (arr(state.purchaseInvoices).some((x: any) => x.ref === 'PI-PILOT-001')) return { ok: true, stepKey: 'post.purchase.invoice', message: 'Purchase invoice already exists.', state, proof: { idempotent: true }, warnings: [] };
  const inv = { id: 'PILOT-PI-001', ref: 'PI-PILOT-001', invoiceNo: 'SUP-PI-PILOT-001', supplierId: 'PILOT-SUP', branchId: 'PILOT-BR1', storeId: 'PILOT-STORE-MAIN', costCenterId: 'PILOT-CC-KITCHEN', invoiceDate: today(), deliveryDate: today(), paymentType: 'credit', paidAmount: 0, status: 'posted', lines: [ { id: 'PILOT-PI-L1', itemId: 'PILOT-ITEM-FLOUR', qty: 100, unitCost: 4, vatRate: 15, discount: 0 }, { id: 'PILOT-PI-L2', itemId: 'PILOT-ITEM-CHEESE', qty: 30, unitCost: 22, vatRate: 15, discount: 0 }, { id: 'PILOT-PI-L3', itemId: 'PILOT-ITEM-SAUCE', qty: 25, unitCost: 9, vatRate: 15, discount: 0 } ] };
  const t = invoiceTotals(inv);
  const moves = inv.lines.map((l: any) => ({ id: id('MOV'), date: today(), type: 'purchase', storeId: inv.storeId, itemId: l.itemId, direction: 'in', qty: l.qty, unitCost: l.unitCost, ref: inv.ref, note: 'Pilot purchase receipt', supplierId: inv.supplierId }));
  const je = { id: 'PILOT-JE-PI-001', date: today(), ref: inv.ref, source: 'pilot_purchase_invoice', description: 'Pilot purchase invoice', status: 'posted', lines: [ { id: id('JL'), accountCode: '1300', debit: t.net, credit: 0, branchId: 'PILOT-BR1', memo: 'Inventory' }, { id: id('JL'), accountCode: '1400', debit: t.vat, credit: 0, branchId: 'PILOT-BR1', memo: 'VAT input' }, { id: id('JL'), accountCode: '2100', debit: 0, credit: t.total, branchId: 'PILOT-BR1', memo: 'AP' } ] };
  const next = audit({ ...state, purchaseInvoices: [...arr(state.purchaseInvoices), inv], stockMovements: [...arr(state.stockMovements), ...moves], journals: [...arr(state.journals), je] }, 'post', 'pilot_purchase_invoice', 'PILOT-AUTO:post.purchase.invoice', 'Posted pilot purchase invoice.');
  return { ok: true, stepKey: 'post.purchase.invoice', message: 'Pilot purchase invoice posted.', state: next, proof: t, warnings: [] };
}

function postSupplierPayment(state: any): PilotResult {
  const inv = arr(state.purchaseInvoices).find((x: any) => x.ref === 'PI-PILOT-001'); if (!inv) return { ok: false, stepKey: 'post.supplier.payment', message: 'Run purchase invoice first.', state, proof: {}, warnings: [] };
  if (arr(state.supplierPayments).some((x: any) => x.ref === 'PAY-PILOT-001')) return { ok: true, stepKey: 'post.supplier.payment', message: 'Payment already exists.', state, proof: { idempotent: true }, warnings: [] };
  const amount = 500; const pay = { id: 'PILOT-PAY-001', ref: 'PAY-PILOT-001', date: today(), supplierId: 'PILOT-SUP', amount, method: 'bank', accountCode: '1020', status: 'posted', note: 'Pilot payment', invoiceRef: inv.ref };
  const je = { id: 'PILOT-JE-PAY-001', date: today(), ref: pay.ref, source: 'pilot_supplier_payment', description: 'Pilot supplier payment', status: 'posted', lines: [ { id: id('JL'), accountCode: '2100', debit: amount, credit: 0, branchId: 'PILOT-BR1', memo: 'Reduce AP' }, { id: id('JL'), accountCode: '1020', debit: 0, credit: amount, branchId: 'PILOT-BR1', memo: 'Bank' } ] };
  const next = audit({ ...state, supplierPayments: [...arr(state.supplierPayments), pay], journals: [...arr(state.journals), je] }, 'post', 'pilot_supplier_payment', 'PILOT-AUTO:post.supplier.payment', 'Posted pilot supplier payment.');
  return { ok: true, stepKey: 'post.supplier.payment', message: 'Pilot supplier payment posted.', state: next, proof: { amount }, warnings: [] };
}

function postProductionBatch(state: any): PilotResult {
  if (stock(state, 'PILOT-STORE-MAIN', 'PILOT-ITEM-FLOUR') < 20) return { ok: false, stepKey: 'post.production.batch', message: 'Not enough flour. Run purchase invoice first.', state, proof: {}, warnings: [] };
  if (arr(state.productions).some((x: any) => x.ref === 'PROD-PILOT-001')) return { ok: true, stepKey: 'post.production.batch', message: 'Production already exists.', state, proof: { idempotent: true }, warnings: [] };
  const cost = avgCost(state, 'PILOT-ITEM-FLOUR'), inputQty = 20, outputQty = 19.2, value = inputQty * cost;
  const prod = { id: 'PILOT-PROD-001', date: today(), ref: 'PROD-PILOT-001', recipeId: 'PILOT-PROD-RECIPE', sourceStoreId: 'PILOT-STORE-MAIN', destinationStoreId: 'PILOT-STORE-KITCHEN', outputItemId: 'PILOT-ITEM-DOUGH', plannedOutputQty: 20, actualOutputQty: outputQty, status: 'posted', lines: [{ id: 'PILOT-PROD-L1', itemId: 'PILOT-ITEM-FLOUR', plannedQty: inputQty, actualQty: inputQty, unit: 'kg', wastagePct: 4 }] };
  const moves = [{ id: id('MOV'), date: today(), type: 'production', storeId: 'PILOT-STORE-MAIN', itemId: 'PILOT-ITEM-FLOUR', direction: 'out', qty: inputQty, unitCost: cost, ref: prod.ref, note: 'Pilot production input' }, { id: id('MOV'), date: today(), type: 'production', storeId: 'PILOT-STORE-KITCHEN', itemId: 'PILOT-ITEM-DOUGH', direction: 'in', qty: outputQty, unitCost: value/outputQty, ref: prod.ref, note: 'Pilot production output' }];
  const je = { id: 'PILOT-JE-PROD-001', date: today(), ref: prod.ref, source: 'pilot_production', description: 'Pilot production', status: 'posted', lines: [{ id: id('JL'), accountCode: '1310', debit: value, credit: 0, branchId: 'PILOT-BR1', memo: 'Dough output' }, { id: id('JL'), accountCode: '1300', debit: 0, credit: value, branchId: 'PILOT-BR1', memo: 'Flour consumed' }] };
  const next = audit({ ...state, productions: [...arr(state.productions), prod], stockMovements: [...arr(state.stockMovements), ...moves], journals: [...arr(state.journals), je] }, 'post', 'pilot_production', 'PILOT-AUTO:post.production.batch', 'Posted pilot production batch.');
  return { ok: true, stepKey: 'post.production.batch', message: 'Pilot production posted.', state: next, proof: { inputQty, outputQty, value }, warnings: [] };
}

function postPosDay(state: any): PilotResult {
  if (!arr(state.menuItems).some((x: any) => x.code === 'PILOT-PIZZA')) return { ok: false, stepKey: 'post.pos.day', message: 'Run master data first.', state, proof: {}, warnings: [] };
  if (arr(state.sales).some((x: any) => x.ref === 'POS-PILOT-001')) return { ok: true, stepKey: 'post.pos.day', message: 'POS day already exists.', state, proof: { idempotent: true }, warnings: [] };
  const sale = { id: 'PILOT-SALE-001', date: today(), ref: 'POS-PILOT-001', branchId: 'PILOT-BR1', storeId: 'PILOT-STORE-KITCHEN', menuItemId: 'PILOT-MENU-PIZZA', qty: 12, paymentMethod: 'Cash', posted: true };
  const gross = 540, net = gross / 1.15, vat = gross - net;
  const moves = arr(state.recipeLines).filter((r: any) => r.menuItemId === sale.menuItemId).map((r: any) => ({ id: id('MOV'), date: today(), type: 'sales_consumption', storeId: sale.storeId, itemId: r.itemId, direction: 'out', qty: Number(r.qty || 0) * sale.qty, unitCost: avgCost(state, r.itemId), ref: sale.ref, note: 'Pilot recipe consumption' }));
  const cogs = moves.reduce((s: number, m: any) => s + Number(m.qty || 0) * Number(m.unitCost || 0), 0);
  const je = { id: 'PILOT-JE-POS-001', date: today(), ref: sale.ref, source: 'pilot_pos_day', description: 'Pilot POS day', status: 'posted', lines: [{ id: id('JL'), accountCode: '1010', debit: gross, credit: 0, branchId: 'PILOT-BR1', memo: 'Cash' }, { id: id('JL'), accountCode: '4000', debit: 0, credit: net, branchId: 'PILOT-BR1', memo: 'Revenue' }, { id: id('JL'), accountCode: '2200', debit: 0, credit: vat, branchId: 'PILOT-BR1', memo: 'VAT output' }, { id: id('JL'), accountCode: '5000', debit: cogs, credit: 0, branchId: 'PILOT-BR1', memo: 'COGS' }, { id: id('JL'), accountCode: '1300', debit: 0, credit: cogs, branchId: 'PILOT-BR1', memo: 'Inventory consumption' }] };
  const next = audit({ ...state, sales: [...arr(state.sales), sale], stockMovements: [...arr(state.stockMovements), ...moves], journals: [...arr(state.journals), je] }, 'post', 'pilot_pos_day', 'PILOT-AUTO:post.pos.day', 'Posted pilot POS day.');
  return { ok: true, stepKey: 'post.pos.day', message: 'Pilot POS day posted.', state: next, proof: { gross, net, vat, cogs }, warnings: [] };
}

function postStockAdjustment(state: any): PilotResult {
  if (arr(state.inventoryApprovals).some((x: any) => x.ref === 'ADJ-PILOT-001')) return { ok: true, stepKey: 'post.stock.adjustment', message: 'Adjustment already exists.', state, proof: { idempotent: true }, warnings: [] };
  if (stock(state, 'PILOT-STORE-KITCHEN', 'PILOT-ITEM-CHEESE') < 1) return { ok: false, stepKey: 'post.stock.adjustment', message: 'Not enough cheese in kitchen. Run purchase/POS steps first.', state, proof: {}, warnings: [] };
  const qty = 1, cost = avgCost(state, 'PILOT-ITEM-CHEESE'), value = qty * cost;
  const adj = { id: 'PILOT-ADJ-001', ref: 'ADJ-PILOT-001', date: today(), requestType: 'adjustment', status: 'posted', storeId: 'PILOT-STORE-KITCHEN', itemId: 'PILOT-ITEM-CHEESE', direction: 'out', qty, unitCost: cost, costCenterId: 'PILOT-CC-KITCHEN', reason: 'Pilot damage adjustment', note: 'Generated by pilot automation', requestedBy: 'Pilot Automation' };
  const move = { id: id('MOV'), date: today(), type: 'adjustment', storeId: adj.storeId, itemId: adj.itemId, direction: 'out', qty, unitCost: cost, ref: adj.ref, note: adj.reason };
  const je = { id: 'PILOT-JE-ADJ-001', date: today(), ref: adj.ref, source: 'pilot_stock_adjustment', description: 'Pilot stock adjustment', status: 'posted', lines: [{ id: id('JL'), accountCode: '5100', debit: value, credit: 0, branchId: 'PILOT-BR1', memo: 'Stock variance' }, { id: id('JL'), accountCode: '1300', debit: 0, credit: value, branchId: 'PILOT-BR1', memo: 'Inventory reduction' }] };
  const next = audit({ ...state, inventoryApprovals: [...arr(state.inventoryApprovals), adj], stockMovements: [...arr(state.stockMovements), move], journals: [...arr(state.journals), je] }, 'post', 'pilot_stock_adjustment', 'PILOT-AUTO:post.stock.adjustment', 'Posted pilot stock adjustment.');
  return { ok: true, stepKey: 'post.stock.adjustment', message: 'Pilot stock adjustment posted.', state: next, proof: { qty, cost, value }, warnings: [] };
}

function closeVatPeriod(state: any): PilotResult {
  if (arr(state.journals).some((x: any) => x.ref === 'VAT-PILOT-001')) return { ok: true, stepKey: 'close.vat.period', message: 'VAT settlement already exists.', state, proof: { idempotent: true }, warnings: [] };
  const lines = arr(state.journals).flatMap((j: any) => arr(j.lines));
  const debit = (code: string) => lines.filter((l: any) => l.accountCode === code).reduce((s: number, l: any) => s + Number(l.debit || 0), 0);
  const credit = (code: string) => lines.filter((l: any) => l.accountCode === code).reduce((s: number, l: any) => s + Number(l.credit || 0), 0);
  const vatInput = debit('1400') - credit('1400'), vatOutput = credit('2200') - debit('2200'), payable = vatOutput - vatInput;
  const je = { id: 'PILOT-JE-VAT-001', date: today(), ref: 'VAT-PILOT-001', source: 'pilot_vat_settlement', description: 'Pilot VAT settlement', status: 'posted', lines: [{ id: id('JL'), accountCode: '2200', debit: vatOutput, credit: 0, branchId: 'PILOT-BR1', memo: 'Clear output VAT' }, { id: id('JL'), accountCode: '1400', debit: 0, credit: vatInput, branchId: 'PILOT-BR1', memo: 'Clear input VAT' }, { id: id('JL'), accountCode: '2300', debit: payable < 0 ? Math.abs(payable) : 0, credit: payable >= 0 ? payable : 0, branchId: 'PILOT-BR1', memo: 'VAT settlement' }] };
  const next = audit({ ...state, journals: [...arr(state.journals), je], fiscalPeriods: arr(state.fiscalPeriods).map((p: any) => p.code === 'PILOT-2026-05' ? { ...p, status: 'closed', lockedBy: 'pilot-automation', lockedAt: nowIso() } : p) }, 'close', 'pilot_vat_period', 'PILOT-AUTO:close.vat.period', 'Closed pilot VAT/period evidence.');
  return { ok: true, stepKey: 'close.vat.period', message: 'Pilot VAT settlement and close recorded.', state: next, proof: { vatInput, vatOutput, payable }, warnings: ['Production close must still be tested through server RPC and RLS in staging.'] };
}
