import { useMemo, useState, type ReactNode } from 'react';
import {
  AlertTriangle,
  Banknote,
  BarChart3,
  BookOpen,
  CalendarCheck,
  CheckCircle2,
  ClipboardCheck,
  Database,
  Download,
  FileCheck2,
  FileSpreadsheet,
  Gauge,
  GitBranch,
  LockKeyhole,
  PackageCheck,
  PieChart,
  ShieldCheck,
  ShoppingCart,
  Sparkles,
  Store,
  Utensils,
  Wallet,
  XCircle,
} from 'lucide-react';

type Locale = 'en' | 'ar';
type Props = {
  state: any;
  totals?: any;
  update?: (fn: (current: any) => any, success?: string) => void;
  locale: Locale;
  notify?: (type: 'success' | 'warning' | 'error', message: string) => void;
};

type TabKey =
  | 'command'
  | 'close'
  | 'sales'
  | 'inventory'
  | 'foodCost'
  | 'procurement'
  | 'finance'
  | 'people'
  | 'governance'
  | 'backend'
  | 'qa';

function L(locale: Locale, en: string, ar: string) {
  return locale === 'ar' ? ar : en;
}

function money(value: number, locale: Locale) {
  return new Intl.NumberFormat(locale === 'ar' ? 'ar-SA' : 'en-US', {
    style: 'currency',
    currency: 'SAR',
    maximumFractionDigits: 2,
  }).format(Number.isFinite(value) ? value : 0);
}

function pct(value: number) {
  return `${Math.round((Number.isFinite(value) ? value : 0) * 10) / 10}%`;
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

function thisMonthStart() {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10);
}

