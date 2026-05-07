import { useMemo, useState, type ReactNode } from 'react';
import {
  AlertTriangle,
  Archive,
  Banknote,
  BarChart3,
  CalendarCheck,
  CheckCircle2,
  ClipboardCheck,
  Download,
  FileSpreadsheet,
  Landmark,
  ListChecks,
  LockKeyhole,
  PieChart,
  RefreshCw,
  ShieldCheck,
  ShoppingCart,
  TrendingUp,
  Unlock,
  Wallet,
} from 'lucide-react';

type Locale = 'en' | 'ar';
type Props = { state: any; totals: any; update: (fn: (s: any) => any, success?: string) => void; locale: Locale; notify?: (type: 'success' | 'warning' | 'error', message: string) => void };
type CloseTab = 'close' | 'foodcost' | 'purchase' | 'finance' | 'roadmap';
type Tone = 'good' | 'warn' | 'bad' | 'info';

function L(locale: Locale, en: string, ar: string) { return locale === 'ar' ? ar : en; }
function today() { return new Date().toISOString().slice(0, 10); }
function id(prefix: string) { const random = typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID().slice(0, 8) : Math.random().toString(36).slice(2, 10); return `${prefix}-${random}`; }
function money(value: number, locale: Locale) { return new Intl.NumberFormat(locale === 'ar' ? 'ar-SA' : 'en-US', { style: 'currency', currency: 'SAR', maximumFractionDigits: 2 }).format(Number(value || 0)); }
function qty(value: number, unit = '') { return `${Number(value || 0).toLocaleString(undefined, { maximumFractionDigits: 3 })}${unit ? ` ${unit}` : ''}`; }
function csv(rows: Array<Record<string, any>>) { if (!rows.length) return ''; const headers = Object.keys(rows[0]); const esc = (v: any) => { const s = String(v ?? ''); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; }; return [headers.join(','), ...rows.map((r) => headers.map((h) => esc(r[h])).join(','))].join('\n'); }
function saveFile(fileName: string, content: string, mime = 'text/csv;charset=utf-8') { const blob = new Blob([content], { type: mime }); const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = fileName; a.click(); URL.revokeObjectURL(url); }
function daysBetween(date: string, end = today()) { const a = new Date(`${date || end}T00:00:00`).getTime(); const b = new Date(`${end}T00:00:00`).getTime(); return Math.max(0, Math.floor((b - a) / 86400000)); }
function addDays(date: string, days: number) { const d = new Date(`${date || today()}T00:00:00`); d.setDate(d.getDate() + days); return d.toISOString().slice(0, 10); }
function get(obj: any, path: string, fallback = '') { return path.split('.').reduce((acc, key) => (acc && acc[key] != null ? acc[key] : undefined), obj) ?? fallback; }
function periodOfCurrentMonth() { const d = new Date(); const start = new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10); const end = new Date(d.getFullYear(), d.getMonth() + 1, 0).toISOString().slice(0, 10); return { start, end, code: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}` }; }

function Card({ title, icon, action, children }: { title: string; icon?: ReactNode; action?: ReactNode; children: ReactNode }) {
  return <section className="card"><div className="card-header"><div className="card-title">{icon}{title}</div>{action}</div>{children}</section>;
}
function KPI({ label, value, hint, icon }: { label: string; value: string; hint: string; icon: ReactNode }) {
  return <div className="kpi"><div className="kpi-icon">{icon}</div><div><span>{label}</span><strong>{value}</strong><small>{hint}</small></div></div>;
}
function Table({ headers, rows }: { headers: ReactNode[]; rows: ReactNode[][] }) {
  return <div className="table-wrap"><table><thead><tr>{headers.map((h, i) => <th key={i}>{h}</th>)}</tr></thead><tbody>{rows.length ? rows.map((r, i) => <tr key={i}>{r.map((c, ci) => <td key={ci}>{c}</td>)}</tr>) : <tr><td colSpan={headers.length}>—</td></tr>}</tbody></table></div>;
}
function TabButton({ active, value, onClick, children }: { active: string; value: string; onClick: (v: any) => void; children: ReactNode }) { return <button className={active === value ? 'active-tab' : ''} onClick={() => onClick(value)}>{children}</button>; }
function Pill({ tone, children }: { tone: Tone; children: ReactNode }) { return <span className={`pill ${tone}`}>{children}</span>; }

function itemName(state: any, itemId: string, locale: Locale) { const item = (state.items ?? []).find((x: any) => x.id === itemId || x.sku === itemId); return item ? (locale === 'ar' ? item.nameAr || item.nameEn : item.nameEn || item.nameAr) : itemId; }
function itemSku(state: any, itemId: string) { return (state.items ?? []).find((x: any) => x.id === itemId)?.sku || itemId; }
function storeName(state: any, storeId: string, locale: Locale) { const store = (state.stores ?? []).find((x: any) => x.id === storeId || x.code === storeId); return store ? `${store.code} — ${locale === 'ar' ? store.nameAr || store.nameEn : store.nameEn || store.nameAr}` : storeId || '—'; }
function branchName(state: any, branchId: string, locale: Locale) { const branch = (state.branches ?? []).find((x: any) => x.id === branchId || x.code === branchId); return branch ? `${branch.code} — ${locale === 'ar' ? branch.nameAr || branch.nameEn : branch.nameEn || branch.nameAr}` : branchId || '—'; }
function supplierName(state: any, supplierId: string) { return (state.suppliers ?? []).find((x: any) => x.id === supplierId)?.name || supplierId || '—'; }
function accountName(state: any, code: string, locale: Locale) { const account = (state.chartAccounts ?? []).find((x: any) => x.code === code); return account ? `${code} — ${locale === 'ar' ? account.nameAr || account.nameEn : account.nameEn || account.nameAr}` : code; }

function stockBalance(state: any, storeId: string, itemId: string, toDate?: string) {
  return (state.stockMovements ?? [])
    .filter((m: any) => (!storeId || m.storeId === storeId) && (!itemId || m.itemId === itemId) && (!toDate || String(m.date || '').slice(0, 10) <= toDate))
    .reduce((sum: number, m: any) => sum + (m.direction === 'in' ? 1 : -1) * Number(m.qty || 0), 0);
}
function avgCost(state: any, itemId: string) {
  const ins = (state.stockMovements ?? []).filter((m: any) => m.itemId === itemId && m.direction === 'in' && Number(m.unitCost || 0) > 0);
  const qtyTotal = ins.reduce((s: number, m: any) => s + Number(m.qty || 0), 0);
  const valTotal = ins.reduce((s: number, m: any) => s + Number(m.qty || 0) * Number(m.unitCost || 0), 0);
  const item = (state.items ?? []).find((x: any) => x.id === itemId);
  return qtyTotal ? valTotal / qtyTotal : Number(item?.standardCost || 0);
}
function journalAmountByAccount(state: any, code: string) {
  return (state.journals ?? []).filter((j: any) => j.status === 'posted').flatMap((j: any) => j.lines ?? [])
    .filter((l: any) => l.accountCode === code).reduce((s: number, l: any) => s + Number(l.debit || 0) - Number(l.credit || 0), 0);
}
function purchaseInvoiceTotal(inv: any) { return (inv.lines ?? []).reduce((s: number, l: any) => s + (Number(l.qty || 0) * Number(l.unitCost || 0) - Number(l.discount || 0)) * (1 + Number(l.vatRate || 0) / 100), 0); }
function purchaseInvoiceNet(inv: any) { return (inv.lines ?? []).reduce((s: number, l: any) => s + Number(l.qty || 0) * Number(l.unitCost || 0) - Number(l.discount || 0), 0); }
function paymentTermsDays(text: string) { const match = String(text || '').match(/\d+/); return match ? Number(match[0]) : 30; }

export default function EnterpriseControlPage({ state, totals, update, locale, notify }: Props) {
  const [tab, setTab] = useState<CloseTab>('close');
  const month = periodOfCurrentMonth();
  const fiscalPeriods = state.fiscalPeriods ?? [];
  const defaultPeriodId = fiscalPeriods.find((p: any) => p.startDate <= month.start && p.endDate >= month.end)?.id || fiscalPeriods[0]?.id || '';
  const [periodId, setPeriodId] = useState(defaultPeriodId);
  const selectedPeriod = fiscalPeriods.find((p: any) => p.id === periodId) || { id: '', code: month.code, nameEn: month.code, nameAr: month.code, startDate: month.start, endDate: month.end, status: 'open' };
  const [selectedStoreId, setSelectedStoreId] = useState('all');

  const stores = selectedStoreId === 'all' ? (state.stores ?? []) : (state.stores ?? []).filter((s: any) => s.id === selectedStoreId);
  const periodStart = selectedPeriod.startDate || month.start;
  const periodEnd = selectedPeriod.endDate || month.end;

  const periodMovements = useMemo(() => (state.stockMovements ?? []).filter((m: any) => String(m.date || '').slice(0, 10) >= periodStart && String(m.date || '').slice(0, 10) <= periodEnd), [state.stockMovements, periodStart, periodEnd]);
  const periodJournals = useMemo(() => (state.journals ?? []).filter((j: any) => j.status === 'posted' && String(j.date || '').slice(0, 10) >= periodStart && String(j.date || '').slice(0, 10) <= periodEnd), [state.journals, periodStart, periodEnd]);
  const periodSales = useMemo(() => (state.sales ?? []).filter((s: any) => String(s.date || '').slice(0, 10) >= periodStart && String(s.date || '').slice(0, 10) <= periodEnd), [state.sales, periodStart, periodEnd]);
  const periodApprovals = useMemo(() => (state.inventoryApprovals ?? []).filter((a: any) => String(a.date || '').slice(0, 10) >= periodStart && String(a.date || '').slice(0, 10) <= periodEnd), [state.inventoryApprovals, periodStart, periodEnd]);

  const closeChecks = useMemo(() => {
    const openingPosted = (state.stockMovements ?? []).some((m: any) => String(m.type || '').includes('opening'));
    const purchasesPosted = (state.goodsReceipts ?? []).some((g: any) => g.status === 'posted') || (state.purchaseInvoices ?? []).some((p: any) => p.status === 'posted');
    const salesPosted = (state.sales ?? []).some((s: any) => s.posted) || (state.journals ?? []).some((j: any) => String(j.source || '').includes('foodics'));
    const stockCountUploaded = periodApprovals.some((a: any) => a.requestType === 'count_variance') || periodMovements.some((m: any) => String(m.type || '').includes('count'));
    const variancesApproved = !periodApprovals.some((a: any) => a.requestType === 'count_variance' && !['posted', 'approved'].includes(a.status));
    const stockValue = (state.stockMovements ?? []).reduce((sum: number, m: any) => sum + (m.direction === 'in' ? 1 : -1) * Number(m.qty || 0) * Number(m.unitCost || 0), 0);
    const glInventory = Math.max(0, journalAmountByAccount(state, '1300'));
    const reconDiff = Math.round((stockValue - glInventory) * 100) / 100;
    const negativeStockRows = (state.stores ?? []).flatMap((store: any) => (state.items ?? []).map((item: any) => ({ store, item, bal: stockBalance(state, store.id, item.id, periodEnd) }))).filter((r: any) => r.bal < 0);
    return [
      { key: 'opening', label: L(locale, 'Opening stock / migration balance exists', 'يوجد رصيد افتتاحي / ترحيل أولي'), ok: openingPosted, risk: L(locale, 'Opening quantity and cost are needed before monthly control.', 'الرصيد الافتتاحي بالكمية والتكلفة مطلوب قبل الرقابة الشهرية.') },
      { key: 'purchases', label: L(locale, 'Purchases / GRN posted for period', 'تم ترحيل المشتريات / الاستلام للفترة'), ok: purchasesPosted, risk: L(locale, 'Purchase costs are needed for average cost and COGS.', 'تكاليف الشراء مطلوبة لمتوسط التكلفة وتكلفة المبيعات.') },
      { key: 'sales', label: L(locale, 'Foodics sales / sales batches posted', 'تم ترحيل مبيعات فودكس / دفعات المبيعات'), ok: salesPosted, risk: L(locale, 'Sales must be posted before theoretical consumption is final.', 'يجب ترحيل المبيعات قبل اعتماد الاستهلاك النظري.') },
      { key: 'stock_count', label: L(locale, 'Monthly stock count uploaded', 'تم رفع الجرد الشهري'), ok: stockCountUploaded, risk: L(locale, 'Physical count is needed for shortage/surplus control.', 'الجرد الفعلي مطلوب لرقابة العجز والزيادة.') },
      { key: 'variance', label: L(locale, 'Count variances approved/posted', 'تم اعتماد/ترحيل فروقات الجرد'), ok: variancesApproved, risk: L(locale, 'Unapproved variances block inventory close.', 'فروقات غير معتمدة تمنع إغلاق المخزون.') },
      { key: 'recon', label: L(locale, 'Inventory subledger reconciles to GL', 'مطابقة مخزون النظام مع الأستاذ العام'), ok: Math.abs(reconDiff) < 1, risk: `${L(locale, 'Difference', 'الفرق')}: ${money(reconDiff, locale)}` },
      { key: 'negative', label: L(locale, 'No negative stock as of period end', 'لا يوجد مخزون سالب بنهاية الفترة'), ok: !negativeStockRows.length, risk: negativeStockRows.length ? `${negativeStockRows.length} ${L(locale, 'negative rows', 'صفوف سالبة')}` : L(locale, 'Ready', 'جاهز') },
    ];
  }, [state, periodApprovals, periodMovements, periodEnd, locale]);

  const closeReady = closeChecks.every((c) => c.ok);
  const closeScore = Math.round((closeChecks.filter((c) => c.ok).length / Math.max(1, closeChecks.length)) * 100);

  const theoreticalRows = useMemo(() => {
    const rows = new Map<string, any>();
    periodSales.filter((s: any) => !selectedStoreId || selectedStoreId === 'all' || s.storeId === selectedStoreId).forEach((sale: any) => {
      (state.recipeLines ?? []).filter((r: any) => r.menuItemId === sale.menuItemId).forEach((r: any) => {
        const required = Number(sale.qty || 0) * Number(r.qty || 0) * (1 + Number(r.wastagePct || 0) / 100);
        const key = `${sale.storeId}|${r.itemId}`;
        const current = rows.get(key) || { storeId: sale.storeId, itemId: r.itemId, theoreticalQty: 0, theoreticalValue: 0, actualIssueQty: 0, varianceQty: 0, varianceValue: 0 };
        const cost = avgCost(state, r.itemId);
        current.theoreticalQty += required;
        current.theoreticalValue += required * cost;
        rows.set(key, current);
      });
    });
    periodMovements.filter((m: any) => String(m.type || '').includes('foodics_sales_consumption') || String(m.type || '').includes('sale')).forEach((m: any) => {
      const key = `${m.storeId}|${m.itemId}`;
      const current = rows.get(key) || { storeId: m.storeId, itemId: m.itemId, theoreticalQty: 0, theoreticalValue: 0, actualIssueQty: 0, varianceQty: 0, varianceValue: 0 };
      current.actualIssueQty += Number(m.qty || 0);
      rows.set(key, current);
    });
    periodApprovals.filter((a: any) => a.requestType === 'count_variance').forEach((a: any) => {
      const key = `${a.storeId}|${a.itemId}`;
      const current = rows.get(key) || { storeId: a.storeId, itemId: a.itemId, theoreticalQty: 0, theoreticalValue: 0, actualIssueQty: 0, varianceQty: 0, varianceValue: 0 };
      const signed = a.direction === 'out' ? -Number(a.qty || 0) : Number(a.qty || 0);
      current.varianceQty += signed;
      current.varianceValue += signed * Number(a.unitCost || avgCost(state, a.itemId));
      rows.set(key, current);
    });
    return Array.from(rows.values()).map((r: any) => ({ ...r, theoreticalUnitCost: r.theoreticalQty ? r.theoreticalValue / r.theoreticalQty : avgCost(state, r.itemId), actualVsTheoreticalQty: r.actualIssueQty - r.theoreticalQty }));
  }, [periodSales, periodMovements, periodApprovals, state, selectedStoreId]);

  const purchaseVarianceRows = useMemo(() => {
    const rows: any[] = [];
    (state.purchaseOrders ?? []).forEach((po: any) => {
      (po.lines ?? []).forEach((line: any) => {
        const grnQty = (state.goodsReceipts ?? []).filter((g: any) => g.poId === po.id && g.status === 'posted').flatMap((g: any) => g.lines ?? []).filter((gl: any) => gl.itemId === line.itemId).reduce((s: number, gl: any) => s + Number(gl.qty || 0), 0);
        const invoiceLines = (state.purchaseInvoices ?? []).filter((inv: any) => inv.supplierId === po.supplierId && inv.status === 'posted').flatMap((inv: any) => inv.lines ?? []).filter((il: any) => il.itemId === line.itemId);
        const invoiceQty = invoiceLines.reduce((s: number, il: any) => s + Number(il.qty || 0), 0);
        const invoiceAvg = invoiceQty ? invoiceLines.reduce((s: number, il: any) => s + Number(il.qty || 0) * Number(il.unitCost || 0), 0) / invoiceQty : 0;
        rows.push({ poRef: po.ref, supplierId: po.supplierId, itemId: line.itemId, orderedQty: Number(line.qty || 0), receivedQty: grnQty || Number(line.receivedQty || 0), invoicedQty: invoiceQty || Number(line.invoicedQty || 0), poUnitCost: Number(line.unitCost || 0), invoiceUnitCost: invoiceAvg, qtyVariance: (invoiceQty || Number(line.invoicedQty || 0)) - (grnQty || Number(line.receivedQty || 0)), priceVariance: invoiceAvg ? invoiceAvg - Number(line.unitCost || 0) : 0 });
      });
    });
    return rows;
  }, [state.purchaseOrders, state.goodsReceipts, state.purchaseInvoices]);

  const apAgingRows = useMemo(() => {
    return (state.purchaseInvoices ?? []).filter((inv: any) => inv.status === 'posted').map((inv: any) => {
      const supplier = (state.suppliers ?? []).find((s: any) => s.id === inv.supplierId);
      const dueDate = addDays(inv.invoiceDate, paymentTermsDays(supplier?.paymentTerms));
      const total = purchaseInvoiceTotal(inv);
      const paid = (state.supplierPayments ?? []).filter((p: any) => p.status === 'posted' && (p.invoiceRef === inv.ref || (!p.invoiceRef && p.supplierId === inv.supplierId))).reduce((s: number, p: any) => s + Number(p.amount || 0), 0);
      const open = Math.max(0, total - paid);
      const age = open ? daysBetween(dueDate) : 0;
      return { ref: inv.ref, supplierId: inv.supplierId, invoiceDate: inv.invoiceDate, dueDate, total, paid, open, bucket: !open ? 'Paid' : age <= 0 ? 'Current' : age <= 30 ? '1-30' : age <= 60 ? '31-60' : age <= 90 ? '61-90' : '90+' };
    }).filter((r: any) => r.open > 0);
  }, [state.purchaseInvoices, state.supplierPayments, state.suppliers]);

  const arAgingRows = useMemo(() => {
    return (state.arInvoices ?? []).map((inv: any) => { const open = Math.max(0, Number(inv.amount || 0) * (1 + Number(inv.vatRate || 0) / 100) - Number(inv.paidAmount || 0)); const age = open ? daysBetween(inv.date) : 0; return { ...inv, open, bucket: !open ? 'Paid' : age <= 30 ? '1-30' : age <= 60 ? '31-60' : age <= 90 ? '61-90' : '90+' }; }).filter((r: any) => r.open > 0);
  }, [state.arInvoices]);

  const closePeriod = () => {
    if (!selectedPeriod.id) return;
    if (!closeReady) { notify?.('warning', L(locale, 'Close checklist is not fully ready. Review blockers before closing.', 'قائمة الإغلاق غير مكتملة. راجع الموانع قبل الإغلاق.')); return; }
    update((s: any) => ({ ...s, fiscalPeriods: (s.fiscalPeriods ?? []).map((p: any) => p.id === selectedPeriod.id ? { ...p, status: 'closed', lockedBy: 'Local Admin', lockedAt: new Date().toISOString() } : p), audits: [{ id: id('AUD'), at: new Date().toISOString(), action: 'close', entity: 'monthly_close', ref: selectedPeriod.code, user: 'Local Admin', note: 'Enterprise monthly close completed from v45 control center' }, ...(s.audits ?? [])] }), L(locale, 'Monthly period closed', 'تم إغلاق الفترة الشهرية'));
  };
  const reopenPeriod = () => {
    if (!selectedPeriod.id) return;
    update((s: any) => ({ ...s, fiscalPeriods: (s.fiscalPeriods ?? []).map((p: any) => p.id === selectedPeriod.id ? { ...p, status: 'open', lockedBy: undefined, lockedAt: undefined } : p), audits: [{ id: id('AUD'), at: new Date().toISOString(), action: 'reopen', entity: 'monthly_close', ref: selectedPeriod.code, user: 'Local Admin', note: 'Enterprise monthly close reopened in local trial mode' }, ...(s.audits ?? [])] }), L(locale, 'Monthly period reopened', 'تم إعادة فتح الفترة'));
  };

  const exportClose = () => saveFile('v45_monthly_close_checklist.csv', csv(closeChecks.map((c) => ({ period: selectedPeriod.code, area: c.key, check: c.label, status: c.ok ? 'Ready' : 'Missing/Review', risk: c.risk }))));
  const exportFoodCost = () => saveFile('v45_theoretical_vs_actual_food_cost.csv', csv(theoreticalRows.map((r) => ({ period: selectedPeriod.code, store: storeName(state, r.storeId, locale), sku: itemSku(state, r.itemId), item: itemName(state, r.itemId, locale), theoretical_qty: r.theoreticalQty, actual_issue_qty: r.actualIssueQty, stock_count_variance_qty: r.varianceQty, theoretical_value: r.theoreticalValue, variance_value: r.varianceValue }))));
  const exportPurchaseVariance = () => saveFile('v45_purchase_variance.csv', csv(purchaseVarianceRows.map((r) => ({ po_ref: r.poRef, supplier: supplierName(state, r.supplierId), sku: itemSku(state, r.itemId), item: itemName(state, r.itemId, locale), ordered_qty: r.orderedQty, received_qty: r.receivedQty, invoiced_qty: r.invoicedQty, po_unit_cost: r.poUnitCost, invoice_unit_cost: r.invoiceUnitCost, qty_variance: r.qtyVariance, price_variance: r.priceVariance }))));
  const exportFinanceClose = () => saveFile('v45_finance_close_pack.csv', csv([
    ...apAgingRows.map((r: any) => ({ section: 'AP Aging', ref: r.ref, name: supplierName(state, r.supplierId), date: r.invoiceDate, due_date: r.dueDate, amount: r.open, bucket: r.bucket })),
    ...arAgingRows.map((r: any) => ({ section: 'AR Aging', ref: r.ref, name: r.customer, date: r.date, due_date: '', amount: r.open, bucket: r.bucket })),
    ...(state.bankReconLines ?? []).map((r: any) => ({ section: 'Bank Reconciliation', ref: r.id, name: r.description, date: r.date, due_date: '', amount: r.statementAmount, bucket: r.status })),
  ]));

  const zeroCostDemand = theoreticalRows.filter((r: any) => r.theoreticalQty > 0 && r.theoreticalUnitCost <= 0).length;
  const purchaseVarianceRisk = purchaseVarianceRows.filter((r) => Math.abs(r.qtyVariance) > 0.001 || Math.abs(r.priceVariance) > 0.001).length;
  const unmatchedBank = (state.bankReconLines ?? []).filter((r: any) => r.status !== 'matched').length;

  return <div className="page-grid">
    <Card title={L(locale, 'Enterprise v45 control suite — monthly close, food cost, purchasing, finance', 'حزمة رقابة v45 المؤسسية — الإغلاق الشهري، تكلفة الطعام، المشتريات، المالية')} icon={<ShieldCheck/>} action={<div className="button-row"><select value={periodId} onChange={(e) => setPeriodId(e.target.value)}><option value="">{selectedPeriod.code}</option>{fiscalPeriods.map((p: any) => <option key={p.id} value={p.id}>{p.code} — {locale === 'ar' ? p.nameAr || p.nameEn : p.nameEn || p.nameAr} — {p.status}</option>)}</select><select value={selectedStoreId} onChange={(e) => setSelectedStoreId(e.target.value)}><option value="all">{L(locale, 'All stores', 'كل المخازن')}</option>{(state.stores ?? []).map((s: any) => <option key={s.id} value={s.id}>{s.code} — {locale === 'ar' ? s.nameAr || s.nameEn : s.nameEn || s.nameAr}</option>)}</select></div>}>
      <div className="tab-row">
        <TabButton active={tab} value="close" onClick={setTab}>{L(locale, 'Monthly Close', 'الإغلاق الشهري')}</TabButton>
        <TabButton active={tab} value="foodcost" onClick={setTab}>{L(locale, 'Theoretical vs Actual', 'النظري مقابل الفعلي')}</TabButton>
        <TabButton active={tab} value="purchase" onClick={setTab}>{L(locale, 'Purchase Variance', 'انحرافات الشراء')}</TabButton>
        <TabButton active={tab} value="finance" onClick={setTab}>{L(locale, 'Finance Close', 'إغلاق المالية')}</TabButton>
        <TabButton active={tab} value="roadmap" onClick={setTab}>{L(locale, 'Enterprise Gaps', 'الفجوات المؤسسية')}</TabButton>
      </div>
      <div className="notice">{L(locale, 'This combined v45 page covers v42, v43, v44, and v45 in one control workspace. It is local-first and designed for trial control before Supabase backend migration.', 'هذه الصفحة v45 تجمع v42 و v43 و v44 و v45 في مساحة رقابية واحدة. تعمل محلياً للتجربة قبل نقلها إلى Supabase.')}</div>
    </Card>

    {tab === 'close' && <div className="page-grid">
      <div className="kpi-grid"><KPI label={L(locale, 'Close score', 'درجة الإغلاق')} value={`${closeScore}%`} hint={closeReady ? L(locale, 'Ready to close', 'جاهز للإغلاق') : L(locale, 'Review blockers', 'راجع الموانع')} icon={<CalendarCheck/>}/><KPI label={L(locale, 'Period status', 'حالة الفترة')} value={selectedPeriod.status || 'open'} hint={`${periodStart} → ${periodEnd}`} icon={<LockKeyhole/>}/><KPI label={L(locale, 'Theoretical demand rows', 'صفوف الاستهلاك النظري')} value={`${theoreticalRows.length}`} hint={L(locale, 'From sales and recipes', 'من المبيعات والوصفات')} icon={<Archive/>}/><KPI label={L(locale, 'Open AP aging', 'ذمم دائنة مفتوحة')} value={money(apAgingRows.reduce((s: number, r: any) => s + r.open, 0), locale)} hint={`${apAgingRows.length} ${L(locale, 'open invoices', 'فواتير مفتوحة')}`} icon={<Wallet/>}/></div>
      <Card title={L(locale, 'Monthly inventory and Foodics close checklist', 'قائمة إغلاق المخزون وفودكس الشهرية')} icon={<ListChecks/>} action={<div className="button-row"><button onClick={exportClose}><Download size={16}/>{L(locale, 'Export checklist', 'تصدير القائمة')}</button><button disabled={!closeReady || selectedPeriod.status === 'closed'} onClick={closePeriod}><LockKeyhole size={16}/>{L(locale, 'Close period', 'إغلاق الفترة')}</button><button disabled={selectedPeriod.status !== 'closed'} onClick={reopenPeriod}><Unlock size={16}/>{L(locale, 'Reopen local trial', 'إعادة فتح التجربة')}</button></div>}>
        <Table headers={[L(locale, 'Control', 'الرقابة'), L(locale, 'Status', 'الحالة'), L(locale, 'Risk / Required action', 'الخطر / الإجراء المطلوب')]} rows={closeChecks.map((c) => [c.label, <Pill tone={c.ok ? 'good' : 'bad'}>{c.ok ? L(locale, 'Ready', 'جاهز') : L(locale, 'Review', 'مراجعة')}</Pill>, c.risk])}/>
      </Card>
    </div>}

    {tab === 'foodcost' && <div className="page-grid">
      <div className="kpi-grid"><KPI label={L(locale, 'Theoretical value', 'القيمة النظرية')} value={money(theoreticalRows.reduce((s: number, r: any) => s + r.theoreticalValue, 0), locale)} hint={L(locale, 'Recipe demand × avg cost', 'احتياج الوصفة × متوسط التكلفة')} icon={<PieChart/>}/><KPI label={L(locale, 'Count variance value', 'قيمة فرق الجرد')} value={money(theoreticalRows.reduce((s: number, r: any) => s + r.varianceValue, 0), locale)} hint={L(locale, 'Surplus positive / shortage negative', 'الزيادة موجبة / العجز سالب')} icon={<TrendingUp/>}/><KPI label={L(locale, 'Zero-cost demand rows', 'صفوف طلب بتكلفة صفرية')} value={`${zeroCostDemand}`} hint={L(locale, 'Post purchase costs before final COGS', 'رحّل تكاليف الشراء قبل تكلفة المبيعات النهائية')} icon={<AlertTriangle/>}/><KPI label={L(locale, 'Stores analyzed', 'المخازن المحللة')} value={`${stores.length}`} hint={selectedStoreId === 'all' ? L(locale, 'All stores', 'كل المخازن') : storeName(state, selectedStoreId, locale)} icon={<Archive/>}/></div>
      <Card title={L(locale, 'Theoretical vs actual food cost and stock count variance', 'تكلفة الطعام النظرية مقابل الفعلية وفروقات الجرد')} icon={<BarChart3/>} action={<button onClick={exportFoodCost}><Download size={16}/>{L(locale, 'Export food cost control', 'تصدير رقابة تكلفة الطعام')}</button>}>
        <Table headers={[L(locale, 'Store', 'المخزن'), 'SKU', L(locale, 'Ingredient', 'المكون'), L(locale, 'Theoretical Qty', 'الكمية النظرية'), L(locale, 'Actual Issue Qty', 'الكمية المصروفة فعلياً'), L(locale, 'Count Variance', 'فرق الجرد'), L(locale, 'Theoretical Value', 'القيمة النظرية'), L(locale, 'Risk', 'الخطر')]} rows={theoreticalRows.map((r) => [storeName(state, r.storeId, locale), itemSku(state, r.itemId), itemName(state, r.itemId, locale), qty(r.theoreticalQty), qty(r.actualIssueQty), qty(r.varianceQty), money(r.theoreticalValue, locale), r.theoreticalUnitCost <= 0 ? <Pill tone="bad">{L(locale, 'Zero cost', 'تكلفة صفرية')}</Pill> : Math.abs(r.varianceQty) > 0 ? <Pill tone="warn">{L(locale, 'Variance', 'فرق')}</Pill> : <Pill tone="good">{L(locale, 'OK', 'سليم')}</Pill>])}/>
      </Card>
    </div>}

    {tab === 'purchase' && <div className="page-grid">
      <div className="kpi-grid"><KPI label={L(locale, 'Purchase variance rows', 'صفوف انحرافات الشراء')} value={`${purchaseVarianceRisk}`} hint={L(locale, 'Price or quantity exceptions', 'استثناءات سعر أو كمية')} icon={<ShoppingCart/>}/><KPI label={L(locale, 'GRNI balance', 'رصيد بضائع مستلمة غير مفوترة')} value={money(Math.abs(journalAmountByAccount(state, '2110')), locale)} hint={L(locale, 'Needs invoice matching', 'يحتاج مطابقة الفاتورة')} icon={<ClipboardCheck/>}/><KPI label={L(locale, 'AP open', 'ذمم الموردين المفتوحة')} value={money(apAgingRows.reduce((s: number, r: any) => s + r.open, 0), locale)} hint={`${apAgingRows.length} ${L(locale, 'invoice rows', 'صفوف فواتير')}`} icon={<Wallet/>}/><KPI label={L(locale, 'Supplier count', 'عدد الموردين')} value={`${(state.suppliers ?? []).length}`} hint={L(locale, 'Supplier master', 'بيانات الموردين')} icon={<ShoppingCart/>}/></div>
      <Card title={L(locale, 'Purchase quantity/price variance control', 'رقابة انحراف كمية/سعر الشراء')} icon={<ShoppingCart/>} action={<button onClick={exportPurchaseVariance}><Download size={16}/>{L(locale, 'Export purchase variance', 'تصدير انحرافات الشراء')}</button>}>
        <Table headers={['PO', L(locale, 'Supplier', 'المورد'), 'SKU', L(locale, 'Item', 'الصنف'), L(locale, 'Ordered', 'المطلوب'), L(locale, 'Received', 'المستلم'), L(locale, 'Invoiced', 'المفوتر'), L(locale, 'PO Cost', 'سعر أمر الشراء'), L(locale, 'Invoice Cost', 'سعر الفاتورة'), L(locale, 'Risk', 'الخطر')]} rows={purchaseVarianceRows.map((r) => [r.poRef, supplierName(state, r.supplierId), itemSku(state, r.itemId), itemName(state, r.itemId, locale), qty(r.orderedQty), qty(r.receivedQty), qty(r.invoicedQty), money(r.poUnitCost, locale), money(r.invoiceUnitCost, locale), Math.abs(r.qtyVariance) > 0.001 || Math.abs(r.priceVariance) > 0.001 ? <Pill tone="warn">{L(locale, 'Variance', 'انحراف')}</Pill> : <Pill tone="good">{L(locale, 'Matched', 'مطابق')}</Pill>])}/>
      </Card>
    </div>}

    {tab === 'finance' && <div className="page-grid">
      <div className="kpi-grid"><KPI label={L(locale, 'AP aging', 'تقادم الذمم الدائنة')} value={money(apAgingRows.reduce((s: number, r: any) => s + r.open, 0), locale)} hint={`${apAgingRows.length} ${L(locale, 'open invoices', 'فواتير مفتوحة')}`} icon={<Wallet/>}/><KPI label={L(locale, 'AR aging', 'تقادم الذمم المدينة')} value={money(arAgingRows.reduce((s: number, r: any) => s + r.open, 0), locale)} hint={`${arAgingRows.length} ${L(locale, 'open invoices', 'فواتير مفتوحة')}`} icon={<Banknote/>}/><KPI label={L(locale, 'Unmatched bank lines', 'حركات بنكية غير مطابقة')} value={`${unmatchedBank}`} hint={L(locale, 'Reconciliation control', 'رقابة المطابقة')} icon={<Landmark/>}/><KPI label={L(locale, 'Posted journals', 'قيود مرحلة')} value={`${periodJournals.length}`} hint={L(locale, 'Selected period', 'الفترة المحددة')} icon={<FileSpreadsheet/>}/></div>
      <Card title={L(locale, 'Finance close pack: AP, AR, bank, VAT, GL', 'حزمة إغلاق المالية: الموردون والعملاء والبنوك والضريبة والأستاذ')} icon={<Landmark/>} action={<button onClick={exportFinanceClose}><Download size={16}/>{L(locale, 'Export finance close pack', 'تصدير حزمة الإغلاق المالي')}</button>}>
        <div className="two-col"><div><h3>{L(locale, 'AP Aging', 'تقادم الموردين')}</h3><Table headers={['Ref', L(locale, 'Supplier', 'المورد'), L(locale, 'Due', 'الاستحقاق'), L(locale, 'Open', 'المفتوح'), L(locale, 'Bucket', 'الفئة')]} rows={apAgingRows.map((r: any) => [r.ref, supplierName(state, r.supplierId), r.dueDate, money(r.open, locale), r.bucket])}/></div><div><h3>{L(locale, 'AR Aging', 'تقادم العملاء')}</h3><Table headers={['Ref', L(locale, 'Customer', 'العميل'), L(locale, 'Date', 'التاريخ'), L(locale, 'Open', 'المفتوح'), L(locale, 'Bucket', 'الفئة')]} rows={arAgingRows.map((r: any) => [r.ref, r.customer, r.date, money(r.open, locale), r.bucket])}/></div></div>
        <h3>{L(locale, 'Bank reconciliation exceptions', 'استثناءات المطابقة البنكية')}</h3><Table headers={[L(locale, 'Date', 'التاريخ'), L(locale, 'Account', 'الحساب'), L(locale, 'Description', 'الوصف'), L(locale, 'Amount', 'المبلغ'), L(locale, 'Status', 'الحالة')]} rows={(state.bankReconLines ?? []).filter((r: any) => r.status !== 'matched').map((r: any) => [r.date, accountName(state, r.bankAccountCode, locale), r.description, money(r.statementAmount, locale), <Pill tone={r.status === 'unmatched' ? 'bad' : 'warn'}>{r.status}</Pill>])}/>
      </Card>
    </div>}

    {tab === 'roadmap' && <div className="page-grid two">
      <Card title={L(locale, 'What v42–v45 now covers', 'ما يغطيه v42–v45 الآن')} icon={<CheckCircle2/>}><Table headers={[L(locale, 'Release', 'الإصدار'), L(locale, 'Control', 'الرقابة'), L(locale, 'Status', 'الحالة')]} rows={[["v42", L(locale, 'Monthly inventory/Foodics close checklist and period close action', 'قائمة إغلاق المخزون وفودكس وإجراء إغلاق الفترة'), <Pill tone="good">{L(locale, 'Added', 'تمت الإضافة')}</Pill>], ["v43", L(locale, 'Theoretical vs actual food cost from recipes, sales, and count variances', 'تكلفة الطعام النظرية مقابل الفعلية من الوصفات والمبيعات وفروقات الجرد'), <Pill tone="good">{L(locale, 'Added', 'تمت الإضافة')}</Pill>], ["v44", L(locale, 'Purchase price/quantity variance and GRNI control', 'رقابة انحراف السعر/الكمية و GRNI'), <Pill tone="good">{L(locale, 'Added', 'تمت الإضافة')}</Pill>], ["v45", L(locale, 'Finance close pack: AP/AR aging, bank exceptions, close export', 'حزمة إغلاق المالية: تقادم AP/AR واستثناءات البنك وتصدير الإغلاق'), <Pill tone="good">{L(locale, 'Added', 'تمت الإضافة')}</Pill>]]}/></Card>
      <Card title={L(locale, 'Still required for true enterprise production', 'ما يزال مطلوباً للنسخة المؤسسية الفعلية')} icon={<AlertTriangle/>}><ul className="mini-list"><li>{L(locale, 'Move all close/posting logic to Supabase Edge Functions with database transactions.', 'نقل منطق الإغلاق والترحيل إلى Supabase Edge Functions بمعاملات قاعدة بيانات.')}</li><li>{L(locale, 'Add real approval workflow and maker/checker control for close, variances, and finance posting.', 'إضافة مسار اعتماد حقيقي ومبدأ مُعد/مراجع للإغلاق والفروقات والترحيل المالي.')}</li><li>{L(locale, 'Add Excel/PDF board packs for monthly close, food cost, AP/AR, and stock count variances.', 'إضافة حزم Excel/PDF شهرية للإغلاق وتكلفة الطعام والذمم وفروقات الجرد.')}</li><li>{L(locale, 'Add unit conversion, FEFO, stock reservation, in-transit transfers, and inventory period locks.', 'إضافة التحويلات والوارد أولاً حسب الانتهاء FEFO والحجز والتحويلات تحت الطريق وقفل فترات المخزون.')}</li></ul></Card>
    </div>}
  </div>;
}
