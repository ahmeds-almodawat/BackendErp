import { useMemo, useState, type ReactNode } from 'react';
import {
  AlertTriangle,
  Archive,
  BadgeCheck,
  Banknote,
  BarChart3,
  CalendarCheck,
  CheckCircle2,
  ClipboardCheck,
  Database,
  Download,
  FileSpreadsheet,
  Landmark,
  Layers,
  ListChecks,
  LockKeyhole,
  PieChart,
  RefreshCw,
  ShieldCheck,
  ShoppingCart,
  Store,
  TrendingUp,
  Wallet,
} from 'lucide-react';

type Locale = 'en' | 'ar';
type Tone = 'good' | 'warn' | 'bad' | 'info';
type MegaTab = 'close' | 'foodcost' | 'purchase' | 'finance' | 'inventory' | 'foodics' | 'permissions' | 'quality' | 'backend' | 'qa';
type Props = { state: any; totals: any; update?: (fn: (s: any) => any, success?: string) => void; locale: Locale; notify?: (type: 'success' | 'warning' | 'error', message: string) => void };

type ControlRow = { area: string; control: string; status: 'ready' | 'review' | 'missing'; risk: string; owner: string; nextAction: string };

type FoodCostRow = { store: string; sku: string; item: string; theoreticalQty: number; actualIssueQty: number; countVarianceQty: number; avgCost: number; theoreticalValue: number; varianceValue: number; risk: string };

type PurchaseVarianceRow = { po: string; supplier: string; sku: string; item: string; orderedQty: number; receivedQty: number; invoicedQty: number; poCost: number; invoiceCost: number; qtyVariance: number; priceVariance: number };

function L(locale: Locale, en: string, ar: string) { return locale === 'ar' ? ar : en; }
function today() { return new Date().toISOString().slice(0, 10); }
function startOfMonthIso(dateValue = today()) { const d = new Date(dateValue + 'T00:00:00'); return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10); }
function endOfMonthIso(dateValue = today()) { const d = new Date(dateValue + 'T00:00:00'); return new Date(d.getFullYear(), d.getMonth() + 1, 0).toISOString().slice(0, 10); }
function dateInRange(dateValue?: string, from?: string, to?: string) { const d = String(dateValue || '').slice(0, 10); if (!d) return false; if (from && d < from) return false; if (to && d > to) return false; return true; }
function money(value: number, locale: Locale) { return new Intl.NumberFormat(locale === 'ar' ? 'ar-SA' : 'en-US', { style: 'currency', currency: 'SAR', maximumFractionDigits: 2 }).format(Number(value || 0)); }
function num(value: number, digits = 2) { return Number(value || 0).toLocaleString(undefined, { maximumFractionDigits: digits }); }
function daysBetween(date: string, end = today()) { const a = new Date(`${date || end}T00:00:00`).getTime(); const b = new Date(`${end}T00:00:00`).getTime(); return Math.max(0, Math.floor((b - a) / 86400000)); }
function csv(rows: Array<Record<string, any>>) { if (!rows.length) return ''; const headers = Object.keys(rows[0]); const esc = (v: any) => { const s = String(v ?? ''); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; }; return [headers.join(','), ...rows.map((r) => headers.map((h) => esc(r[h])).join(','))].join('\n'); }
function saveFile(fileName: string, content: string, mime = 'text/csv;charset=utf-8') { const blob = new Blob([content], { type: mime }); const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = fileName; a.click(); URL.revokeObjectURL(url); }
function localArray<T = any>(state: any, key: string): T[] { return Array.isArray(state?.[key]) ? state[key] : []; }
function itemName(state: any, itemId: string, locale: Locale) { const item = localArray(state, 'items').find((x: any) => x.id === itemId || x.sku === itemId); return item ? (locale === 'ar' ? item.nameAr || item.nameEn : item.nameEn || item.nameAr) : itemId || '—'; }
function itemSku(state: any, itemId: string) { return localArray(state, 'items').find((x: any) => x.id === itemId)?.sku || itemId || '—'; }
function storeName(state: any, storeId: string, locale: Locale) { const store = localArray(state, 'stores').find((x: any) => x.id === storeId || x.code === storeId); return store ? `${store.code} — ${locale === 'ar' ? store.nameAr || store.nameEn : store.nameEn || store.nameAr}` : storeId || '—'; }
function supplierName(state: any, supplierId: string) { return localArray(state, 'suppliers').find((x: any) => x.id === supplierId)?.name || supplierId || '—'; }
function journalAmountByAccount(state: any, accountCode: string) { return localArray(state, 'journals').filter((j: any) => j.status === 'posted').flatMap((j: any) => j.lines || []).filter((l: any) => l.accountCode === accountCode).reduce((sum: number, l: any) => sum + Number(l.debit || 0) - Number(l.credit || 0), 0); }
function stockBalance(state: any, storeId: string, itemId: string, toDate?: string) { return localArray(state, 'stockMovements').filter((m: any) => m.storeId === storeId && m.itemId === itemId && (!toDate || String(m.date || '').slice(0, 10) <= toDate)).reduce((sum: number, m: any) => sum + (m.direction === 'in' ? 1 : -1) * Number(m.qty || 0), 0); }
function avgCost(state: any, itemId: string) { const inbound = localArray(state, 'stockMovements').filter((m: any) => m.itemId === itemId && m.direction === 'in' && Number(m.unitCost || 0) > 0 && Number(m.qty || 0) > 0); const qty = inbound.reduce((s: number, m: any) => s + Number(m.qty || 0), 0); const value = inbound.reduce((s: number, m: any) => s + Number(m.qty || 0) * Number(m.unitCost || 0), 0); return qty > 0 ? value / qty : Number(localArray(state, 'items').find((x: any) => x.id === itemId)?.standardCost || 0); }
function bucketByAge(days: number) { if (days <= 30) return '0-30'; if (days <= 60) return '31-60'; if (days <= 90) return '61-90'; return '90+'; }
function statusTone(status: ControlRow['status']): Tone { return status === 'ready' ? 'good' : status === 'review' ? 'warn' : 'bad'; }
function healthScore(rows: ControlRow[]) { if (!rows.length) return 0; return Math.round((rows.filter((r) => r.status === 'ready').length / rows.length) * 100); }