function csvEscape(value: unknown) {
  const raw = String(value ?? '');
  return /[",\n]/.test(raw) ? `"${raw.replace(/"/g, '""')}"` : raw;
}

function downloadCsv(fileName: string, rows: Record<string, unknown>[]) {
  const headers = rows.length ? Object.keys(rows[0]) : ['message'];
  const body = [headers.join(','), ...rows.map((r) => headers.map((h) => csvEscape(r[h])).join(','))].join('\n');
  const blob = new Blob([body], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  a.click();
  URL.revokeObjectURL(url);
}

function id(prefix: string) {
  const random = typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID().slice(0, 8) : Math.random().toString(36).slice(2, 10);
  return `${prefix}-${random}`;
}

function between(date: string | undefined, from: string, to: string) {
  const d = String(date || '').slice(0, 10);
  return (!from || d >= from) && (!to || d <= to);
}

function sum<T>(rows: T[], fn: (row: T) => number) {
  return rows.reduce((acc, row) => acc + (Number(fn(row)) || 0), 0);
}

function groupBy<T>(rows: T[], keyFn: (row: T) => string) {
  return rows.reduce<Record<string, T[]>>((acc, row) => {
    const key = keyFn(row) || '—';
    (acc[key] ||= []).push(row);
    return acc;
  }, {});
}

function itemName(state: any, itemId: string) {
  const item = (state.items || []).find((i: any) => i.id === itemId || i.sku === itemId);
  return item?.nameEn || item?.sku || itemId || '—';
}

function storeName(state: any, storeId: string) {
  const store = (state.stores || []).find((s: any) => s.id === storeId || s.code === storeId);
  return store?.nameEn || store?.code || storeId || '—';
}

function branchName(state: any, branchId: string) {
  const branch = (state.branches || []).find((b: any) => b.id === branchId || b.code === branchId);
  return branch?.nameEn || branch?.code || branchId || '—';
}

function supplierName(state: any, supplierId: string) {
  const supplier = (state.suppliers || []).find((s: any) => s.id === supplierId || s.code === supplierId);
  return supplier?.name || supplier?.code || supplierId || '—';
}

function costCenterName(state: any, costCenterId: string) {
  const cc = (state.costCenters || []).find((c: any) => c.id === costCenterId || c.code === costCenterId);
  return cc?.nameEn || cc?.code || costCenterId || '—';
}

function stockByItemStore(state: any) {
  const map: Record<string, { itemId: string; storeId: string; qty: number; value: number; inQty: number; outQty: number }> = {};
  for (const m of state.stockMovements || []) {
    const key = `${m.itemId}::${m.storeId}`;
    const direction = m.direction === 'in' ? 1 : -1;
    const qtyValue = Number(m.qty || 0);
    const value = qtyValue * Number(m.unitCost || 0);
    map[key] ||= { itemId: m.itemId, storeId: m.storeId, qty: 0, value: 0, inQty: 0, outQty: 0 };
    map[key].qty += direction * qtyValue;
    map[key].value += direction * value;
    if (m.direction === 'in') map[key].inQty += qtyValue;
    else map[key].outQty += qtyValue;
  }
  return Object.values(map);
}

function averageCostByItem(state: any) {
  const rows = stockByItemStore(state);
  const grouped = groupBy(rows, (r) => r.itemId);
  const costs: Record<string, number> = {};
  for (const [itemId, itemRows] of Object.entries(grouped)) {
    const qty = sum(itemRows, (r) => Math.max(r.qty, 0));
    const value = sum(itemRows, (r) => Math.max(r.value, 0));
    costs[itemId] = qty > 0 ? value / qty : 0;
  }
  return costs;
}

function recipeDemand(state: any, from: string, to: string) {
  const costs = averageCostByItem(state);
  const demand: Record<string, { itemId: string; qty: number; value: number; salesQty: number }> = {};
  const sales = (state.sales || []).filter((s: any) => between(s.date, from, to));
  for (const sale of sales) {
    const recipeLines = (state.recipeLines || []).filter((r: any) => r.menuItemId === sale.menuItemId);
    for (const line of recipeLines) {
      const qty = Number(sale.qty || 0) * Number(line.qty || 0) * (1 + Number(line.wastagePct || 0) / 100);
      demand[line.itemId] ||= { itemId: line.itemId, qty: 0, value: 0, salesQty: 0 };
      demand[line.itemId].qty += qty;
      demand[line.itemId].value += qty * Number(costs[line.itemId] || 0);
      demand[line.itemId].salesQty += Number(sale.qty || 0);
    }
  }
  return Object.values(demand).sort((a, b) => b.value - a.value);
}

function journalBalance(journal: any) {
  const debit = sum(journal.lines || [], (l: any) => Number(l.debit || 0));
  const credit = sum(journal.lines || [], (l: any) => Number(l.credit || 0));
  return { debit, credit, diff: Math.round((debit - credit) * 100) / 100 };
}

function paymentAgingRows(state: any, locale: Locale) {
  const invoices = state.purchaseInvoices || [];
  const payments = state.supplierPayments || [];
  return invoices.map((inv: any) => {
    const total = sum(inv.lines || [], (l: any) => Number(l.qty || 0) * Number(l.unitCost || 0) * (1 + Number(l.vatRate || 0) / 100));
    const paid = sum(payments.filter((p: any) => p.invoiceRef === inv.ref || p.supplierId === inv.supplierId), (p: any) => Number(p.amount || 0));
    const open = Math.max(0, total - paid);
    const age = Math.max(0, Math.floor((Date.now() - new Date(inv.invoiceDate || inv.deliveryDate || today()).getTime()) / 86400000));
    return { ref: inv.ref || inv.invoiceNo, supplier: supplierName(state, inv.supplierId), total, paid, open, age, bucket: age <= 30 ? '0-30' : age <= 60 ? '31-60' : age <= 90 ? '61-90' : '90+' };
  }).filter((r: any) => r.open > 0.01).sort((a: any, b: any) => b.open - a.open);
}

function calculateControlData(state: any, totals: any, from: string, to: string, locale: Locale) {
  const movements = state.stockMovements || [];
  const balances = stockByItemStore(state);
  const negativeRows = balances.filter((b) => b.qty < -0.0001);
  const zeroCostRows = balances.filter((b) => b.qty > 0 && b.value <= 0.0001);
  const shortages = (state.inventoryApprovals || []).filter((a: any) => a.requestType === 'count_variance' && a.direction === 'out' && between(a.date, from, to));
  const surplus = (state.inventoryApprovals || []).filter((a: any) => a.requestType === 'count_variance' && a.direction === 'in' && between(a.date, from, to));
  const postedSales = (state.sales || []).filter((s: any) => between(s.date, from, to));
  const postedJournals = (state.journals || []).filter((j: any) => j.status === 'posted' && between(j.date, from, to));
  const unbalancedJournals = postedJournals.filter((j: any) => Math.abs(journalBalance(j).diff) > 0.01);
  const activePeriod = (state.fiscalPeriods || []).find((p: any) => from >= p.startDate && to <= p.endDate);
  const grniBalance = sum(postedJournals.flatMap((j: any) => j.lines || []), (l: any) => l.accountCode === '2115' ? Number(l.credit || 0) - Number(l.debit || 0) : 0);
  const apOpen = paymentAgingRows(state, locale);
  const stockValue = sum(balances, (b) => Math.max(0, b.value));
  const theoretical = recipeDemand(state, from, to);
  const actualOut = movements.filter((m: any) => m.direction === 'out' && between(m.date, from, to));
  const actualByItem = groupBy(actualOut, (m: any) => m.itemId);
  const theoryRows = theoretical.map((d) => {
    const actualQty = sum(actualByItem[d.itemId] || [], (m: any) => Number(m.qty || 0));
    const avg = d.qty > 0 ? d.value / d.qty : 0;
    return { ...d, actualQty, varianceQty: actualQty - d.qty, varianceValue: (actualQty - d.qty) * avg };
  });
  const branchSales = Object.entries(groupBy(postedSales, (s: any) => s.branchId)).map(([branchId, rows]: any) => ({
    branchId,
    branch: branchName(state, branchId),
    orders: rows.length,
    qty: sum(rows, (s: any) => Number(s.qty || 0)),
  }));
  const dataQuality = [
    { area: 'Branches', issue: 'Missing branches', count: (state.branches || []).length ? 0 : 1, severity: 'high' },
    { area: 'Stores', issue: 'Stores without branch', count: (state.stores || []).filter((s: any) => !s.branchId).length, severity: 'high' },
    { area: 'Items', issue: 'Duplicate SKU', count: countDuplicate(state.items || [], (i: any) => i.sku), severity: 'high' },
    { area: 'Menu', issue: 'Menu without active recipe', count: (state.menuItems || []).filter((m: any) => !(state.recipeLines || []).some((r: any) => r.menuItemId === m.id)).length, severity: 'medium' },
    { area: 'Suppliers', issue: 'Missing VAT or bank data', count: (state.suppliers || []).filter((s: any) => !s.vatNo || !s.bankAccount).length, severity: 'medium' },
    { area: 'Finance', issue: 'Unbalanced posted journals', count: unbalancedJournals.length, severity: 'critical' },
    { area: 'Inventory', issue: 'Negative stock rows', count: negativeRows.length, severity: 'critical' },
    { area: 'Inventory', issue: 'Positive stock with zero value', count: zeroCostRows.length, severity: 'high' },
  ];
  const readyChecks = [
    { key: 'branches', ok: (state.branches || []).length > 0, label: L(locale, 'Branches configured', 'تم إعداد الفروع') },
    { key: 'stores', ok: (state.stores || []).length > 0, label: L(locale, 'Stores configured', 'تم إعداد المخازن') },
    { key: 'items', ok: (state.items || []).length > 0, label: L(locale, 'Items configured', 'تم إعداد الأصناف') },
    { key: 'stock', ok: movements.some((m: any) => m.direction === 'in'), label: L(locale, 'Opening/purchase stock posted', 'تم ترحيل رصيد/شراء مخزون') },
    { key: 'count', ok: (state.inventoryApprovals || []).some((a: any) => a.requestType === 'count_variance'), label: L(locale, 'Monthly count variance reviewed', 'تمت مراجعة فروقات الجرد الشهري') },
    { key: 'sales', ok: postedSales.length > 0, label: L(locale, 'Sales posted for period', 'تم ترحيل مبيعات الفترة') },
    { key: 'finance', ok: postedJournals.length > 0 && unbalancedJournals.length === 0, label: L(locale, 'Posted journals are balanced', 'القيود المرحلة متوازنة') },
    { key: 'negative', ok: negativeRows.length === 0, label: L(locale, 'No negative stock', 'لا يوجد مخزون سالب') },
    { key: 'zero', ok: zeroCostRows.length === 0, label: L(locale, 'No zero-cost stock exposure', 'لا يوجد مخزون بتكلفة صفرية') },
    { key: 'period', ok: !!activePeriod, label: L(locale, 'Fiscal period exists', 'الفترة المالية موجودة') },
  ];
  const score = Math.round((readyChecks.filter((c) => c.ok).length / Math.max(1, readyChecks.length)) * 100);
  return { balances, negativeRows, zeroCostRows, shortages, surplus, postedSales, postedJournals, unbalancedJournals, activePeriod, grniBalance, apOpen, stockValue, theoryRows, branchSales, dataQuality, readyChecks, score };
}

function countDuplicate<T>(rows: T[], fn: (row: T) => string) {
  const counts: Record<string, number> = {};
  for (const row of rows) {
    const key = fn(row);
    if (!key) continue;
    counts[key] = (counts[key] || 0) + 1;
  }
  return Object.values(counts).filter((count) => count > 1).length;
}

function Card({ title, icon, children, action }: { title: string; icon?: ReactNode; children: ReactNode; action?: ReactNode }) {
  return <section className="card"><div className="card-header"><div className="card-title">{icon}{title}</div>{action}</div>{children}</section>;
}

function KPI({ label, value, hint, icon }: { label: string; value: string; hint: string; icon: ReactNode }) {
  return <div className="kpi"><div className="kpi-icon">{icon}</div><div><span>{label}</span><strong>{value}</strong><small>{hint}</small></div></div>;
}

function Table({ headers, rows }: { headers: string[]; rows: ReactNode[][] }) {
  return <div className="table-wrap"><table><thead><tr>{headers.map((h) => <th key={h}>{h}</th>)}</tr></thead><tbody>{rows.length ? rows.map((r, i) => <tr key={i}>{r.map((c, ci) => <td key={ci}>{c}</td>)}</tr>) : <tr><td colSpan={headers.length}>—</td></tr>}</tbody></table></div>;
}

function StatusPill({ ok, label }: { ok: boolean; label: string }) {
  return <span className={`status-pill ${ok ? 'ok' : 'bad'}`}>{ok ? <CheckCircle2 size={14}/> : <XCircle size={14}/>} {label}</span>;
}

function TabButton({ active, value, onClick, children }: { active: string; value: TabKey; onClick: (v: TabKey) => void; children: ReactNode }) {
  return <button className={active === value ? 'active-tab' : ''} onClick={() => onClick(value)}>{children}</button>;
}

export default function EnterpriseUltraSuitePage({ state, totals = {}, update, locale, notify }: Props) {
  const [tab, setTab] = useState<TabKey>('command');
  const [from, setFrom] = useState(thisMonthStart());
  const [to, setTo] = useState(today());
  const data = useMemo(() => calculateControlData(state, totals, from, to, locale), [state, totals, from, to, locale]);

  const closePeriod = () => {
    if (!update) return;
    update((current: any) => {
      const periods = [...(current.fiscalPeriods || [])];
      let period = periods.find((p: any) => from >= p.startDate && to <= p.endDate);
      if (!period) {
        period = { id: id('PER'), code: `AUTO-${from.slice(0, 7)}`, nameEn: `Auto close ${from} to ${to}`, nameAr: `إغلاق آلي ${from} إلى ${to}`, startDate: from, endDate: to, status: 'open' };
        periods.push(period);
      }
      period.status = data.score >= 80 ? 'locked' : 'open';
      period.lockedAt = data.score >= 80 ? new Date().toISOString() : undefined;
      period.lockedBy = data.score >= 80 ? 'Local Enterprise HQ v65' : undefined;
      return {
        ...current,
        fiscalPeriods: periods,
        audits: [
          ...(current.audits || []),
          { id: id('AUD'), at: new Date().toISOString(), action: data.score >= 80 ? 'PERIOD_LOCKED' : 'PERIOD_CLOSE_REVIEW', entity: 'enterprise_close', ref: period.code, user: 'Enterprise HQ v65', note: `Readiness score ${data.score}% for ${from} to ${to}` },
        ],
      };
    }, data.score >= 80 ? L(locale, 'Period locked in local trial mode.', 'تم قفل الفترة في وضع التجربة المحلي.') : L(locale, 'Close review saved. Resolve blockers before locking.', 'تم حفظ مراجعة الإغلاق. عالج الموانع قبل القفل.'));
  };

  const exportPack = () => {
    const rows = [
      ...data.readyChecks.map((c) => ({ section: 'monthly_close', item: c.label, status: c.ok ? 'ready' : 'missing', value: '' })),
      ...data.dataQuality.map((r) => ({ section: 'data_quality', item: `${r.area} - ${r.issue}`, status: r.count ? r.severity : 'ok', value: r.count })),
      ...data.theoryRows.slice(0, 50).map((r) => ({ section: 'food_cost', item: itemName(state, r.itemId), status: Math.abs(r.varianceQty) > 0.001 ? 'variance' : 'ok', value: `${r.varianceQty}` })),
    ];
    downloadCsv('v65_enterprise_hq_control_pack.csv', rows.length ? rows : [{ section: 'empty', item: 'No rows', status: 'ok', value: '' }]);
  };

  const exportLaunchPlan = () => {
    downloadCsv('v65_backend_launch_plan.csv', backendSteps(locale).map((s, i) => ({ no: i + 1, phase: s.phase, deliverable: s.deliverable, risk: s.risk, owner: s.owner })));
  };

  return <div className="page-grid">
    <Card title={L(locale, 'Enterprise HQ v65 — Mega Ultra Control Suite', 'مركز المؤسسة v65 — حزمة رقابية فائقة')} icon={<Sparkles/>} action={<div className="button-row"><button onClick={exportPack}><Download size={16}/>{L(locale, 'Export control pack', 'تصدير حزمة الرقابة')}</button><button onClick={exportLaunchPlan}><Database size={16}/>{L(locale, 'Export backend plan', 'تصدير خطة الخلفية')}</button></div>}>
      <div className="filter-bar"><label>{L(locale, 'From', 'من')}<input type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></label><label>{L(locale, 'To', 'إلى')}<input type="date" value={to} onChange={(e) => setTo(e.target.value)} /></label><button onClick={closePeriod}><LockKeyhole size={16}/>{L(locale, 'Review / lock period', 'مراجعة / قفل الفترة')}</button></div>
      <div className="kpi-grid"><KPI label={L(locale, 'Enterprise readiness', 'جاهزية المؤسسة')} value={pct(data.score)} hint={L(locale, 'Based on 10 control checks', 'بناءً على ١٠ فحوصات رقابية')} icon={<Gauge/>}/><KPI label={L(locale, 'Inventory exposure', 'مخاطر المخزون')} value={String(data.negativeRows.length + data.zeroCostRows.length)} hint={L(locale, 'Negative + zero-cost rows', 'السالب + صفوف التكلفة الصفرية')} icon={<PackageCheck/>}/><KPI label={L(locale, 'AP open', 'ذمم الموردين المفتوحة')} value={money(sum(data.apOpen, (r: any) => r.open), locale)} hint={L(locale, 'Invoice-level estimate', 'تقدير على مستوى الفاتورة')} icon={<Wallet/>}/><KPI label={L(locale, 'Theoretical food cost', 'تكلفة الطعام النظرية')} value={money(sum(data.theoryRows, (r: any) => r.value), locale)} hint={L(locale, 'From recipes and sales', 'من الوصفات والمبيعات')} icon={<Utensils/>}/></div>
    </Card>
    <div className="tabs wrap">
      <TabButton active={tab} value="command" onClick={setTab}>{L(locale, 'Command', 'القيادة')}</TabButton>
      <TabButton active={tab} value="close" onClick={setTab}>{L(locale, 'Close', 'الإغلاق')}</TabButton>
      <TabButton active={tab} value="sales" onClick={setTab}>{L(locale, 'Sales Close', 'إغلاق المبيعات')}</TabButton>
      <TabButton active={tab} value="inventory" onClick={setTab}>{L(locale, 'Inventory Risk', 'مخاطر المخزون')}</TabButton>
      <TabButton active={tab} value="foodCost" onClick={setTab}>{L(locale, 'Food Cost', 'تكلفة الطعام')}</TabButton>
      <TabButton active={tab} value="procurement" onClick={setTab}>{L(locale, 'Procurement', 'المشتريات')}</TabButton>
      <TabButton active={tab} value="finance" onClick={setTab}>{L(locale, 'Finance', 'المالية')}</TabButton>
      <TabButton active={tab} value="people" onClick={setTab}>{L(locale, 'People', 'الأفراد')}</TabButton>
      <TabButton active={tab} value="governance" onClick={setTab}>{L(locale, 'Governance', 'الحوكمة')}</TabButton>
      <TabButton active={tab} value="backend" onClick={setTab}>{L(locale, 'Backend', 'الخلفية')}</TabButton>
      <TabButton active={tab} value="qa" onClick={setTab}>{L(locale, 'QA', 'الاختبار')}</TabButton>
    </div>
    {tab === 'command' && <CommandTab data={data} locale={locale} />}
    {tab === 'close' && <CloseTab data={data} locale={locale} />}
    {tab === 'sales' && <SalesCloseTab state={state} data={data} locale={locale} from={from} to={to} />}
    {tab === 'inventory' && <InventoryRiskTab state={state} data={data} locale={locale} />}
    {tab === 'foodCost' && <FoodCostTab state={state} data={data} locale={locale} />}
    {tab === 'procurement' && <ProcurementTab state={state} locale={locale} from={from} to={to} />}
    {tab === 'finance' && <FinanceTab state={state} data={data} locale={locale} totals={totals} />}
    {tab === 'people' && <PeopleTab state={state} locale={locale} />}
    {tab === 'governance' && <GovernanceTab state={state} data={data} locale={locale} />}
    {tab === 'backend' && <BackendTab locale={locale} />}
    {tab === 'qa' && <QATab state={state} data={data} locale={locale} />}
  </div>;
}

function CommandTab({ data, locale }: any) {
  return <div className="page-grid two"><Card title={L(locale, 'Executive exception board', 'لوحة الاستثناءات التنفيذية')} icon={<AlertTriangle/>}><Table headers={[L(locale, 'Area', 'المنطقة'), L(locale, 'Issue', 'المشكلة'), L(locale, 'Count', 'العدد'), L(locale, 'Severity', 'الخطورة')]} rows={data.dataQuality.map((r: any) => [r.area, r.issue, r.count, <span className={`badge ${r.count ? 'bad' : 'ok'}`}>{r.count ? r.severity : 'ok'}</span>])}/></Card><Card title={L(locale, 'Close readiness snapshot', 'ملخص جاهزية الإغلاق')} icon={<ClipboardCheck/>}><div className="health-grid">{data.readyChecks.map((c: any) => <div key={c.key} className={`health ${c.ok ? 'ok' : 'bad'}`}>{c.ok ? <CheckCircle2 size={16}/> : <XCircle size={16}/>} {c.label}</div>)}</div></Card></div>;
}

function CloseTab({ data, locale }: any) {
  return <Card title={L(locale, 'Monthly close checklist', 'قائمة الإغلاق الشهري')} icon={<CalendarCheck/>}><Table headers={[L(locale, 'Control', 'البند الرقابي'), L(locale, 'Status', 'الحالة'), L(locale, 'Action', 'الإجراء')]} rows={data.readyChecks.map((c: any) => [c.label, <StatusPill ok={c.ok} label={c.ok ? L(locale, 'Ready', 'جاهز') : L(locale, 'Missing', 'ناقص')} />, c.ok ? L(locale, 'No action', 'لا يوجد إجراء') : L(locale, 'Resolve before period lock', 'يعالج قبل قفل الفترة')])}/><div className="notice">{L(locale, 'Ultra-professional close requires sales, inventory, AP, bank, VAT, journals, and count variances to be clean before locking.', 'الإغلاق الاحترافي يتطلب نظافة المبيعات والمخزون والموردين والبنوك والضريبة والقيود وفروقات الجرد قبل القفل.')}</div></Card>;
}

function SalesCloseTab({ state, data, locale, from, to }: any) {
  const sales = (state.sales || []).filter((s: any) => between(s.date, from, to));
  const byBranch = data.branchSales || [];
  const salesJournals = (state.journals || []).filter((j: any) => between(j.date, from, to) && String(j.source || '').toLowerCase().includes('sale'));
  return <div className="page-grid two"><Card title={L(locale, 'Sales close readiness', 'جاهزية إغلاق المبيعات')} icon={<CreditCardIcon/>}><div className="health-grid"><div className={`health ${sales.length ? 'ok' : 'bad'}`}><CheckCircle2 size={16}/> {L(locale, 'Sales documents', 'مستندات المبيعات')}: {sales.length}</div><div className={`health ${salesJournals.length ? 'ok' : 'bad'}`}><FileCheck2 size={16}/> {L(locale, 'Sales journals', 'قيود المبيعات')}: {salesJournals.length}</div><div className={`health ${data.theoryRows.length ? 'ok' : 'bad'}`}><Utensils size={16}/> {L(locale, 'Recipe demand rows', 'صفوف طلب الوصفة')}: {data.theoryRows.length}</div></div><Table headers={[L(locale, 'Branch', 'الفرع'), L(locale, 'Orders', 'الطلبات'), L(locale, 'Quantity', 'الكمية')]} rows={byBranch.map((r: any) => [r.branch, r.orders, r.qty])}/></Card><Card title={L(locale, 'Foodics settlement controls', 'رقابة تسوية فودكس')} icon={<Banknote/>}><Table headers={[L(locale, 'Control', 'الفحص'), L(locale, 'Professional treatment', 'المعالجة الاحترافية')]} rows={[
    [L(locale, 'Payment method mapping', 'ربط طرق الدفع'), L(locale, 'Cash/card/delivery/internal methods must map to GL accounts before posting.', 'يجب ربط النقد/الشبكات/التطبيقات/الداخلي بحسابات الأستاذ قبل الترحيل.')],
    [L(locale, 'Voids and returns', 'الإلغاءات والمرتجعات'), L(locale, 'Voids excluded, returns reverse revenue/VAT/payment clearing.', 'الإلغاء يستبعد والمرتجع يعكس الإيراد والضريبة والتسوية.')],
    [L(locale, 'Daily cashier close', 'إغلاق الكاشير اليومي'), L(locale, 'Next enterprise step: reconcile Foodics payments to cashier/bank settlement.', 'الخطوة التالية: مطابقة مدفوعات فودكس مع إغلاق الكاشير والبنك.')],
  ]}/></Card></div>;
}

function CreditCardIcon() { return <Banknote/>; }

function InventoryRiskTab({ state, data, locale }: any) {
  return <div className="page-grid"><div className="kpi-grid"><KPI label={L(locale, 'Stock value', 'قيمة المخزون')} value={money(data.stockValue, locale)} hint={L(locale, 'Positive stock value', 'قيمة المخزون الموجب')} icon={<Store/>}/><KPI label={L(locale, 'Negative rows', 'صفوف سالبة')} value={String(data.negativeRows.length)} hint={L(locale, 'Must be resolved before close', 'تعالج قبل الإغلاق')} icon={<AlertTriangle/>}/><KPI label={L(locale, 'Zero-cost rows', 'تكلفة صفرية')} value={String(data.zeroCostRows.length)} hint={L(locale, 'Costing exposure', 'مخاطر التكلفة')} icon={<PackageCheck/>}/><KPI label={L(locale, 'Count variances', 'فروقات الجرد')} value={String(data.shortages.length + data.surplus.length)} hint={L(locale, 'Period variance requests', 'طلبات فروقات الفترة')} icon={<ClipboardCheck/>}/></div><Card title={L(locale, 'Negative and zero-cost exposure', 'مخاطر السالب والتكلفة الصفرية')} icon={<PackageCheck/>}><Table headers={[L(locale, 'Store', 'المخزن'), L(locale, 'Item', 'الصنف'), L(locale, 'Qty', 'الكمية'), L(locale, 'Value', 'القيمة'), L(locale, 'Issue', 'المشكلة')]} rows={[...data.negativeRows.map((r: any) => [storeName(state, r.storeId), itemName(state, r.itemId), r.qty.toFixed(3), money(r.value, locale), L(locale, 'Negative stock', 'مخزون سالب')]), ...data.zeroCostRows.map((r: any) => [storeName(state, r.storeId), itemName(state, r.itemId), r.qty.toFixed(3), money(r.value, locale), L(locale, 'Zero-cost stock', 'مخزون بتكلفة صفرية')])].slice(0, 80)}/></Card></div>;
}

function FoodCostTab({ state, data, locale }: any) {
  const rows = data.theoryRows.slice(0, 80).map((r: any) => [itemName(state, r.itemId), r.qty.toFixed(3), money(r.value, locale), r.actualQty.toFixed(3), r.varianceQty.toFixed(3), money(r.varianceValue, locale), <span className={`badge ${Math.abs(r.varianceValue) > 1 ? 'warning' : 'ok'}`}>{Math.abs(r.varianceValue) > 1 ? L(locale, 'Review', 'مراجعة') : L(locale, 'OK', 'سليم')}</span>]);
  return <Card title={L(locale, 'Theoretical vs actual food cost control', 'رقابة تكلفة الطعام النظرية مقابل الفعلية')} icon={<Utensils/>}><Table headers={[L(locale, 'Ingredient', 'المكون'), L(locale, 'Theoretical Qty', 'الكمية النظرية'), L(locale, 'Theoretical Value', 'القيمة النظرية'), L(locale, 'Actual Issued', 'المصروف فعلياً'), L(locale, 'Variance Qty', 'فرق الكمية'), L(locale, 'Variance Value', 'فرق القيمة'), L(locale, 'Status', 'الحالة')]} rows={rows}/><div className="notice">{L(locale, 'This report is strongest after Foodics sales, recipes, purchase costs, and monthly stock count are all posted.', 'هذا التقرير يصبح أقوى بعد ترحيل مبيعات فودكس والوصفات وتكاليف الشراء والجرد الشهري.')}</div></Card>;
}

function ProcurementTab({ state, locale, from, to }: any) {
  const poLines = (state.purchaseOrders || []).flatMap((po: any) => (po.lines || []).map((line: any) => ({ po, line })));
  const grnLines = (state.goodsReceipts || []).flatMap((grn: any) => (grn.lines || []).map((line: any) => ({ grn, line })));
  const invoiceLines = (state.purchaseInvoices || []).flatMap((inv: any) => (inv.lines || []).map((line: any) => ({ inv, line })));
  const rows = poLines.map(({ po, line }: any) => {
    const received = sum(grnLines.filter((g: any) => g.grn.poId === po.id && g.line.itemId === line.itemId), (g: any) => Number(g.line.qty || 0));
    const invoiced = sum(invoiceLines.filter((i: any) => i.inv.supplierId === po.supplierId && i.line.itemId === line.itemId), (i: any) => Number(i.line.qty || 0));
    const avgInvoiceCost = (() => { const related = invoiceLines.filter((i: any) => i.inv.supplierId === po.supplierId && i.line.itemId === line.itemId); const qty = sum(related, (i: any) => Number(i.line.qty || 0)); const val = sum(related, (i: any) => Number(i.line.qty || 0) * Number(i.line.unitCost || 0)); return qty ? val / qty : 0; })();
    return [po.ref, supplierName(state, po.supplierId), itemName(state, line.itemId), line.qty, received, invoiced, money(Number(line.unitCost || 0), locale), money(avgInvoiceCost, locale), <span className={`badge ${Math.abs((avgInvoiceCost || line.unitCost) - line.unitCost) > 0.01 || Math.abs(received - line.qty) > 0.01 ? 'warning' : 'ok'}`}>{L(locale, 'Variance review', 'مراجعة الفرق')}</span>];
  });
  return <Card title={L(locale, 'Procurement variance cockpit', 'مركز انحرافات المشتريات')} icon={<ShoppingCart/>}><Table headers={['PO', L(locale, 'Supplier', 'المورد'), L(locale, 'Item', 'الصنف'), L(locale, 'PO Qty', 'كمية الطلب'), L(locale, 'GRN Qty', 'كمية الاستلام'), L(locale, 'Invoice Qty', 'كمية الفاتورة'), L(locale, 'PO Cost', 'سعر الأمر'), L(locale, 'Invoice Cost', 'سعر الفاتورة'), L(locale, 'Status', 'الحالة')]} rows={rows}/></Card>;
}

function FinanceTab({ state, data, locale, totals }: any) {
  const apRows = data.apOpen.slice(0, 50).map((r: any) => [r.ref, r.supplier, money(r.total, locale), money(r.paid, locale), money(r.open, locale), r.age, r.bucket]);
  const bankExceptions = (state.bankReconLines || []).filter((b: any) => b.status !== 'matched');
  return <div className="page-grid two"><Card title={L(locale, 'CFO close pack', 'حزمة إغلاق المدير المالي')} icon={<PieChart/>}><div className="kpi-grid"><KPI label="AP" value={money(sum(data.apOpen, (r: any) => r.open), locale)} hint={L(locale, 'Open invoices', 'فواتير مفتوحة')} icon={<Wallet/>}/><KPI label="VAT" value={money((totals.vatPayable || 0), locale)} hint={L(locale, 'VAT payable estimate', 'تقدير ضريبة مستحقة')} icon={<FileSpreadsheet/>}/><KPI label={L(locale, 'Unmatched bank', 'بنك غير مطابق')} value={String(bankExceptions.length)} hint={L(locale, 'Recon exceptions', 'استثناءات المطابقة')} icon={<Banknote/>}/><KPI label={L(locale, 'Unbalanced journals', 'قيود غير متوازنة')} value={String(data.unbalancedJournals.length)} hint={L(locale, 'Must be zero', 'يجب أن يكون صفر')} icon={<BookOpen/>}/></div></Card><Card title={L(locale, 'AP aging preview', 'معاينة أعمار الموردين')} icon={<Wallet/>}><Table headers={['Ref', L(locale, 'Supplier', 'المورد'), L(locale, 'Total', 'الإجمالي'), L(locale, 'Paid', 'المدفوع'), L(locale, 'Open', 'المتبقي'), L(locale, 'Age', 'العمر'), L(locale, 'Bucket', 'الشريحة')]} rows={apRows}/></Card></div>;
}

function PeopleTab({ state, locale }: any) {
  const employees = state.employees || [];
  const punches = state.attendance || [];
  const schedules = state.schedules || [];
  const noSchedule = employees.filter((e: any) => !schedules.some((s: any) => s.employeeId === e.id));
  return <div className="page-grid two"><Card title={L(locale, 'People operations readiness', 'جاهزية عمليات الأفراد')} icon={<UsersIcon/>}><div className="kpi-grid"><KPI label={L(locale, 'Employees', 'الموظفون')} value={String(employees.length)} hint={L(locale, 'Active/local master data', 'بيانات محلية نشطة')} icon={<UsersIcon/>}/><KPI label={L(locale, 'Punches', 'البصمات')} value={String(punches.length)} hint={L(locale, 'Attendance logs', 'سجلات الحضور')} icon={<ClipboardCheck/>}/><KPI label={L(locale, 'No schedule', 'بدون جدول')} value={String(noSchedule.length)} hint={L(locale, 'Need weekly plan', 'تحتاج جدول أسبوعي')} icon={<CalendarCheck/>}/></div></Card><Card title={L(locale, 'Next HR enterprise controls', 'رقابات الموارد البشرية القادمة')} icon={<ClipboardCheck/>}><Table headers={[L(locale, 'Control', 'الرقابة'), L(locale, 'Reason', 'السبب')]} rows={[
    [L(locale, 'Weekly schedule approval', 'اعتماد الجدول الأسبوعي'), L(locale, 'Needed before cashier shift compliance and overtime.', 'مطلوب قبل امتثال ورديات الكاشير والوقت الإضافي.')],
    [L(locale, 'Punch correction workflow', 'تصحيح الحضور والانصراف'), L(locale, 'HR must approve missing/incorrect punches.', 'يجب اعتماد التصحيحات من الموارد البشرية.')],
    [L(locale, 'Payroll journal bridge', 'ربط مسير الرواتب بالقيود'), L(locale, 'Payroll should create GL/AP entries.', 'المسير يجب أن ينشئ قيود محاسبية وذمم.')],
  ]}/></Card></div>;
}
function UsersIcon() { return <ShieldCheck/>; }

function GovernanceTab({ state, data, locale }: any) {
  const criticalActions = ['finance.journal.post', 'finance.period.lock', 'purchasing.po.approve', 'purchasing.grn.post', 'purchasing.payment.post', 'inventory.adjustment.approve', 'sales.post', 'production.batch.post', 'imports.manage', 'access.manage'];
  const permissions = new Set((state.roles || []).flatMap((r: any) => r.permissions || []));
  const rows = criticalActions.map((action) => [action, permissions.has(action) ? <StatusPill ok label={L(locale, 'Covered', 'مغطى')} /> : <StatusPill ok={false} label={L(locale, 'Missing in roles', 'غير موجود في الأدوار')} />, L(locale, 'Must be enforced server-side in production.', 'يجب فرضها من الخادم في الإنتاج.')]);
  return <div className="page-grid two"><Card title={L(locale, 'Permission coverage map', 'خريطة تغطية الصلاحيات')} icon={<ShieldCheck/>}><Table headers={[L(locale, 'Action', 'الإجراء'), L(locale, 'Coverage', 'التغطية'), L(locale, 'Policy', 'السياسة')]} rows={rows}/></Card><Card title={L(locale, 'Data quality governance', 'حوكمة جودة البيانات')} icon={<FileCheck2/>}><Table headers={[L(locale, 'Area', 'المنطقة'), L(locale, 'Issue', 'المشكلة'), L(locale, 'Count', 'العدد'), L(locale, 'Severity', 'الخطورة')]} rows={data.dataQuality.map((r: any) => [r.area, r.issue, r.count, r.severity])}/></Card></div>;
}

function BackendTab({ locale }: { locale: Locale }) {
  return <Card title={L(locale, 'Supabase backend launch blueprint', 'خطة إطلاق خلفية Supabase')} icon={<Database/>}><Table headers={[L(locale, 'Phase', 'المرحلة'), L(locale, 'Deliverable', 'المخرج'), L(locale, 'Risk controlled', 'المخاطر المغطاة'), L(locale, 'Owner', 'المالك')]} rows={backendSteps(locale).map((s) => [s.phase, s.deliverable, s.risk, s.owner])}/><div className="notice">{L(locale, 'This is the required move from local prototype to real multi-user ERP. Posting must become server-side before live finance/inventory use.', 'هذه هي النقلة المطلوبة من نموذج محلي إلى نظام متعدد المستخدمين. يجب أن يصبح الترحيل من الخادم قبل الاستخدام الحقيقي للمالية والمخزون.')}</div></Card>;
}

function backendSteps(locale: Locale) {
  return [
    { phase: '01', deliverable: L(locale, 'Auth + profile tables + branch/store scopes', 'المصادقة + ملفات المستخدمين + نطاق الفروع والمخازن'), risk: L(locale, 'Unknown user / unsafe access', 'مستخدم مجهول / وصول غير آمن'), owner: 'Platform' },
    { phase: '02', deliverable: L(locale, 'Core master data schema + constraints', 'مخطط البيانات الأساسية مع القيود'), risk: L(locale, 'Duplicate/broken master data', 'بيانات أساسية مكررة أو مكسورة'), owner: 'Data' },
    { phase: '03', deliverable: L(locale, 'Inventory ledger + stock costing functions', 'دفتر المخزون + دوال التكلفة'), risk: L(locale, 'Wrong stock/cost', 'مخزون أو تكلفة خاطئة'), owner: 'Inventory' },
    { phase: '04', deliverable: L(locale, 'Accounting posting Edge Functions', 'دوال ترحيل محاسبية'), risk: L(locale, 'Client-side manipulation', 'تلاعب من الواجهة'), owner: 'Finance' },
    { phase: '05', deliverable: L(locale, 'Foodics import staging + batch register', 'مرحلة استيراد فودكس وسجل الدفعات'), risk: L(locale, 'Duplicate/bad imports', 'استيرادات مكررة أو خاطئة'), owner: 'Sales' },
    { phase: '06', deliverable: L(locale, 'RLS policies + audit triggers', 'سياسات RLS ومحفزات التدقيق'), risk: L(locale, 'Data leakage / weak audit', 'تسرب بيانات / تدقيق ضعيف'), owner: 'Security' },
    { phase: '07', deliverable: L(locale, 'Attachments storage buckets', 'مخازن المرفقات'), risk: L(locale, 'Missing supporting documents', 'غياب المستندات المؤيدة'), owner: 'Operations' },
    { phase: '08', deliverable: L(locale, 'Backups + restore drill', 'نسخ احتياطي وتجربة استعادة'), risk: L(locale, 'Data loss', 'فقدان البيانات'), owner: 'IT' },
  ];
}

function QATab({ data, locale }: any) {
  const tests = [
    { area: 'Startup', test: L(locale, 'Load master data and fast trial scenario', 'تحميل البيانات الأساسية وسيناريو التجربة'), expected: 'No crash' },
    { area: 'Inventory', test: L(locale, 'Post opening stock, generate count sheet, upload count, approve variance', 'ترحيل افتتاحي، توليد جرد، رفع الجرد، اعتماد الفرق'), expected: 'Stock + GL movement' },
    { area: 'Foodics', test: L(locale, 'Upload products, ingredients, modifiers, orders, lines, payments', 'رفع المنتجات والمكونات والإضافات والطلبات والبنود والمدفوعات'), expected: 'Validation cockpit works' },
    { area: 'Posting', test: L(locale, 'Approve and post sales accounting only, then reverse with reason', 'اعتماد وترحيل المبيعات محاسبياً ثم عكس بسبب'), expected: 'Audit-safe reversal' },
    { area: 'Finance', test: L(locale, 'Post balanced manual journal and block unbalanced opening batch', 'ترحيل قيد متوازن ومنع افتتاحي غير متوازن'), expected: 'Controls enforced' },
    { area: 'Close', test: L(locale, 'Review v65 close score and export control pack', 'مراجعة درجة الإغلاق وتصدير حزمة الرقابة'), expected: `${data.score}%` },
  ];
  return <Card title={L(locale, 'QA regression control center', 'مركز اختبار الجودة الرجعي')} icon={<FileSpreadsheet/>} action={<button onClick={() => downloadCsv('v65_qa_regression_suite.csv', tests)}><Download size={16}/>{L(locale, 'Export QA suite', 'تصدير خطة الاختبار')}</button>}><Table headers={[L(locale, 'Area', 'المنطقة'), L(locale, 'Test', 'الاختبار'), L(locale, 'Expected result', 'النتيجة المتوقعة')]} rows={tests.map((t) => [t.area, t.test, t.expected])}/></Card>;
}
