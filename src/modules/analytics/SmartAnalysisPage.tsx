import { useMemo, useState, type ReactNode } from 'react';
import {
  Archive,
  BadgeDollarSign,
  Banknote,
  BarChart3,
  BrainCircuit,
  CalendarDays,
  ChefHat,
  ClipboardCheck,
  CreditCard,
  Download,
  Factory,
  FileSpreadsheet,
  Landmark,
  LayoutDashboard,
  PackageCheck,
  PieChart,
  ReceiptText,
  Search,
  ShieldCheck,
  ShoppingCart,
  Sparkles,
  Store,
  Wallet,
} from 'lucide-react';

type Locale = 'en' | 'ar';
type Tone = 'neutral' | 'good' | 'warn' | 'bad' | 'info';
type ViewKey = 'overview' | 'sales' | 'inventory' | 'finance' | 'quality' | 'exports';
type PresetKey = 'mtd' | 'qtd' | 'ytd' | 'all' | 'custom';
type DataRow = { label: string; value: number; hint?: string; tone?: Tone };
type KpiRow = { key: string; label: string; value: string; hint: string; tone: Tone; icon: ReactNode; data: DataRow[] };

const L = (_locale: Locale, en: string, _ar: string) => en;
const rows = <T,>(value: unknown): T[] => Array.isArray(value) ? value as T[] : [];
const num = (value: unknown, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

function today() {
  return new Date().toISOString().slice(0, 10);
}

function asDate(value: string) {
  return new Date(`${value || today()}T00:00:00`);
}

function isoDate(value: unknown) {
  return String(value || '').slice(0, 10);
}

function addDaysIso(value: string, days: number) {
  const d = asDate(value);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

function startOfMonthIso(value = today()) {
  const d = asDate(value);
  return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10);
}

function startOfQuarterIso(value = today()) {
  const d = asDate(value);
  return new Date(d.getFullYear(), Math.floor(d.getMonth() / 3) * 3, 1).toISOString().slice(0, 10);
}

function startOfYearIso(value = today()) {
  const d = asDate(value);
  return new Date(d.getFullYear(), 0, 1).toISOString().slice(0, 10);
}

function presetBounds(preset: PresetKey, from: string, to: string) {
  const end = today();
  if (preset === 'mtd') return { from: startOfMonthIso(end), to: end };
  if (preset === 'qtd') return { from: startOfQuarterIso(end), to: end };
  if (preset === 'ytd') return { from: startOfYearIso(end), to: end };
  if (preset === 'all') return { from: '', to: '' };
  return { from, to };
}

function periodLabel(from: string, to: string) {
  return from || to ? `${from || 'start'} to ${to || 'today'}` : 'All periods';
}

function inRange(value: unknown, from: string, to: string) {
  const date = isoDate(value);
  if (!date) return !from && !to;
  return (!from || date >= from) && (!to || date <= to);
}

function money(value: number, locale: Locale) {
  return new Intl.NumberFormat(locale === 'ar' ? 'ar-SA' : 'en-US', { style: 'currency', currency: 'SAR', maximumFractionDigits: 0 }).format(value || 0);
}

function pct(value: number) {
  return `${Number.isFinite(value) ? value.toFixed(1) : '0.0'}%`;
}

function rowsToCsv(items: Array<Record<string, unknown>>) {
  if (!items.length) return '';
  const headers = Object.keys(items[0]);
  const escape = (value: unknown) => {
    const text = String(value ?? '');
    return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
  };
  return [headers.join(','), ...items.map((item) => headers.map((header) => escape(item[header])).join(','))].join('\n');
}

function saveFile(fileName: string, content: string, mime = 'text/plain;charset=utf-8') {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  link.click();
  URL.revokeObjectURL(url);
}

function saleAmounts(state: any, sale: any) {
  const menu = rows<any>(state.menuItems).find((item) => item.id === sale.menuItemId);
  const qty = num(sale.qty, 1);
  const rate = num(menu?.vatRate, 15) / 100;
  const gross = num(menu?.sellingPrice) * qty;
  const net = menu?.priceIncludesVat ? gross / (1 + rate) : gross;
  const vat = menu?.priceIncludesVat ? gross - net : net * rate;
  return { net, gross: net + vat, vat };
}

function invoiceTotal(invoice: any) {
  return rows<any>(invoice.lines).reduce((sum, line) => {
    const gross = num(line.qty) * num(line.unitCost);
    const discount = num(line.discount);
    const net = Math.max(0, gross - discount);
    const vat = net * (num(line.vatRate, 15) / 100);
    return sum + net + vat;
  }, 0);
}

function journalBalanced(journal: any) {
  const debit = rows<any>(journal.lines).reduce((sum, line) => sum + num(line.debit), 0);
  const credit = rows<any>(journal.lines).reduce((sum, line) => sum + num(line.credit), 0);
  return Math.abs(debit - credit) < 0.01;
}

function scopedState(state: any, from: string, to: string) {
  return {
    ...state,
    sales: rows<any>(state.sales).filter((row) => inRange(row.date, from, to)),
    stockMovements: rows<any>(state.stockMovements).filter((row) => inRange(row.date, from, to)),
    purchaseInvoices: rows<any>(state.purchaseInvoices).filter((row) => inRange(row.invoiceDate ?? row.date, from, to)),
    supplierPayments: rows<any>(state.supplierPayments).filter((row) => inRange(row.date, from, to)),
    productions: rows<any>(state.productions).filter((row) => inRange(row.date, from, to)),
    journals: rows<any>(state.journals).filter((row) => inRange(row.date, from, to)),
    inventoryApprovals: rows<any>(state.inventoryApprovals).filter((row) => inRange(row.date, from, to)),
    audits: rows<any>(state.audits).filter((row) => inRange(row.at ?? row.date, from, to)),
  };
}

function analyticsTotals(state: any) {
  const sales = rows<any>(state.sales).filter((sale) => sale.posted !== false);
  const salesAmounts = sales.map((sale) => saleAmounts(state, sale));
  const salesNet = salesAmounts.reduce((sum, item) => sum + item.net, 0);
  const salesGross = salesAmounts.reduce((sum, item) => sum + item.gross, 0);
  const vatOutput = salesAmounts.reduce((sum, item) => sum + item.vat, 0);
  const cogs = rows<any>(state.stockMovements).filter((move) => move.type === 'sales_consumption' || move.type === 'sale_consumption').reduce((sum, move) => sum + num(move.qty) * num(move.unitCost), 0);
  const purchases = rows<any>(state.purchaseInvoices).filter((invoice) => invoice.status === 'posted').reduce((sum, invoice) => sum + invoiceTotal(invoice), 0);
  const payments = rows<any>(state.supplierPayments).filter((payment) => payment.status === 'posted').reduce((sum, payment) => sum + num(payment.amount), 0);
  const stockValue = rows<any>(state.stockMovements).reduce((sum, move) => sum + (move.direction === 'out' ? -1 : 1) * num(move.qty) * num(move.unitCost), 0);
  const cash = rows<any>(state.journals).filter((journal) => journal.status === 'posted').flatMap((journal) => rows<any>(journal.lines)).filter((line) => ['1010', '1020'].includes(String(line.accountCode))).reduce((sum, line) => sum + num(line.debit) - num(line.credit), 0);
  const ar = rows<any>(state.arInvoices).reduce((sum, invoice) => sum + num(invoice.amount) - num(invoice.paidAmount), 0);
  const exceptions = rows<any>(state.inventoryApprovals).filter((row) => ['pending', 'approved'].includes(String(row.status))).length
    + rows<any>(state.purchaseInvoices).filter((row) => row.status === 'draft').length
    + rows<any>(state.productions).filter((row) => row.status === 'draft').length
    + rows<any>(state.journals).filter((row) => row.status === 'draft' || !journalBalanced(row)).length;
  return {
    salesNet,
    salesGross,
    orders: sales.length,
    averageTicket: sales.length ? salesNet / sales.length : 0,
    cogs,
    grossProfit: salesNet - cogs,
    stockValue,
    purchases,
    ap: Math.max(0, purchases - payments),
    ar,
    cash,
    vatOutput,
    productionQty: rows<any>(state.productions).reduce((sum, row) => sum + num(row.actualOutputQty), 0),
    exceptions,
  };
}

function groupBy(rowsIn: any[], labelFor: (row: any) => string, valueFor: (row: any) => number) {
  const map = new Map<string, number>();
  rowsIn.forEach((row) => map.set(labelFor(row), (map.get(labelFor(row)) ?? 0) + valueFor(row)));
  return [...map.entries()].map(([label, value]) => ({ label, value })).sort((a, b) => Math.abs(b.value) - Math.abs(a.value));
}

function branchName(state: any, branchId: string) {
  const branch = rows<any>(state.branches).find((item) => item.id === branchId);
  return branch?.nameEn ?? branch?.code ?? branchId ?? 'Unassigned';
}

function menuName(state: any, menuId: string) {
  const menu = rows<any>(state.menuItems).find((item) => item.id === menuId);
  return menu?.nameEn ?? menu?.code ?? menuId ?? 'Unassigned';
}

function itemName(state: any, itemId: string) {
  const item = rows<any>(state.items).find((entry) => entry.id === itemId);
  return item?.nameEn ?? item?.sku ?? itemId ?? 'Unassigned';
}

function supplierName(state: any, supplierId: string) {
  const supplier = rows<any>(state.suppliers).find((entry) => entry.id === supplierId);
  return supplier?.name ?? supplier?.code ?? supplierId ?? 'Unassigned';
}

function inventoryBalances(state: any) {
  const map = new Map<string, { itemId: string; qty: number; value: number }>();
  rows<any>(state.stockMovements).forEach((move) => {
    const current = map.get(move.itemId) ?? { itemId: move.itemId, qty: 0, value: 0 };
    const sign = move.direction === 'out' ? -1 : 1;
    current.qty += sign * num(move.qty);
    current.value += sign * num(move.qty) * num(move.unitCost);
    map.set(move.itemId, current);
  });
  return [...map.values()];
}

function qualityRows(state: any, totals: ReturnType<typeof analyticsTotals>) {
  const balances = inventoryBalances(state);
  const negativeItems = balances.filter((row) => row.qty < -0.001).length;
  const zeroCostItems = balances.filter((row) => row.qty > 0.001 && Math.abs(row.value) < 0.001).length;
  return [
    { area: 'Master data', status: rows<any>(state.branches).length && rows<any>(state.stores).length && rows<any>(state.items).length ? 'good' : 'warn', detail: `${rows<any>(state.branches).length} branches, ${rows<any>(state.stores).length} stores, ${rows<any>(state.items).length} items`, action: 'Complete branch, store, item, and menu masters before production cutover.' },
    { area: 'Posting integrity', status: rows<any>(state.journals).some((journal) => !journalBalanced(journal)) ? 'bad' : 'good', detail: `${rows<any>(state.journals).filter((journal) => !journalBalanced(journal)).length} unbalanced journals`, action: 'Repair unbalanced journals before relying on finance reports.' },
    { area: 'Inventory health', status: negativeItems ? 'bad' : zeroCostItems ? 'warn' : 'good', detail: `${negativeItems} negative items, ${zeroCostItems} zero-cost balances`, action: 'Post receipts, count variances, or costing corrections.' },
    { area: 'Workflow exceptions', status: totals.exceptions ? 'warn' : 'good', detail: `${totals.exceptions} open exceptions`, action: 'Approve, post, reject, or reverse pending documents.' },
    { area: 'Analytics readiness', status: totals.orders && totals.salesNet ? 'good' : 'warn', detail: `${totals.orders} orders in selected period`, action: 'Load trial or live sales data to activate trend reporting.' },
  ] as Array<{ area: string; status: Tone; detail: string; action: string }>;
}

function Card({ title, icon, action, children }: { title: string; icon?: ReactNode; action?: ReactNode; children: ReactNode }) {
  return <section className="card"><div className="card-header"><div className="card-title">{icon}{title}</div>{action}</div>{children}</section>;
}

function KPI({ item }: { item: KpiRow }) {
  return <div className={`kpi ${item.tone}`}><div className="kpi-icon">{item.icon}</div><span>{item.label}</span><strong>{item.value}</strong><small>{item.hint}</small></div>;
}

function Table({ headers, body }: { headers: ReactNode[]; body: ReactNode[][] }) {
  return <div className="table-wrap"><table><thead><tr>{headers.map((header, index) => <th key={index}>{header}</th>)}</tr></thead><tbody>{body.length ? body.map((row, index) => <tr key={index}>{row.map((cell, cellIndex) => <td key={cellIndex}>{cell}</td>)}</tr>) : <tr><td colSpan={headers.length}>-</td></tr>}</tbody></table></div>;
}

function Pill({ tone, children }: { tone: Tone; children: ReactNode }) {
  return <span className={`pill ${tone}`}>{children}</span>;
}

function BarList({ data, formatter = (value: number) => String(Math.round(value)) }: { data: DataRow[]; formatter?: (value: number) => string }) {
  const visible = data.slice(0, 8);
  const max = Math.max(...visible.map((row) => Math.abs(row.value)), 1);
  return <div className="smart-bars">{visible.length ? visible.map((row) => <div className="mini-bar-row" key={row.label}><div><span>{row.label}</span><strong>{formatter(row.value)}</strong></div><div className="mini-bar-track"><i style={{ width: `${Math.max(4, Math.abs(row.value) / max * 100)}%` }}/></div></div>) : <div className="notice">No rows for this period.</div>}</div>;
}

export default function SmartAnalysisPage({ state, locale }: { state: any; locale: Locale }) {
  const [view, setView] = useState<ViewKey>('overview');
  const [preset, setPreset] = useState<PresetKey>('mtd');
  const [from, setFrom] = useState(startOfMonthIso());
  const [to, setTo] = useState(today());
  const bounds = presetBounds(preset, from, to);
  const periodState = useMemo(() => scopedState(state, bounds.from, bounds.to), [state, bounds.from, bounds.to]);
  const priorBounds = bounds.from && bounds.to ? { from: addDaysIso(bounds.from, -Math.max(1, Math.round((asDate(bounds.to).getTime() - asDate(bounds.from).getTime()) / 86400000) + 1)), to: addDaysIso(bounds.from, -1) } : { from: '', to: '' };
  const compareState = useMemo(() => scopedState(state, priorBounds.from, priorBounds.to), [state, priorBounds.from, priorBounds.to]);
  const totals = useMemo(() => analyticsTotals(periodState), [periodState]);
  const compareTotals = useMemo(() => analyticsTotals(compareState), [compareState]);
  const grossMargin = totals.salesNet ? totals.grossProfit / totals.salesNet * 100 : 0;
  const foodCost = totals.salesNet ? totals.cogs / totals.salesNet * 100 : 0;
  const netSalesDelta = compareTotals.salesNet ? (totals.salesNet - compareTotals.salesNet) / compareTotals.salesNet * 100 : 0;
  const quality = qualityRows(periodState, totals);
  const qualityScore = Math.round(quality.filter((row) => row.status === 'good').length / Math.max(quality.length, 1) * 100);
  const salesByBranch = groupBy(rows<any>(periodState.sales), (sale) => branchName(state, sale.branchId), (sale) => saleAmounts(state, sale).net);
  const salesByMenu = groupBy(rows<any>(periodState.sales), (sale) => menuName(state, sale.menuItemId), (sale) => saleAmounts(state, sale).net);
  const salesByPayment = groupBy(rows<any>(periodState.sales), (sale) => String(sale.paymentMethod || 'unknown'), (sale) => saleAmounts(state, sale).gross);
  const purchaseBySupplier = groupBy(rows<any>(periodState.purchaseInvoices), (invoice) => supplierName(state, invoice.supplierId), invoiceTotal);
  const inventoryByItem = inventoryBalances(state).map((row) => ({ label: itemName(state, row.itemId), value: row.value, hint: `${row.qty.toLocaleString()} on hand` })).sort((a, b) => Math.abs(b.value) - Math.abs(a.value));
  const productionRows = groupBy(rows<any>(periodState.productions), (run) => itemName(state, run.outputItemId), (run) => num(run.actualOutputQty));
  const kpis: KpiRow[] = [
    { key: 'netSales', label: L(locale, 'Net sales', 'Net sales'), value: money(totals.salesNet, locale), hint: `${pct(netSalesDelta)} vs previous period`, tone: totals.salesNet ? 'good' : 'neutral', icon: <BadgeDollarSign/>, data: salesByBranch },
    { key: 'orders', label: L(locale, 'Orders', 'Orders'), value: `${totals.orders}`, hint: `${money(totals.averageTicket, locale)} average ticket`, tone: totals.orders ? 'info' : 'neutral', icon: <ReceiptText/>, data: salesByMenu },
    { key: 'grossMargin', label: L(locale, 'Gross margin', 'Gross margin'), value: pct(grossMargin), hint: `${money(totals.grossProfit, locale)} gross profit`, tone: grossMargin >= 50 ? 'good' : grossMargin >= 30 ? 'warn' : 'bad', icon: <PieChart/>, data: [{ label: 'Gross profit', value: totals.grossProfit }, { label: 'COGS', value: totals.cogs }] },
    { key: 'foodCost', label: L(locale, 'Food cost', 'Food cost'), value: pct(foodCost), hint: `${money(totals.cogs, locale)} consumed`, tone: foodCost <= 35 ? 'good' : foodCost <= 45 ? 'warn' : 'bad', icon: <ChefHat/>, data: inventoryByItem },
    { key: 'inventory', label: L(locale, 'Inventory value', 'Inventory value'), value: money(totals.stockValue, locale), hint: `${inventoryByItem.length} stocked items`, tone: totals.stockValue >= 0 ? 'info' : 'bad', icon: <Archive/>, data: inventoryByItem },
    { key: 'cash', label: L(locale, 'Cash movement', 'Cash movement'), value: money(totals.cash, locale), hint: `${money(totals.ap, locale)} AP exposure`, tone: totals.cash >= 0 ? 'good' : 'bad', icon: <Banknote/>, data: purchaseBySupplier },
    { key: 'production', label: L(locale, 'Production output', 'Production output'), value: totals.productionQty.toLocaleString(), hint: `${productionRows.length} output items`, tone: 'neutral', icon: <Factory/>, data: productionRows },
    { key: 'quality', label: L(locale, 'Quality score', 'Quality score'), value: `${qualityScore}%`, hint: `${totals.exceptions} open exceptions`, tone: qualityScore >= 80 ? 'good' : qualityScore >= 60 ? 'warn' : 'bad', icon: <ShieldCheck/>, data: quality.map((row) => ({ label: row.area, value: row.status === 'good' ? 1 : 0 })) },
  ];
  const exceptionRows = [
    ...rows<any>(periodState.inventoryApprovals).filter((row) => ['pending', 'approved'].includes(String(row.status))).map((row) => ['Inventory approval', row.ref, row.status, row.reason ?? row.note ?? '-']),
    ...rows<any>(periodState.journals).filter((row) => row.status === 'draft' || !journalBalanced(row)).map((row) => ['Journal', row.ref, row.status, row.description ?? '-']),
    ...rows<any>(periodState.purchaseInvoices).filter((row) => row.status === 'draft').map((row) => ['Purchase invoice', row.ref, row.status, row.invoiceNo ?? '-']),
  ];
  const exportKpis = () => saveFile(`smart-analysis-${today()}.csv`, rowsToCsv(kpis.map((row) => ({ metric: row.label, value: row.value, hint: row.hint, tone: row.tone, period: periodLabel(bounds.from, bounds.to) }))), 'text/csv;charset=utf-8');
  const exportQuality = () => saveFile(`smart-quality-${today()}.csv`, rowsToCsv(quality), 'text/csv;charset=utf-8');

  return <div className="page-grid smart-analysis-page">
    <section className="executive-hero smart-hero">
      <div>
        <span className="hero-kicker"><BrainCircuit size={18}/>v368 route-owned analytics</span>
        <h2>{L(locale, 'Smart Analysis Studio', 'Smart Analysis Studio')}</h2>
        <p>{L(locale, 'Period-aware operating intelligence for sales, inventory, finance, production, and data quality.', 'Period-aware operating intelligence.')}</p>
      </div>
      <div className="button-row">
        <button onClick={exportKpis}><Download size={16}/>Export KPIs</button>
        <button onClick={exportQuality}><FileSpreadsheet size={16}/>Export Quality</button>
      </div>
    </section>

    <Card title={L(locale, 'Analysis controls', 'Analysis controls')} icon={<CalendarDays/>}>
      <div className="form-grid">
        <label className="field"><span>Period preset</span><select value={preset} onChange={(event) => setPreset(event.target.value as PresetKey)}><option value="mtd">Month to date</option><option value="qtd">Quarter to date</option><option value="ytd">Year to date</option><option value="all">All periods</option><option value="custom">Custom</option></select></label>
        <label className="field"><span>From</span><input type="date" value={bounds.from || from} onChange={(event) => { setPreset('custom'); setFrom(event.target.value); }}/></label>
        <label className="field"><span>To</span><input type="date" value={bounds.to || to} onChange={(event) => { setPreset('custom'); setTo(event.target.value); }}/></label>
        <label className="field"><span>Visible workspace</span><select value={view} onChange={(event) => setView(event.target.value as ViewKey)}><option value="overview">Overview</option><option value="sales">Sales</option><option value="inventory">Inventory</option><option value="finance">Finance</option><option value="quality">Quality</option><option value="exports">Exports</option></select></label>
      </div>
      <div className="notice">Current period: {periodLabel(bounds.from, bounds.to)}. Comparable period: {periodLabel(priorBounds.from, priorBounds.to)}.</div>
    </Card>

    <div className="tab-row">
      {[
        ['overview', <LayoutDashboard size={16}/>, 'Overview'],
        ['sales', <BarChart3 size={16}/>, 'Sales'],
        ['inventory', <PackageCheck size={16}/>, 'Inventory'],
        ['finance', <Landmark size={16}/>, 'Finance'],
        ['quality', <ShieldCheck size={16}/>, 'Quality'],
        ['exports', <Download size={16}/>, 'Exports'],
      ].map(([key, icon, label]) => <button key={String(key)} className={view === key ? 'active-tab' : ''} onClick={() => setView(key as ViewKey)}>{icon}{label}</button>)}
    </div>

    {view === 'overview' && <div className="page-grid">
      <div className="kpi-grid">{kpis.map((item) => <KPI key={item.key} item={item}/>)}</div>
      <div className="two-col">
        <Card title="Branch sales ranking" icon={<Store/>}><BarList data={salesByBranch} formatter={(value) => money(value, locale)}/></Card>
        <Card title="Top inventory value" icon={<Archive/>}><BarList data={inventoryByItem} formatter={(value) => money(value, locale)}/></Card>
      </div>
    </div>}

    {view === 'sales' && <div className="page-grid two">
      <Card title="Payment method mix" icon={<CreditCard/>}><BarList data={salesByPayment} formatter={(value) => money(value, locale)}/></Card>
      <Card title="Menu contribution" icon={<ChefHat/>}><BarList data={salesByMenu} formatter={(value) => money(value, locale)}/></Card>
      <Card title="Sales table" icon={<Search/>}><Table headers={['Ref', 'Date', 'Branch', 'Menu item', 'Qty', 'Net']} body={rows<any>(periodState.sales).slice(0, 25).map((sale) => [sale.ref, sale.date, branchName(state, sale.branchId), menuName(state, sale.menuItemId), String(num(sale.qty)), money(saleAmounts(state, sale).net, locale)])}/></Card>
    </div>}

    {view === 'inventory' && <div className="page-grid two">
      <Card title="Inventory valuation" icon={<Archive/>}><BarList data={inventoryByItem} formatter={(value) => money(value, locale)}/></Card>
      <Card title="Production output" icon={<Factory/>}><BarList data={productionRows} formatter={(value) => value.toLocaleString()}/></Card>
      <Card title="Inventory balance table" icon={<PackageCheck/>}><Table headers={['Item', 'Quantity', 'Value', 'Status']} body={inventoryBalances(state).slice(0, 30).map((row) => [itemName(state, row.itemId), row.qty.toLocaleString(), money(row.value, locale), <Pill tone={row.qty < 0 ? 'bad' : row.qty > 0 && Math.abs(row.value) < 0.001 ? 'warn' : 'good'}>{row.qty < 0 ? 'negative' : row.qty > 0 && Math.abs(row.value) < 0.001 ? 'zero cost' : 'ok'}</Pill>])}/></Card>
    </div>}

    {view === 'finance' && <div className="page-grid two">
      <Card title="Finance pulse" icon={<Wallet/>}><Table headers={['Metric', 'Value']} body={[['Net sales', money(totals.salesNet, locale)], ['Gross sales', money(totals.salesGross, locale)], ['COGS', money(totals.cogs, locale)], ['Gross profit', money(totals.grossProfit, locale)], ['Cash movement', money(totals.cash, locale)], ['AP exposure', money(totals.ap, locale)], ['AR exposure', money(totals.ar, locale)], ['Output VAT', money(totals.vatOutput, locale)]]}/></Card>
      <Card title="Supplier exposure" icon={<ShoppingCart/>}><BarList data={purchaseBySupplier} formatter={(value) => money(value, locale)}/></Card>
      <Card title="Exception ledger" icon={<ClipboardCheck/>}><Table headers={['Area', 'Reference', 'Status', 'Detail']} body={exceptionRows.slice(0, 30)}/></Card>
    </div>}

    {view === 'quality' && <div className="page-grid">
      <div className="kpi-grid"><KPI item={{ key: 'score', label: 'Quality score', value: `${qualityScore}%`, hint: `${quality.filter((row) => row.status !== 'good').length} rows need attention`, tone: qualityScore >= 80 ? 'good' : qualityScore >= 60 ? 'warn' : 'bad', icon: <Sparkles/>, data: [] }}/><KPI item={{ key: 'exceptions', label: 'Open exceptions', value: `${totals.exceptions}`, hint: 'Drafts, approvals, and unbalanced entries', tone: totals.exceptions ? 'warn' : 'good', icon: <ShieldCheck/>, data: [] }}/></div>
      <Card title="Data quality gates" icon={<ShieldCheck/>}><Table headers={['Area', 'Status', 'Detail', 'Action']} body={quality.map((row) => [row.area, <Pill tone={row.status}>{row.status}</Pill>, row.detail, row.action])}/></Card>
    </div>}

    {view === 'exports' && <div className="page-grid two">
      <Card title="Board export pack" icon={<FileSpreadsheet/>}>
        <div className="button-row"><button onClick={exportKpis}><Download size={16}/>KPI CSV</button><button onClick={exportQuality}><Download size={16}/>Quality CSV</button><button onClick={() => saveFile(`smart-analysis-exceptions-${today()}.csv`, rowsToCsv(exceptionRows.map((row) => ({ area: row[0], ref: row[1], status: row[2], detail: row[3] }))), 'text/csv;charset=utf-8')}><Download size={16}/>Exceptions CSV</button></div>
        <div className="notice">Exports are generated in the browser from the current local ERP state and selected period.</div>
      </Card>
      <Card title="Registered report pack" icon={<BrainCircuit/>}><Table headers={['Pack', 'Includes', 'Period']} body={[['Executive', 'Sales, gross margin, cash, quality', periodLabel(bounds.from, bounds.to)], ['Cost control', 'COGS, food cost, inventory, production', periodLabel(bounds.from, bounds.to)], ['Finance pulse', 'AP, AR, cash, VAT, exceptions', periodLabel(bounds.from, bounds.to)]]}/></Card>
    </div>}
  </div>;
}