function Card({ title, icon, action, children }: { title: string; icon?: ReactNode; action?: ReactNode; children: ReactNode }) { return <section className="card"><div className="card-header"><div className="card-title">{icon}{title}</div>{action}</div>{children}</section>; }
function KPI({ label, value, hint, icon }: { label: string; value: string; hint: string; icon: ReactNode }) { return <div className="kpi"><div className="kpi-icon">{icon}</div><div><span>{label}</span><strong>{value}</strong><small>{hint}</small></div></div>; }
function Table({ headers, rows }: { headers: ReactNode[]; rows: ReactNode[][] }) { return <div className="table-wrap"><table><thead><tr>{headers.map((h, i) => <th key={i}>{h}</th>)}</tr></thead><tbody>{rows.length ? rows.map((r, i) => <tr key={i}>{r.map((c, ci) => <td key={ci}>{c}</td>)}</tr>) : <tr><td colSpan={headers.length}>—</td></tr>}</tbody></table></div>; }
function TabButton({ active, value, onClick, children }: { active: string; value: string; onClick: (v: MegaTab) => void; children: ReactNode }) { return <button className={active === value ? 'active-tab' : ''} onClick={() => onClick(value as MegaTab)}>{children}</button>; }
function Pill({ tone, children }: { tone: Tone; children: ReactNode }) { return <span className={`pill ${tone}`}>{children}</span>; }

function buildControlRows(state: any, from: string, to: string, locale: Locale): ControlRow[] {
  const sales = localArray(state, 'sales').filter((s: any) => dateInRange(s.date, from, to));
  const journals = localArray(state, 'journals').filter((j: any) => dateInRange(j.date, from, to));
  const movements = localArray(state, 'stockMovements').filter((m: any) => dateInRange(m.date, from, to));
  const pendingApprovals = localArray(state, 'inventoryApprovals').filter((a: any) => a.status === 'pending');
  const negativeRows = localArray(state, 'stores').flatMap((store: any) => localArray(state, 'items').map((item: any) => ({ store, item, balance: stockBalance(state, store.id, item.id, to) }))).filter((r: any) => r.balance < -0.001);
  const zeroCostDemand = movements.filter((m: any) => m.direction === 'out' && avgCost(state, m.itemId) <= 0).length;
  const grni = Math.abs(journalAmountByAccount(state, '2110'));
  return [
    { area: 'Close', control: L(locale, 'Foodics / sales posted for selected period', 'تم ترحيل مبيعات فودكس / المبيعات للفترة'), status: sales.length > 0 ? 'ready' : 'missing', risk: L(locale, 'Sales close cannot be completed without posted sales or report-only signoff.', 'لا يكتمل إغلاق المبيعات بدون ترحيل أو اعتماد تقرير فقط.'), owner: 'Operations / Finance', nextAction: L(locale, 'Upload Foodics files and approve/post batch.', 'ارفع ملفات فودكس واعتمد/رحّل الدفعة.') },
    { area: 'Close', control: L(locale, 'Stock movement exists for the period', 'توجد حركات مخزون للفترة'), status: movements.length > 0 ? 'ready' : 'review', risk: L(locale, 'No stock movement may mean missing purchases, opening stock, or sales consumption.', 'عدم وجود حركة قد يعني نقص المشتريات أو الأرصدة الافتتاحية أو استهلاك المبيعات.'), owner: 'Storekeeper', nextAction: L(locale, 'Post opening stock, GRN, production, sales consumption, or count variance.', 'رحّل الأرصدة أو الاستلام أو الإنتاج أو استهلاك المبيعات أو فروقات الجرد.') },
    { area: 'Close', control: L(locale, 'Inventory variances approved', 'اعتماد فروقات الجرد'), status: pendingApprovals.length === 0 ? 'ready' : 'review', risk: `${pendingApprovals.length} pending`, owner: 'Inventory Controller', nextAction: L(locale, 'Review Inventory → Approval Queue.', 'راجع المخزون ← قائمة الاعتمادات.') },
    { area: 'Inventory', control: L(locale, 'No negative stock', 'لا يوجد مخزون سالب'), status: negativeRows.length === 0 ? 'ready' : 'review', risk: `${negativeRows.length} negative rows`, owner: 'Storekeeper', nextAction: L(locale, 'Upload count/opening stock or reverse wrong issue.', 'ارفع الجرد/الأرصدة أو اعكس الصرف الخطأ.') },
    { area: 'Inventory', control: L(locale, 'No zero-cost consumption demand', 'لا يوجد استهلاك بتكلفة صفرية'), status: zeroCostDemand === 0 ? 'ready' : 'review', risk: `${zeroCostDemand} rows`, owner: 'Finance / Costing', nextAction: L(locale, 'Post purchase/opening stock with unit cost before final COGS.', 'رحّل شراء/رصيد افتتاحي بتكلفة قبل تكلفة المبيعات النهائية.') },
    { area: 'Finance', control: L(locale, 'Journals posted for period', 'قيود مرحلة للفترة'), status: journals.length > 0 ? 'ready' : 'review', risk: `${journals.length} posted journals`, owner: 'Finance', nextAction: L(locale, 'Review journal register and period close pack.', 'راجع سجل القيود وحزمة الإغلاق.') },
    { area: 'Finance', control: L(locale, 'GRNI under control', 'رقابة بضائع مستلمة غير مفوترة'), status: grni < 1 ? 'ready' : 'review', risk: money(grni, locale), owner: 'AP Accountant', nextAction: L(locale, 'Match GRN to supplier invoice or explain open GRNI.', 'طابق الاستلام مع فاتورة المورد أو فسّر الرصيد المفتوح.') },
  ];
}

