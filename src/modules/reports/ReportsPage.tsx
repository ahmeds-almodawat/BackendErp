import { lazy, Suspense, useMemo, useState, type ReactNode } from 'react';
import {
  Archive,
  BadgeDollarSign,
  BarChart3,
  BookOpen,
  Calculator,
  ChefHat,
  ClipboardCheck,
  CreditCard,
  Download,
  Landmark,
  ListChecks,
  PieChart,
  ShieldCheck,
  Store,
  Wallet,
} from 'lucide-react';

const ReportingTruthPanel = lazy(() => import('../analytics/reportingTruth/ReportingTruthPanel'));

type Locale = 'en' | 'ar';
type ReportTab = 'executive' | 'finance' | 'inventory' | 'suppliers' | 'menu' | 'exceptions';
type PeriodPreset = 'all' | 'today' | 'month' | 'quarter' | 'year' | 'custom';

const L = (_locale: Locale, en: string, _ar: string) => en;

function arr<T = any>(value: unknown): T[] {
  return Array.isArray(value) ? value as T[] : [];
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

function startOfMonthIso(dateValue = today()) {
  const date = new Date(`${dateValue}T00:00:00`);
  return new Date(date.getFullYear(), date.getMonth(), 1).toISOString().slice(0, 10);
}

function startOfQuarterIso(dateValue = today()) {
  const date = new Date(`${dateValue}T00:00:00`);
  const quarterStart = Math.floor(date.getMonth() / 3) * 3;
  return new Date(date.getFullYear(), quarterStart, 1).toISOString().slice(0, 10);
}

function startOfYearIso(dateValue = today()) {
  const date = new Date(`${dateValue}T00:00:00`);
  return new Date(date.getFullYear(), 0, 1).toISOString().slice(0, 10);
}

function dateInRange(dateValue?: string, from?: string, to?: string) {
  const date = String(dateValue || '').slice(0, 10);
  if (!date) return false;
  if (from && date < from) return false;
  if (to && date > to) return false;
  return true;
}

function periodLabel(from: string, to: string, locale: Locale) {
  if (!from && !to) return L(locale, 'All periods', 'All periods');
  return `${from || '...'} -> ${to || '...'}`;
}

function money(value: number, locale: Locale) {
  return new Intl.NumberFormat(locale === 'ar' ? 'ar-SA' : 'en-US', {
    style: 'currency',
    currency: 'SAR',
    maximumFractionDigits: 2,
  }).format(Number.isFinite(value) ? value : 0);
}

function qty(value: number, unit = '') {
  return `${Number(value || 0).toLocaleString(undefined, { maximumFractionDigits: 3 })}${unit ? ` ${unit}` : ''}`;
}

function rowsToCsv(rows: Array<Record<string, unknown>>) {
  if (!rows.length) return '';
  const headers = Array.from(rows.reduce<Set<string>>((set, row) => {
    Object.keys(row).forEach((key) => set.add(key));
    return set;
  }, new Set<string>()));
  const escape = (value: unknown) => {
    const text = String(value ?? '');
    return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
  };
  return [headers.join(','), ...rows.map((row) => headers.map((header) => escape(row[header])).join(','))].join('\n');
}

function saveFile(fileName: string, content: string, mime = 'text/csv;charset=utf-8') {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  link.click();
  URL.revokeObjectURL(url);
}

function calculateSalesAmounts(menu: any, quantity: number) {
  const unitPrice = Number(menu?.sellingPrice || 0);
  const vatRate = Number(menu?.vatRate || 0);
  const gross = unitPrice * Number(quantity || 0);
  if (menu?.priceIncludesVat ?? true) {
    const netSales = vatRate ? gross / (1 + vatRate / 100) : gross;
    return { netSales, vatAmount: gross - netSales, grossSales: gross };
  }
  const netSales = gross;
  const vatAmount = netSales * (vatRate / 100);
  return { netSales, vatAmount, grossSales: netSales + vatAmount };
}

function invoiceTotals(invoice: any) {
  return arr(invoice?.lines).reduce((sum, line: any) => {
    const net = Number(line?.qty || 0) * Number(line?.unitCost || 0) - Number(line?.discount || 0);
    const vat = net * (Number(line?.vatRate || 0) / 100);
    return { net: sum.net + net, vat: sum.vat + vat, total: sum.total + net + vat };
  }, { net: 0, vat: 0, total: 0 });
}

function journalBalance(journal: any) {
  const debit = arr(journal?.lines).reduce((sum, line: any) => sum + Number(line?.debit || 0), 0);
  const credit = arr(journal?.lines).reduce((sum, line: any) => sum + Number(line?.credit || 0), 0);
  return { debit, credit, diff: debit - credit, balanced: Math.abs(debit - credit) < 0.01 };
}

function averageCost(state: any, itemId: string, movements = arr(state?.stockMovements)) {
  const inbound = movements.filter((movement: any) => movement?.itemId === itemId && movement?.direction === 'in' && Number(movement?.unitCost || 0) > 0 && Number(movement?.qty || 0) > 0);
  const totalQty = inbound.reduce((sum: number, movement: any) => sum + Number(movement?.qty || 0), 0);
  const totalValue = inbound.reduce((sum: number, movement: any) => sum + Number(movement?.qty || 0) * Number(movement?.unitCost || 0), 0);
  if (totalQty > 0) return totalValue / totalQty;
  return Number(arr(state?.items).find((item: any) => item?.id === itemId)?.standardCost || 0);
}

function accountBalances(state: any) {
  const posted = arr(state?.journals).filter((journal: any) => journal?.status === 'posted');
  return arr(state?.chartAccounts).map((account: any) => {
    const lines = posted.flatMap((journal: any) => arr(journal?.lines)).filter((line: any) => line?.accountCode === account?.code);
    const debit = lines.reduce((sum: number, line: any) => sum + Number(line?.debit || 0), 0);
    const credit = lines.reduce((sum: number, line: any) => sum + Number(line?.credit || 0), 0);
    const naturalDebit = ['asset', 'expense', 'cogs', 'other_expense'].includes(String(account?.type));
    return { account, debit, credit, balance: naturalDebit ? debit - credit : credit - debit };
  });
}

function totalsFromState(state: any) {
  const balances = accountBalances(state);
  const salesNet = balances.filter((row) => row.account?.type === 'revenue').reduce((sum, row) => sum + row.balance, 0);
  const cogs = balances.filter((row) => row.account?.type === 'cogs').reduce((sum, row) => sum + row.balance, 0);
  const expenses = balances.filter((row) => ['expense', 'other_expense'].includes(String(row.account?.type))).reduce((sum, row) => sum + row.balance, 0);
  const assets = balances.filter((row) => row.account?.type === 'asset').reduce((sum, row) => sum + row.balance, 0);
  const liabilities = balances.filter((row) => row.account?.type === 'liability').reduce((sum, row) => sum + row.balance, 0);
  const equity = balances.filter((row) => row.account?.type === 'equity').reduce((sum, row) => sum + row.balance, 0);
  const stockValue = arr(state?.stores).flatMap((store: any) => arr(state?.items).map((item: any) => {
    const onHand = arr(state?.stockMovements).filter((movement: any) => movement?.storeId === store?.id && movement?.itemId === item?.id).reduce((sum: number, movement: any) => sum + (movement?.direction === 'in' ? 1 : -1) * Number(movement?.qty || 0), 0);
    return Math.max(0, onHand) * averageCost(state, item?.id);
  })).reduce((sum: number, value: number) => sum + value, 0);
  return { salesNet, cogs, grossProfit: salesNet - cogs, stockValue, assets, liabilities, equity, expenses, netIncome: salesNet - cogs - expenses };
}

function Card({ title, children, icon, action }: { title: string; children: ReactNode; icon?: ReactNode; action?: ReactNode }) {
  return <section className="card"><div className="card-header"><div className="card-title">{icon}{title}</div>{action}</div>{children}</section>;
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return <label className="field"><span>{label}</span>{children}</label>;
}

function KPI({ label, value, hint, icon }: { label: string; value: string; hint: string; icon: ReactNode }) {
  return <div className="kpi"><div className="kpi-icon">{icon}</div><div><span>{label}</span><strong>{value}</strong><small>{hint}</small></div></div>;
}

function Table({ headers, rows }: { headers: ReactNode[]; rows: ReactNode[][] }) {
  return <div className="table-wrap"><table><thead><tr>{headers.map((header, index) => <th key={index}>{header}</th>)}</tr></thead><tbody>{rows.length ? rows.map((row, index) => <tr key={index}>{row.map((cell, cellIndex) => <td key={cellIndex}>{cell}</td>)}</tr>) : <tr><td colSpan={headers.length}>-</td></tr>}</tbody></table></div>;
}

function Pill({ children, tone = 'neutral' }: { children: ReactNode; tone?: 'neutral' | 'good' | 'warn' | 'bad' | 'info' }) {
  return <span className={`pill ${tone}`}>{children}</span>;
}

function FinancialStatementSummary({ state, totals, locale }: { state: any; totals: any; locale: Locale }) {
  const balances = accountBalances(state).filter((row) => Math.abs(row.balance) > 0.01);
  return <div className="page-grid">
    <div className="kpi-grid">
      <KPI label={L(locale, 'Net Sales', 'Net Sales')} value={money(totals.salesNet, locale)} hint={L(locale, 'Posted revenue accounts', 'Posted revenue accounts')} icon={<BadgeDollarSign/>}/>
      <KPI label={L(locale, 'COGS', 'COGS')} value={money(totals.cogs, locale)} hint={L(locale, 'Posted cost accounts', 'Posted cost accounts')} icon={<Archive/>}/>
      <KPI label={L(locale, 'Net Income', 'Net Income')} value={money(totals.netIncome, locale)} hint={L(locale, 'Sales less costs and expenses', 'Sales less costs and expenses')} icon={<PieChart/>}/>
      <KPI label={L(locale, 'Balance Sheet Check', 'Balance Sheet Check')} value={money(totals.assets - totals.liabilities - totals.equity, locale)} hint={L(locale, 'Assets - liabilities - equity', 'Assets - liabilities - equity')} icon={<Calculator/>}/>
    </div>
    <Card title={L(locale, 'Account balance detail', 'Account balance detail')} icon={<BookOpen/>}>
      <Table headers={[L(locale, 'Code', 'Code'), L(locale, 'Account', 'Account'), L(locale, 'Type', 'Type'), L(locale, 'Debit', 'Debit'), L(locale, 'Credit', 'Credit'), L(locale, 'Balance', 'Balance')]} rows={balances.map((row) => [row.account?.code, row.account?.nameEn || row.account?.nameAr, row.account?.type, money(row.debit, locale), money(row.credit, locale), money(row.balance, locale)])}/>
    </Card>
  </div>;
}

export default function ReportsPage({ state, totals, locale }: { state: any; totals: any; locale: Locale }) {
  const [tab, setTab] = useState<ReportTab>('executive');
  const [periodPreset, setPeriodPreset] = useState<PeriodPreset>('all');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState(today());

  const applyPreset = (preset: PeriodPreset) => {
    setPeriodPreset(preset);
    if (preset === 'all') { setFromDate(''); setToDate(''); return; }
    if (preset === 'today') { const date = today(); setFromDate(date); setToDate(date); return; }
    if (preset === 'month') { setFromDate(startOfMonthIso()); setToDate(today()); return; }
    if (preset === 'quarter') { setFromDate(startOfQuarterIso()); setToDate(today()); return; }
    if (preset === 'year') { setFromDate(startOfYearIso()); setToDate(today()); }
  };

  const report = useMemo(() => {
    const inPeriod = (dateValue?: string) => periodPreset === 'all' ? true : dateInRange(dateValue, fromDate, toDate);
    const asOfEnd = (dateValue?: string) => !toDate || !dateValue ? true : String(dateValue).slice(0, 10) <= toDate;
    const branches = arr(state?.branches);
    const stores = arr(state?.stores);
    const suppliers = arr(state?.suppliers);
    const items = arr(state?.items);
    const menuItems = arr(state?.menuItems);
    const recipeLines = arr(state?.recipeLines);
    const postedInvoices = arr(state?.purchaseInvoices).filter((invoice: any) => invoice?.status === 'posted' && inPeriod(invoice?.invoiceDate || invoice?.date));
    const postedPayments = arr(state?.supplierPayments).filter((payment: any) => payment?.status === 'posted' && inPeriod(payment?.date));
    const postedSales = arr(state?.sales).filter((sale: any) => sale?.posted && inPeriod(sale?.date));
    const postedJournals = arr(state?.journals).filter((journal: any) => journal?.status === 'posted' && inPeriod(journal?.date));
    const stockMovementsAsOf = arr(state?.stockMovements).filter((movement: any) => asOfEnd(movement?.date));
    const periodStockMovements = arr(state?.stockMovements).filter((movement: any) => inPeriod(movement?.date));
    const reportState = { ...state, journals: postedJournals, sales: postedSales, stockMovements: stockMovementsAsOf, purchaseInvoices: postedInvoices, supplierPayments: postedPayments };
    const reportTotals = totalsFromState(reportState);

    const supplierRows = suppliers.map((supplier: any) => {
      const invoices = postedInvoices.filter((invoice: any) => invoice?.supplierId === supplier?.id);
      const spend = invoices.reduce((sum: number, invoice: any) => sum + invoiceTotals(invoice).total, 0);
      const paid = postedPayments.filter((payment: any) => payment?.supplierId === supplier?.id).reduce((sum: number, payment: any) => sum + Number(payment?.amount || 0), 0);
      return { supplier, invoices: invoices.length, spend, paid, periodNet: spend - paid };
    }).filter((row: any) => row.invoices || row.paid || row.spend);

    const inventoryRows = stores.flatMap((store: any) => items.map((item: any) => {
      const itemMovementsAsOf = stockMovementsAsOf.filter((movement: any) => movement?.storeId === store?.id && movement?.itemId === item?.id);
      const itemPeriodMovements = periodStockMovements.filter((movement: any) => movement?.storeId === store?.id && movement?.itemId === item?.id);
      const onHand = itemMovementsAsOf.reduce((sum: number, movement: any) => sum + (movement?.direction === 'in' ? 1 : -1) * Number(movement?.qty || 0), 0);
      const periodIn = itemPeriodMovements.filter((movement: any) => movement?.direction === 'in').reduce((sum: number, movement: any) => sum + Number(movement?.qty || 0), 0);
      const periodOut = itemPeriodMovements.filter((movement: any) => movement?.direction === 'out').reduce((sum: number, movement: any) => sum + Number(movement?.qty || 0), 0);
      const cost = averageCost(state, item?.id, stockMovementsAsOf);
      return { store, item, onHand, periodIn, periodOut, cost, value: onHand * cost };
    })).filter((row: any) => Math.abs(row.onHand) > 0.0001 || row.cost > 0 || row.periodIn > 0 || row.periodOut > 0);

    const menuRows = menuItems.map((menu: any) => {
      const saleQty = postedSales.filter((sale: any) => sale?.menuItemId === menu?.id).reduce((sum: number, sale: any) => sum + Number(sale?.qty || 0), 0);
      const recipe = recipeLines.filter((line: any) => line?.menuItemId === menu?.id);
      const cost = recipe.reduce((sum: number, line: any) => sum + Number(line?.qty || 0) * (1 + Number(line?.wastagePct || 0) / 100) * averageCost(state, line?.itemId, stockMovementsAsOf), 0);
      const amounts = calculateSalesAmounts(menu, Math.max(saleQty, 1));
      const netUnit = amounts.netSales / Math.max(saleQty, 1);
      return { menu, saleQty, cost, netUnit, margin: netUnit - cost, foodCostPct: netUnit ? (cost / netUnit) * 100 : 0, recipeLines: recipe.length };
    });

    const branchRows = branches.map((branch: any) => {
      const branchJournalLines = postedJournals.flatMap((journal: any) => arr(journal?.lines).map((line: any) => ({ journal, line }))).filter(({ line }: any) => line?.branchId === branch?.id);
      const revenue = branchJournalLines.filter(({ line }: any) => String(line?.accountCode || '').startsWith('4')).reduce((sum: number, { line }: any) => sum + Number(line?.credit || 0) - Number(line?.debit || 0), 0);
      const cogs = branchJournalLines.filter(({ line }: any) => String(line?.accountCode || '').startsWith('5')).reduce((sum: number, { line }: any) => sum + Number(line?.debit || 0) - Number(line?.credit || 0), 0);
      const expenses = branchJournalLines.filter(({ line }: any) => String(line?.accountCode || '').startsWith('6')).reduce((sum: number, { line }: any) => sum + Number(line?.debit || 0) - Number(line?.credit || 0), 0);
      return { branch, revenue, cogs, expenses, profit: revenue - cogs - expenses };
    });

    const exceptions = [
      ...inventoryRows.filter((row: any) => row.onHand > 0 && row.cost <= 0).map((row: any) => ({ area: 'Inventory', severity: 'warning', issue: `${row.item?.sku} has stock with zero cost`, action: 'Post purchase invoice cost or opening valuation.' })),
      ...inventoryRows.filter((row: any) => row.onHand < 0).map((row: any) => ({ area: 'Inventory', severity: 'critical', issue: `${row.item?.sku} has negative stock`, action: 'Investigate stock issue, transfer, or production posting.' })),
      ...menuRows.filter((row: any) => row.recipeLines === 0).map((row: any) => ({ area: 'Recipes', severity: 'warning', issue: `${row.menu?.nameEn || row.menu?.nameAr} has no recipe lines`, action: 'Open Setup -> Recipe Builder.' })),
      ...postedJournals.filter((journal: any) => !journalBalance(journal).balanced).map((journal: any) => ({ area: 'Finance', severity: 'critical', issue: `${journal.ref} is unbalanced`, action: 'Review Journal Register.' })),
    ];

    return { branchRows, exceptions, inventoryRows, menuRows, postedJournals, postedSales, reportState, reportTotals, supplierRows };
  }, [fromDate, periodPreset, state, toDate]);

  const asOfLabel = toDate || L(locale, 'latest available date', 'latest available date');
  const selectedPeriod = periodLabel(fromDate, toDate, locale);
  const safeMoney = (value: number) => money(Number.isFinite(value) ? value : 0, locale);
  const appTotals = totals ?? totalsFromState(state);

  const exportCurrent = () => {
    const rows = tab === 'inventory'
      ? report.inventoryRows.map((row: any) => ({ period: selectedPeriod, asOf: asOfLabel, store: row.store?.nameEn || row.store?.nameAr, sku: row.item?.sku, item: row.item?.nameEn || row.item?.nameAr, periodIn: row.periodIn, periodOut: row.periodOut, onHandAsOf: row.onHand, averageCost: row.cost, value: row.value }))
      : tab === 'suppliers'
        ? report.supplierRows.map((row: any) => ({ period: selectedPeriod, supplier: row.supplier?.name, invoices: row.invoices, spend: row.spend, paid: row.paid, periodNet: row.periodNet }))
        : tab === 'menu'
          ? report.menuRows.map((row: any) => ({ period: selectedPeriod, menu: row.menu?.nameEn || row.menu?.nameAr, recipeLines: row.recipeLines, soldQty: row.saleQty, recipeCost: row.cost, netSellingPrice: row.netUnit, margin: row.margin, foodCostPct: row.foodCostPct }))
          : tab === 'exceptions'
            ? report.exceptions.map((row: any) => ({ period: selectedPeriod, ...row }))
            : tab === 'finance'
              ? report.postedJournals.map((journal: any) => ({ period: selectedPeriod, date: journal.date, ref: journal.ref, source: journal.source, description: journal.description, debit: journalBalance(journal).debit, credit: journalBalance(journal).credit, balanced: journalBalance(journal).balanced }))
              : [{ period: selectedPeriod, netSales: report.reportTotals.salesNet || appTotals.salesNet || 0, cogs: report.reportTotals.cogs || appTotals.cogs || 0, grossProfit: report.reportTotals.grossProfit || appTotals.grossProfit || 0, inventoryValueAsOf: report.reportTotals.stockValue || appTotals.stockValue || 0, netIncome: report.reportTotals.netIncome || appTotals.netIncome || 0 }];
    saveFile(`report-${tab}-v368-${fromDate || 'all'}-${toDate || 'all'}.csv`, `\ufeff${rowsToCsv(rows)}`, 'text/csv;charset=utf-8');
  };

  const tabs = [
    { key: 'executive' as const, label: L(locale, 'Executive', 'Executive'), icon: <BarChart3 size={16}/> },
    { key: 'finance' as const, label: L(locale, 'Finance Pack', 'Finance Pack'), icon: <Landmark size={16}/> },
    { key: 'inventory' as const, label: L(locale, 'Inventory', 'Inventory'), icon: <Archive size={16}/> },
    { key: 'suppliers' as const, label: L(locale, 'Suppliers', 'Suppliers'), icon: <Wallet size={16}/> },
    { key: 'menu' as const, label: L(locale, 'Menu Engineering', 'Menu Engineering'), icon: <ChefHat size={16}/> },
    { key: 'exceptions' as const, label: L(locale, 'Exceptions', 'Exceptions'), icon: <ShieldCheck size={16}/> },
  ];

  const truthPeriod = {
    start: fromDate || startOfYearIso(),
    end: toDate || today(),
    label: selectedPeriod,
  };

  return <div className="page-grid report-workspace">
    <Card title={L(locale, 'Reports Center - period aware', 'Reports Center - period aware')} icon={<BarChart3/>} action={<button onClick={exportCurrent}><Download size={16}/>{L(locale, 'Export current period', 'Export current period')}</button>}>
      <div className="notice">{L(locale, 'Reports are now route-owned outside AppShell. Finance, supplier spend, sales, COGS, journals, and inventory valuation use the selected period/as-of date.', 'Reports are now route-owned outside AppShell.')}</div>
      <div className="form-grid">
        <Field label={L(locale, 'Period preset', 'Period preset')}><select value={periodPreset} onChange={(event) => applyPreset(event.target.value as PeriodPreset)}><option value="all">All periods</option><option value="today">Today</option><option value="month">Current month</option><option value="quarter">Current quarter</option><option value="year">Current year</option><option value="custom">Custom range</option></select></Field>
        <Field label={L(locale, 'From date', 'From date')}><input type="date" value={fromDate} disabled={periodPreset !== 'custom'} onChange={(event) => { setPeriodPreset('custom'); setFromDate(event.target.value); }}/></Field>
        <Field label={L(locale, 'To date / as of', 'To date / as of')}><input type="date" value={toDate} disabled={periodPreset !== 'custom'} onChange={(event) => { setPeriodPreset('custom'); setToDate(event.target.value); }}/></Field>
      </div>
      {fromDate && toDate && fromDate > toDate && <div className="notice warning">{L(locale, 'From date is after To date. Reports will return empty or unexpected results.', 'From date is after To date.')}</div>}
      <div className="kpi-grid">
        <KPI label={L(locale, 'Selected period', 'Selected period')} value={selectedPeriod} hint={L(locale, 'Applies to journals and sales', 'Applies to journals and sales')} icon={<ClipboardCheck/>}/>
        <KPI label={L(locale, 'Inventory as of', 'Inventory as of')} value={asOfLabel} hint={L(locale, 'Balances use movements up to this date', 'Balances use movements up to this date')} icon={<Archive/>}/>
        <KPI label={L(locale, 'Period journals', 'Period journals')} value={`${report.postedJournals.length}`} hint={L(locale, 'Posted entries only', 'Posted entries only')} icon={<BookOpen/>}/>
        <KPI label={L(locale, 'Period sales docs', 'Period sales docs')} value={`${report.postedSales.length}`} hint={L(locale, 'Posted sales only', 'Posted sales only')} icon={<CreditCard/>}/>
      </div>
      <div className="finance-tab-grid">{tabs.map((item) => <button key={item.key} className={tab === item.key ? 'active-tab' : ''} onClick={() => setTab(item.key)}>{item.icon}{item.label}</button>)}</div>
    </Card>

    {tab === 'executive' && <div className="page-grid">
      <div className="kpi-grid">
        <KPI label={L(locale, 'Net Sales', 'Net Sales')} value={safeMoney(report.reportTotals.salesNet || appTotals.salesNet || 0)} hint={L(locale, 'Selected period only', 'Selected period only')} icon={<BadgeDollarSign/>}/>
        <KPI label={L(locale, 'Gross Profit', 'Gross Profit')} value={safeMoney(report.reportTotals.grossProfit || appTotals.grossProfit || 0)} hint={L(locale, 'Net sales less COGS', 'Net sales less COGS')} icon={<PieChart/>}/>
        <KPI label={L(locale, 'Inventory Value', 'Inventory Value')} value={safeMoney(report.reportTotals.stockValue || appTotals.stockValue || 0)} hint={L(locale, 'As-of selected end date', 'As-of selected end date')} icon={<Archive/>}/>
        <KPI label={L(locale, 'Exceptions', 'Exceptions')} value={`${report.exceptions.length}`} hint={L(locale, 'Period/as-of report alerts', 'Period/as-of report alerts')} icon={<ShieldCheck/>}/>
      </div>
      <div className="two-col">
        <Card title={L(locale, 'Branch P&L by selected period', 'Branch P&L by selected period')} icon={<Store/>}>
          <Table headers={['Branch', 'Revenue', 'COGS', 'Expenses', 'Profit']} rows={report.branchRows.map((row: any) => [row.branch?.nameEn || row.branch?.nameAr, safeMoney(row.revenue), safeMoney(row.cogs), safeMoney(row.expenses), safeMoney(row.profit)])}/>
        </Card>
        <Card title={L(locale, 'Report health', 'Report health')} icon={<ListChecks/>}>
          <Table headers={['Dataset', 'Rows']} rows={[['Posted journals in period', `${report.postedJournals.length}`], ['Inventory rows as of date', `${report.inventoryRows.length}`], ['Menu items', `${report.menuRows.length}`], ['Exceptions', `${report.exceptions.length}`]]}/>
        </Card>
      </div>
    </div>}

    {tab === 'finance' && <FinancialStatementSummary state={report.reportState} totals={report.reportTotals} locale={locale}/>}

    {tab === 'inventory' && <Card title={L(locale, 'Inventory valuation as-of period end', 'Inventory valuation as-of period end')} icon={<Archive/>}>
      <Table headers={['Store', 'SKU', 'Item', 'In Period', 'Out Period', 'On Hand As Of', 'Average Cost', 'Value', 'Status']} rows={report.inventoryRows.map((row: any) => [row.store?.nameEn || row.store?.nameAr, row.item?.sku, row.item?.nameEn || row.item?.nameAr, qty(row.periodIn, row.item?.purchaseUnit), qty(row.periodOut, row.item?.purchaseUnit), qty(row.onHand, row.item?.purchaseUnit), safeMoney(row.cost), safeMoney(row.value), row.onHand < 0 ? <Pill tone="bad">Negative</Pill> : row.onHand > 0 && row.cost <= 0 ? <Pill tone="warn">No Cost</Pill> : <Pill tone="good">OK</Pill>])}/>
    </Card>}

    {tab === 'suppliers' && <Card title={L(locale, 'Supplier spend and payments for selected period', 'Supplier spend and payments for selected period')} icon={<Wallet/>}>
      <Table headers={['Supplier', 'Invoices', 'Period Spend', 'Period Paid', 'Period Net', 'Bank']} rows={report.supplierRows.map((row: any) => [row.supplier?.name, `${row.invoices}`, safeMoney(row.spend), safeMoney(row.paid), safeMoney(row.periodNet), row.supplier?.bankName || '-'])}/>
    </Card>}

    {tab === 'menu' && <Card title={L(locale, 'Menu engineering for selected period', 'Menu engineering for selected period')} icon={<ChefHat/>}>
      <Table headers={['Menu Item', 'Recipe Lines', 'Sold Qty', 'Recipe Cost', 'Net Price', 'Margin', 'Food Cost %']} rows={report.menuRows.map((row: any) => [row.menu?.nameEn || row.menu?.nameAr, `${row.recipeLines}`, `${row.saleQty}`, safeMoney(row.cost), safeMoney(row.netUnit), safeMoney(row.margin), `${Number.isFinite(row.foodCostPct) ? row.foodCostPct.toFixed(1) : '0.0'}%`])}/>
    </Card>}

    {tab === 'exceptions' && <Card title={L(locale, 'Report exceptions for selected period/as-of date', 'Report exceptions for selected period/as-of date')} icon={<ShieldCheck/>}>
      <Table headers={['Area', 'Severity', 'Issue', 'Action']} rows={report.exceptions.map((row: any) => [row.area, <Pill tone={row.severity === 'critical' ? 'bad' : 'warn'}>{row.severity}</Pill>, row.issue, row.action])}/>
    </Card>}

    <Suspense fallback={<div className="notice">{L(locale, 'Loading reporting truth layer', 'Loading reporting truth layer')}</div>}>
      <ReportingTruthPanel period={truthPeriod}/>
    </Suspense>
  </div>;
}