function buildFoodCostRows(state: any, from: string, to: string, locale: Locale): FoodCostRow[] {
  const sales = localArray(state, 'sales').filter((s: any) => s.posted && dateInRange(s.date, from, to));
  const rows = new Map<string, FoodCostRow>();
  sales.forEach((sale: any) => {
    const recipeLines = localArray(state, 'recipeLines').filter((r: any) => r.menuItemId === sale.menuItemId);
    recipeLines.forEach((line: any) => {
      const key = `${sale.storeId}|${line.itemId}`;
      const c = avgCost(state, line.itemId);
      const demand = Number(line.qty || 0) * Number(sale.qty || 0) * (1 + Number(line.wastagePct || 0) / 100);
      const current = rows.get(key) || { store: storeName(state, sale.storeId, locale), sku: itemSku(state, line.itemId), item: itemName(state, line.itemId, locale), theoreticalQty: 0, actualIssueQty: 0, countVarianceQty: 0, avgCost: c, theoreticalValue: 0, varianceValue: 0, risk: '' };
      current.theoreticalQty += demand;
      current.theoreticalValue += demand * c;
      current.avgCost = c;
      rows.set(key, current);
    });
  });
  localArray(state, 'stockMovements').filter((m: any) => dateInRange(m.date, from, to)).forEach((m: any) => {
    const key = `${m.storeId}|${m.itemId}`;
    const current = rows.get(key);
    if (!current) return;
    if (m.direction === 'out' && ['sales_consumption', 'production', 'adjustment', 'count_variance'].includes(String(m.type))) current.actualIssueQty += Number(m.qty || 0);
    if (String(m.type) === 'count_variance') current.countVarianceQty += (m.direction === 'in' ? 1 : -1) * Number(m.qty || 0);
  });
  return Array.from(rows.values()).map((r) => ({ ...r, varianceValue: r.countVarianceQty * r.avgCost, risk: r.avgCost <= 0 ? L(locale, 'Zero cost', 'تكلفة صفرية') : Math.abs(r.countVarianceQty) > 0.001 ? L(locale, 'Count variance', 'فرق جرد') : L(locale, 'OK', 'سليم') }));
}

function buildPurchaseVarianceRows(state: any): PurchaseVarianceRow[] {
  return localArray(state, 'purchaseOrders').flatMap((po: any) => (po.lines || []).map((line: any) => {
    const invoiceLines = localArray(state, 'purchaseInvoices').flatMap((inv: any) => (inv.lines || []).filter((x: any) => x.itemId === line.itemId).map((x: any) => ({ ...x, invoice: inv })));
    const invoicedQty = invoiceLines.reduce((s: number, x: any) => s + Number(x.qty || 0), 0);
    const invoiceCost = invoiceLines.length ? invoiceLines.reduce((s: number, x: any) => s + Number(x.unitCost || 0) * Number(x.qty || 0), 0) / Math.max(invoicedQty, 1) : 0;
    return { po: po.ref, supplier: supplierName(state, po.supplierId), sku: itemSku(state, line.itemId), item: itemName(state, line.itemId, 'en'), orderedQty: Number(line.qty || 0), receivedQty: Number(line.receivedQty || 0), invoicedQty, poCost: Number(line.unitCost || 0), invoiceCost, qtyVariance: Number(line.receivedQty || 0) - invoicedQty, priceVariance: invoiceCost - Number(line.unitCost || 0) };
  }));
}

function buildApAging(state: any) {
  return localArray(state, 'purchaseInvoices').filter((inv: any) => inv.status === 'posted').map((inv: any) => {
    const total = (inv.lines || []).reduce((s: number, l: any) => s + Number(l.qty || 0) * Number(l.unitCost || 0) * (1 + Number(l.vatRate || 0) / 100), 0);
    const paid = localArray(state, 'supplierPayments').filter((p: any) => p.status === 'posted' && (!p.invoiceRef || p.invoiceRef === inv.ref)).reduce((s: number, p: any) => s + Number(p.amount || 0), 0);
    const open = Math.max(total - paid, 0);
    return { ref: inv.ref, supplier: supplierName(state, inv.supplierId), date: inv.invoiceDate || inv.date, open, bucket: bucketByAge(daysBetween(inv.invoiceDate || inv.date)) };
  }).filter((r: any) => r.open > 0.01);
}
function buildArAging(state: any) { return localArray(state, 'arInvoices').map((r: any) => ({ ref: r.ref, customer: r.customer, date: r.date, open: Math.max(Number(r.amount || 0) * (1 + Number(r.vatRate || 0) / 100) - Number(r.paidAmount || 0), 0), bucket: bucketByAge(daysBetween(r.date)) })).filter((r: any) => r.open > 0.01); }
function getFoodicsMeta() {
  try {
    const keys = Object.keys(localStorage).filter((key) => key.toLowerCase().includes('foodics'));
    return keys.map((key) => ({ key, length: String(localStorage.getItem(key) || '').length }));
  } catch {
    return [];
  }
}

export default function EnterpriseMegaPatchPage({ state, totals, update, locale, notify }: Props) {
  const [tab, setTab] = useState<MegaTab>('close');
  const [from, setFrom] = useState(startOfMonthIso());
  const [to, setTo] = useState(endOfMonthIso());
  const controls = useMemo(() => buildControlRows(state, from, to, locale), [state, from, to, locale]);
  const foodCostRows = useMemo(() => buildFoodCostRows(state, from, to, locale), [state, from, to, locale]);
  const purchaseRows = useMemo(() => buildPurchaseVarianceRows(state), [state]);
  const apAging = useMemo(() => buildApAging(state), [state]);
  const arAging = useMemo(() => buildArAging(state), [state]);
  const stores = localArray(state, 'stores');
  const items = localArray(state, 'items');
  const journals = localArray(state, 'journals').filter((j: any) => dateInRange(j.date, from, to));
  const stockRiskRows = stores.flatMap((store: any) => items.map((item: any) => ({ store, item, balance: stockBalance(state, store.id, item.id, to), cost: avgCost(state, item.id) }))).filter((r: any) => r.balance < -0.001 || (r.balance > 0.001 && r.cost <= 0)).slice(0, 250);
  const duplicateSkuCount = items.length - new Set(items.map((x: any) => String(x.sku || '').trim()).filter(Boolean)).size;
  const duplicateStoreCount = stores.length - new Set(stores.map((x: any) => String(x.code || '').trim()).filter(Boolean)).size;
  const suppliersMissingBank = localArray(state, 'suppliers').filter((s: any) => !s.bankName || !s.bankAccount || !s.vatNo);
  const permissionCritical = [
    ['finance.journal.post', L(locale, 'Post journals', 'ترحيل القيود')], ['finance.period.lock', L(locale, 'Lock periods', 'قفل الفترات')], ['purchasing.po.approve', L(locale, 'Approve purchase order', 'اعتماد أمر الشراء')], ['purchasing.grn.post', L(locale, 'Post GRN', 'ترحيل استلام البضاعة')], ['inventory.adjustment.approve', L(locale, 'Approve stock variance', 'اعتماد فرق المخزون')], ['sales.foodics.post', L(locale, 'Post Foodics sales', 'ترحيل مبيعات فودكس')], ['access.manage', L(locale, 'Manage access', 'إدارة الصلاحيات')], ['imports.manage', L(locale, 'Manage imports', 'إدارة الاستيراد')]
  ];
  const permissions = localArray(state, 'roles').flatMap((r: any) => r.permissions || []);
  const missingPermissions = permissionCritical.filter(([key]) => !permissions.includes(key));
  const score = healthScore(controls);
  const foodicsMeta = getFoodicsMeta();
  const closeReady = controls.every((c) => c.status === 'ready');
  const exportAll = () => {
    const rows = [
      ...controls.map((r) => ({ sheet: 'close_controls', ...r })),
      ...foodCostRows.map((r) => ({ sheet: 'food_cost', ...r })),
      ...purchaseRows.map((r) => ({ sheet: 'purchase_variance', ...r })),
      ...apAging.map((r: any) => ({ sheet: 'ap_aging', ...r })),
      ...arAging.map((r: any) => ({ sheet: 'ar_aging', ...r })),
      ...stockRiskRows.map((r: any) => ({ sheet: 'inventory_risk', store: r.store.code, sku: r.item.sku, balance: r.balance, cost: r.cost }))
    ];
    saveFile(`v55_enterprise_control_pack_${from}_${to}.csv`, csv(rows));
  };
  const exportQa = () => saveFile('v55_qa_regression_plan.csv', csv(qaRows(locale)));
  const closePeriod = () => {
    if (!update) return;
    update((current: any) => ({ ...current, fiscalPeriods: localArray(current, 'fiscalPeriods').map((p: any) => dateInRange(p.startDate, from, to) || (p.startDate === from && p.endDate === to) ? { ...p, status: 'closed', lockedBy: 'Local Admin', lockedAt: new Date().toISOString() } : p) }), L(locale, 'Local trial period close flag updated', 'تم تحديث إشارة إغلاق الفترة المحلية'));
    notify?.('success', L(locale, 'Close control updated locally', 'تم تحديث رقابة الإغلاق محلياً'));
  };

  return <div className="page-grid">
    <Card title={L(locale, 'Enterprise HQ v55 — ultra control patch', 'مركز المؤسسة v55 — حزمة رقابية فائقة')} icon={<ShieldCheck/>} action={<div className="button-row"><input type="date" value={from} onChange={(e) => setFrom(e.target.value)}/><input type="date" value={to} onChange={(e) => setTo(e.target.value)}/><button onClick={exportAll}><Download size={16}/>{L(locale, 'Export control pack', 'تصدير حزمة الرقابة')}</button><button onClick={exportQa}><FileSpreadsheet size={16}/>{L(locale, 'Export QA plan', 'تصدير خطة الاختبار')}</button></div>}>
      <div className="kpi-grid"><KPI label={L(locale, 'Enterprise control score', 'درجة الرقابة المؤسسية')} value={`${score}%`} hint={closeReady ? L(locale, 'Close-ready locally', 'جاهز للإغلاق محلياً') : L(locale, 'Review blockers', 'راجع الملاحظات')} icon={<BadgeCheck/>}/><KPI label={L(locale, 'Inventory risk rows', 'صفوف مخاطر المخزون')} value={`${stockRiskRows.length}`} hint={L(locale, 'Negative or zero-cost stock', 'مخزون سالب أو بتكلفة صفرية')} icon={<Archive/>}/><KPI label={L(locale, 'Foodics local stores', 'تخزين فودكس المحلي')} value={`${foodicsMeta.length}`} hint={L(locale, 'Saved browser keys', 'مفاتيح محفوظة بالمتصفح')} icon={<Database/>}/><KPI label={L(locale, 'Journals in period', 'قيود الفترة')} value={`${journals.length}`} hint={money(totals?.netIncome || 0, locale)} icon={<Landmark/>}/></div>
      <div className="tab-row">
        <TabButton active={tab} value="close" onClick={setTab}>{L(locale, '1 Close Cockpit', '١ الإغلاق')}</TabButton>
        <TabButton active={tab} value="foodcost" onClick={setTab}>{L(locale, '2 Food Cost', '٢ تكلفة الطعام')}</TabButton>
        <TabButton active={tab} value="purchase" onClick={setTab}>{L(locale, '3 Purchase Variance', '٣ انحراف الشراء')}</TabButton>
        <TabButton active={tab} value="finance" onClick={setTab}>{L(locale, '4 Finance Close', '٤ إغلاق المالية')}</TabButton>
        <TabButton active={tab} value="inventory" onClick={setTab}>{L(locale, '5 Inventory Risk', '٥ مخاطر المخزون')}</TabButton>
        <TabButton active={tab} value="foodics" onClick={setTab}>{L(locale, '6 Foodics Close', '٦ إغلاق فودكس')}</TabButton>
        <TabButton active={tab} value="permissions" onClick={setTab}>{L(locale, '7 Permissions', '٧ الصلاحيات')}</TabButton>
        <TabButton active={tab} value="quality" onClick={setTab}>{L(locale, '8 Data Quality', '٨ جودة البيانات')}</TabButton>
        <TabButton active={tab} value="backend" onClick={setTab}>{L(locale, '9 Backend Plan', '٩ الخطة الخلفية')}</TabButton>
        <TabButton active={tab} value="qa" onClick={setTab}>{L(locale, '10 QA Tests', '١٠ الاختبارات')}</TabButton>
      </div>
      <div className="notice">{L(locale, 'This page combines v42–v55 style controls in one local-first enterprise cockpit. It does not replace Supabase backend; it prepares the logic and control checklist before migration.', 'هذه الصفحة تجمع رقابات v42–v55 في مركز مؤسسي محلي. لا تغني عن خلفية Supabase، لكنها تجهز المنطق وقوائم الرقابة قبل النقل.')}</div>
    </Card>

    {tab === 'close' && <Card title={L(locale, 'Monthly close cockpit', 'مركز الإغلاق الشهري')} icon={<CalendarCheck/>} action={<button disabled={!closeReady} onClick={closePeriod}><LockKeyhole size={16}/>{L(locale, 'Mark period closed locally', 'تعليم الفترة كمغلقة محلياً')}</button>}><Table headers={[L(locale, 'Area', 'المجال'), L(locale, 'Control', 'الرقابة'), L(locale, 'Status', 'الحالة'), L(locale, 'Risk', 'الخطر'), L(locale, 'Owner', 'المسؤول'), L(locale, 'Next action', 'الإجراء التالي')]} rows={controls.map((r) => [r.area, r.control, <Pill tone={statusTone(r.status)}>{r.status}</Pill>, r.risk, r.owner, r.nextAction])}/></Card>}

    {tab === 'foodcost' && <Card title={L(locale, 'Theoretical vs actual food cost', 'تكلفة الطعام النظرية مقابل الفعلية')} icon={<PieChart/>} action={<button onClick={() => saveFile(`v55_food_cost_${from}_${to}.csv`, csv(foodCostRows as any))}><Download size={16}/>{L(locale, 'Export', 'تصدير')}</button>}><Table headers={[L(locale, 'Store', 'المخزن'), 'SKU', L(locale, 'Item', 'الصنف'), L(locale, 'Theoretical qty', 'الكمية النظرية'), L(locale, 'Actual issue', 'الصرف الفعلي'), L(locale, 'Count variance', 'فرق الجرد'), L(locale, 'Avg cost', 'متوسط التكلفة'), L(locale, 'Theoretical value', 'القيمة النظرية'), L(locale, 'Risk', 'الخطر')]} rows={foodCostRows.map((r) => [r.store, r.sku, r.item, num(r.theoreticalQty, 3), num(r.actualIssueQty, 3), num(r.countVarianceQty, 3), money(r.avgCost, locale), money(r.theoreticalValue, locale), <Pill tone={r.risk.includes('Zero') || r.risk.includes('صفر') ? 'bad' : r.risk.includes('Variance') || r.risk.includes('فرق') ? 'warn' : 'good'}>{r.risk}</Pill>])}/></Card>}

    {tab === 'purchase' && <Card title={L(locale, 'Purchase variance controls', 'رقابة انحرافات الشراء')} icon={<ShoppingCart/>} action={<button onClick={() => saveFile('v55_purchase_variance.csv', csv(purchaseRows as any))}><Download size={16}/>{L(locale, 'Export', 'تصدير')}</button>}><Table headers={['PO', L(locale, 'Supplier', 'المورد'), 'SKU', L(locale, 'Item', 'الصنف'), L(locale, 'Ordered', 'المطلوب'), L(locale, 'Received', 'المستلم'), L(locale, 'Invoiced', 'المفوتر'), L(locale, 'PO cost', 'سعر الأمر'), L(locale, 'Invoice cost', 'سعر الفاتورة'), L(locale, 'Risk', 'الخطر')]} rows={purchaseRows.map((r) => [r.po, r.supplier, r.sku, r.item, num(r.orderedQty), num(r.receivedQty), num(r.invoicedQty), money(r.poCost, locale), money(r.invoiceCost, locale), Math.abs(r.qtyVariance) > 0.001 || Math.abs(r.priceVariance) > 0.001 ? <Pill tone="warn">{L(locale, 'Variance', 'انحراف')}</Pill> : <Pill tone="good">{L(locale, 'Matched', 'مطابق')}</Pill>])}/></Card>}

    {tab === 'finance' && <div className="page-grid"><div className="kpi-grid"><KPI label="AP Aging" value={money(apAging.reduce((s: number, r: any) => s + r.open, 0), locale)} hint={`${apAging.length} ${L(locale, 'open rows', 'صفوف مفتوحة')}`} icon={<Wallet/>}/><KPI label="AR Aging" value={money(arAging.reduce((s: number, r: any) => s + r.open, 0), locale)} hint={`${arAging.length} ${L(locale, 'open rows', 'صفوف مفتوحة')}`} icon={<Banknote/>}/><KPI label={L(locale, 'Unmatched bank', 'بنكي غير مطابق')} value={`${localArray(state, 'bankReconLines').filter((r: any) => r.status !== 'matched').length}`} hint={L(locale, 'Bank recon exceptions', 'استثناءات مطابقة بنكية')} icon={<Landmark/>}/><KPI label="VAT Payable" value={money((totals?.vatOutput || 0) - (totals?.vatInput || 0), locale)} hint={L(locale, 'Output - Input', 'مخرجات - مدخلات')} icon={<FileSpreadsheet/>}/></div><Card title={L(locale, 'Finance close pack', 'حزمة الإغلاق المالي')} icon={<Landmark/>}><Table headers={[L(locale, 'Section', 'القسم'), L(locale, 'Ref', 'المرجع'), L(locale, 'Name', 'الاسم'), L(locale, 'Date', 'التاريخ'), L(locale, 'Open amount', 'المبلغ المفتوح'), L(locale, 'Bucket', 'الفئة')]} rows={[...apAging.map((r: any) => ['AP', r.ref, r.supplier, r.date, money(r.open, locale), r.bucket]), ...arAging.map((r: any) => ['AR', r.ref, r.customer, r.date, money(r.open, locale), r.bucket]), ...localArray(state, 'bankReconLines').filter((r: any) => r.status !== 'matched').map((r: any) => ['Bank', r.id, r.description, r.date, money(r.statementAmount, locale), r.status])]}/></Card></div>}

    {tab === 'inventory' && <Card title={L(locale, 'Inventory risk cockpit', 'مركز مخاطر المخزون')} icon={<Archive/>} action={<button onClick={() => saveFile('v55_inventory_risk.csv', csv(stockRiskRows.map((r: any) => ({ store: r.store.code, sku: r.item.sku, item: r.item.nameEn, balance: r.balance, cost: r.cost }))))}><Download size={16}/>{L(locale, 'Export risks', 'تصدير المخاطر')}</button>}><Table headers={[L(locale, 'Store', 'المخزن'), 'SKU', L(locale, 'Item', 'الصنف'), L(locale, 'Balance', 'الرصيد'), L(locale, 'Avg cost', 'متوسط التكلفة'), L(locale, 'Risk', 'الخطر')]} rows={stockRiskRows.map((r: any) => [r.store.code, r.item.sku, locale === 'ar' ? r.item.nameAr || r.item.nameEn : r.item.nameEn || r.item.nameAr, num(r.balance, 3), money(r.cost, locale), r.balance < -0.001 ? <Pill tone="bad">{L(locale, 'Negative stock', 'رصيد سالب')}</Pill> : <Pill tone="warn">{L(locale, 'Zero cost stock', 'مخزون بتكلفة صفرية')}</Pill>])}/></Card>}

    {tab === 'foodics' && <Card title={L(locale, 'Foodics sales close readiness', 'جاهزية إغلاق مبيعات فودكس')} icon={<BarChart3/>}><div className="kpi-grid"><KPI label={L(locale, 'Foodics local keys', 'مفاتيح فودكس المحلية')} value={`${foodicsMeta.length}`} hint={L(locale, 'Upload/mapping persistence check', 'فحص حفظ الرفع والخرائط')} icon={<Database/>}/><KPI label={L(locale, 'Posted sales docs', 'مستندات مبيعات مرحلة')} value={`${localArray(state, 'sales').filter((s: any) => s.posted && dateInRange(s.date, from, to)).length}`} hint={L(locale, 'Selected period', 'الفترة المحددة')} icon={<BadgeCheck/>}/><KPI label={L(locale, 'COGS journal signals', 'مؤشرات قيود التكلفة')} value={`${journals.filter((j: any) => String(j.source || '').toLowerCase().includes('sale') || String(j.description || '').toLowerCase().includes('cogs')).length}`} hint={L(locale, 'Sales accounting control', 'رقابة محاسبة المبيعات')} icon={<PieChart/>}/><KPI label={L(locale, 'Payment mappings', 'خرائط الدفع')} value={`${foodicsMeta.filter((x) => x.key.toLowerCase().includes('payment')).length}`} hint={L(locale, 'Browser-local readiness', 'جاهزية محلية بالمتصفح')} icon={<Wallet/>}/></div><Table headers={[L(locale, 'Local key', 'المفتاح المحلي'), L(locale, 'Stored bytes', 'الحجم المحفوظ')]} rows={foodicsMeta.map((r) => [r.key, num(r.length, 0)])}/></Card>}

    {tab === 'permissions' && <Card title={L(locale, 'Critical permission coverage map', 'خريطة تغطية الصلاحيات الحرجة')} icon={<ShieldCheck/>}><Table headers={[L(locale, 'Permission key', 'مفتاح الصلاحية'), L(locale, 'Action', 'الإجراء'), L(locale, 'Coverage', 'التغطية')]} rows={permissionCritical.map(([key, label]) => [key, label, permissions.includes(key) ? <Pill tone="good">{L(locale, 'Configured', 'معدّة')}</Pill> : <Pill tone="warn">{L(locale, 'Missing from roles', 'غير موجودة بالأدوار')}</Pill>])}/><div className="notice">{missingPermissions.length ? L(locale, 'Demo mode may still allow actions when no role is configured. Production mode must enforce all missing keys through Supabase/RLS/Edge Functions.', 'قد يسمح وضع التجربة ببعض الإجراءات عند عدم وجود دور. الإنتاج يجب أن يفرض كل المفاتيح عبر Supabase/RLS/Edge Functions.') : L(locale, 'Critical permission keys are represented in roles.', 'مفاتيح الصلاحيات الحرجة ممثلة بالأدوار.')}</div></Card>}

    {tab === 'quality' && <Card title={L(locale, 'Data-quality governance', 'حوكمة جودة البيانات')} icon={<ClipboardCheck/>}><Table headers={[L(locale, 'Check', 'الفحص'), L(locale, 'Result', 'النتيجة'), L(locale, 'Recommended action', 'الإجراء المقترح')]} rows={[[L(locale, 'Duplicate item SKUs', 'تكرار أكواد الأصناف'), duplicateSkuCount > 0 ? <Pill tone="bad">{duplicateSkuCount}</Pill> : <Pill tone="good">0</Pill>, L(locale, 'Clean item master before backend migration.', 'نظّف ملف الأصناف قبل النقل للخلفية.')], [L(locale, 'Duplicate store codes', 'تكرار أكواد المخازن'), duplicateStoreCount > 0 ? <Pill tone="bad">{duplicateStoreCount}</Pill> : <Pill tone="good">0</Pill>, L(locale, 'Store codes should be unique.', 'أكواد المخازن يجب أن تكون فريدة.')], [L(locale, 'Suppliers missing VAT/bank info', 'موردون بدون ضريبة/بنك'), suppliersMissingBank.length > 0 ? <Pill tone="warn">{suppliersMissingBank.length}</Pill> : <Pill tone="good">0</Pill>, L(locale, 'Complete supplier compliance fields.', 'أكمل حقول امتثال المورد.')], [L(locale, 'Menu items without recipe', 'أصناف قائمة بدون وصفة'), localArray(state, 'menuItems').filter((m: any) => !localArray(state, 'recipeLines').some((r: any) => r.menuItemId === m.id)).length, L(locale, 'Needed before Full ERP Posting.', 'مطلوب قبل الترحيل الكامل.')]]}/></Card>}

    {tab === 'backend' && <Card title={L(locale, 'Supabase backend migration blueprint', 'مخطط النقل إلى Supabase')} icon={<Database/>}><Table headers={[L(locale, 'Stage', 'المرحلة'), L(locale, 'Scope', 'النطاق'), L(locale, 'Status', 'الحالة')]} rows={backendRows(locale).map((r) => [r.stage, r.scope, <Pill tone={r.status === 'Ready for design' ? 'info' : 'warn'}>{r.status}</Pill>])}/></Card>}

    {tab === 'qa' && <Card title={L(locale, 'QA regression test center', 'مركز اختبارات الجودة')} icon={<CheckCircle2/>}><Table headers={[L(locale, 'Test ID', 'رقم الاختبار'), L(locale, 'Area', 'المجال'), L(locale, 'Scenario', 'السيناريو'), L(locale, 'Expected result', 'النتيجة المتوقعة')]} rows={qaRows(locale).map((r) => [r.test_id, r.area, r.scenario, r.expected])}/></Card>}
  </div>;
}

function backendRows(locale: Locale) {
  return [
    { stage: '01', scope: L(locale, 'Supabase Auth and user profiles', 'مصادقة Supabase وملفات المستخدمين'), status: 'Ready for design' },
    { stage: '02', scope: L(locale, 'PostgreSQL master tables with uniqueness constraints', 'جداول رئيسية بقيود تفرد'), status: 'Ready for design' },
    { stage: '03', scope: L(locale, 'RLS by company/branch/store/cost center', 'RLS حسب الشركة/الفرع/المخزن/مركز التكلفة'), status: 'Backend phase' },
    { stage: '04', scope: L(locale, 'Server-side posting functions for finance/inventory', 'دوال ترحيل خلفية للمالية والمخزون'), status: 'Backend phase' },
    { stage: '05', scope: L(locale, 'Storage buckets for PO/GRN/invoice/payment attachments', 'حاويات مرفقات لأوامر الشراء والاستلام والفواتير والمدفوعات'), status: 'Backend phase' },
    { stage: '06', scope: L(locale, 'Audit triggers and immutable posted ledger', 'مشغلات تدقيق ودفتر أستاذ غير قابل للتلاعب'), status: 'Backend phase' },
    { stage: '07', scope: L(locale, 'Import staging tables for Foodics and Excel uploads', 'جداول وسيطة لاستيراد فودكس وإكسل'), status: 'Backend phase' },
    { stage: '08', scope: L(locale, 'Backup, restore, and deployment pipeline', 'نسخ احتياطي واستعادة وخط نشر'), status: 'Backend phase' },
  ];
}
function qaRows(locale: Locale) {
  return [
    { test_id: 'QA-001', area: 'Startup', scenario: L(locale, 'Double-click START_ERP_LOCAL.bat', 'تشغيل START_ERP_LOCAL.bat بالنقر المزدوج'), expected: L(locale, 'Installs dependencies once and starts Vite', 'يثبت الاعتمادات مرة ثم يشغل Vite') },
    { test_id: 'QA-002', area: 'Setup', scenario: L(locale, 'Import branches, stores, items, cost centers', 'استيراد الفروع والمخازن والأصناف ومراكز التكلفة'), expected: L(locale, 'Master data loads without duplicate codes', 'تحميل البيانات بدون تكرار أكواد') },
    { test_id: 'QA-003', area: 'Inventory', scenario: L(locale, 'Post opening stock with unknown SKU auto-create', 'ترحيل رصيد افتتاحي مع إنشاء صنف غير موجود'), expected: L(locale, 'Creates item and stock movement', 'ينشئ الصنف وحركة المخزون') },
    { test_id: 'QA-004', area: 'Inventory', scenario: L(locale, 'Generate monthly count sheet and upload counted qty', 'إنشاء نموذج الجرد الشهري ورفع الكميات المعدودة'), expected: L(locale, 'Calculates shortage/surplus and creates approval rows', 'يحسب العجز/الزيادة وينشئ صفوف اعتماد') },
    { test_id: 'QA-005', area: 'Foodics', scenario: L(locale, 'Upload products, ingredients, modifiers', 'رفع المنتجات والمكونات والإضافات'), expected: L(locale, 'Menu and recipe mapping created by SKU', 'إنشاء ربط القائمة والوصفات حسب SKU') },
    { test_id: 'QA-006', area: 'Foodics', scenario: L(locale, 'Upload orders, lines, payments and resolve issues', 'رفع الطلبات والبنود والمدفوعات ومعالجة المشاكل'), expected: L(locale, 'Validation cockpit shows only expected warnings', 'شاشة التحقق تعرض التحذيرات المتوقعة فقط') },
    { test_id: 'QA-007', area: 'Sales', scenario: L(locale, 'Post Sales Accounting Only without recipes', 'ترحيل محاسبة المبيعات فقط بدون وصفات'), expected: L(locale, 'Sales/VAT/payment journals post without inventory COGS blockers', 'تترحل قيود المبيعات والضريبة والدفع بدون منع تكلفة المخزون') },
    { test_id: 'QA-008', area: 'Sales', scenario: L(locale, 'Full ERP Posting after stock and recipes are ready', 'الترحيل الكامل بعد جاهزية المخزون والوصفات'), expected: L(locale, 'Inventory, COGS, VAT, and sales journals reconcile', 'تتطابق المخزون والتكلفة والضريبة والمبيعات') },
    { test_id: 'QA-009', area: 'Finance', scenario: L(locale, 'Review GL, TB, P&L, balance sheet, AP aging', 'مراجعة الأستاذ والميزان والدخل والمركز المالي وتقادم الموردين'), expected: L(locale, 'Statements render without crash and export', 'القوائم تظهر دون تعطل وتصدّر') },
    { test_id: 'QA-010', area: 'Close', scenario: L(locale, 'Open Enterprise HQ v55 and export control pack', 'فتح مركز المؤسسة v55 وتصدير حزمة الرقابة'), expected: L(locale, 'All ten tabs render and exports work', 'كل التبويبات العشرة تظهر والتصدير يعمل') },
  ];
}
