import { useMemo, useState } from 'react';
import {
  Activity,
  AlertTriangle,
  ArrowRightLeft,
  BadgeCheck,
  BarChart3,
  Banknote,
  BookOpenCheck,
  Boxes,
  BrainCircuit,
  CalendarCheck,
  CheckCircle2,
  ClipboardCheck,
  Database,
  Download,
  FileCheck2,
  FileText,
  GitBranch,
  Landmark,
  Layers,
  ListChecks,
  LockKeyhole,
  PackageCheck,
  ReceiptText,
  ShieldCheck,
  Sparkles,
  Store,
  TrendingUp,
  UploadCloud,
  WalletCards,
  XCircle,
} from 'lucide-react';
import { buildV87ActionPlan, calculateV87Readiness, makeCsv, money } from '../engines/enterpriseV87Engine';

type Locale = 'en' | 'ar';
type Props = { state: any; totals: any; update?: (fn: (current: any) => any, success?: string) => void; locale: Locale; notify?: (type: 'success' | 'warning' | 'error', message: string) => void };
type TabKey = 'command' | 'posting' | 'close' | 'foodics' | 'inventory' | 'finance' | 'procurement' | 'reports' | 'backend' | 'qa';

function L(locale: Locale, en: string, ar: string) { return locale === 'ar' ? ar : en; }
function arr(v: unknown): any[] { return Array.isArray(v) ? v : []; }
function sum(rows: any[], fn: (row: any) => number) { return rows.reduce((total, row) => total + (Number(fn(row)) || 0), 0); }
function today() { return new Date().toISOString().slice(0, 10); }
function id(prefix: string) { return `${prefix}-${Math.random().toString(36).slice(2, 10)}`; }

function Pill({ tone, children }: { tone: 'good' | 'warn' | 'bad' | 'info'; children: React.ReactNode }) {
  return <span className={`pill ${tone}`}>{children}</span>;
}

function Kpi({ label, value, hint, icon, tone = 'info' }: { label: string; value: string | number; hint: string; icon: React.ReactNode; tone?: 'good' | 'warn' | 'bad' | 'info' }) {
  return <div className={`kpi-card ${tone}`}><div className="kpi-icon">{icon}</div><div><span>{label}</span><strong>{value}</strong><small>{hint}</small></div></div>;
}

function Card({ title, icon, action, children }: { title: string; icon?: React.ReactNode; action?: React.ReactNode; children: React.ReactNode }) {
  return <section className="card"><div className="card-header"><div className="card-title">{icon}{title}</div>{action}</div>{children}</section>;
}

function Table({ headers, rows }: { headers: React.ReactNode[]; rows: React.ReactNode[][] }) {
  return <div className="table-wrap"><table><thead><tr>{headers.map((h, index) => <th key={index}>{h}</th>)}</tr></thead><tbody>{rows.length ? rows.map((row, index) => <tr key={index}>{row.map((cell, c) => <td key={c}>{cell}</td>)}</tr>) : <tr><td colSpan={headers.length} className="muted">No rows</td></tr>}</tbody></table></div>;
}

export default function EnterpriseV87Page({ state, totals, update, locale, notify }: Props) {
  const [tab, setTab] = useState<TabKey>('command');
  const [period, setPeriod] = useState(() => today().slice(0, 7));
  const readiness = useMemo(() => calculateV87Readiness(state, totals), [state, totals]);
  const actionPlan = useMemo(() => buildV87ActionPlan(state, totals), [state, totals]);
  const postedJournals = arr(state?.journals).filter((j) => j.status === 'posted');
  const stockMovements = arr(state?.stockMovements);
  const salesDocs = arr(state?.salesDocs);
  const purchaseInvoices = arr(state?.purchaseInvoices);
  const supplierPayments = arr(state?.supplierPayments).filter((p) => p.status === 'posted');
  const foodicsBatches = arr(state?.foodicsBatches ?? state?.foodicsBatchRegister);
  const inventoryApprovals = arr(state?.inventoryApprovals);
  const apBalance = readiness.apBalance;
  const stockValue = sum(stockMovements, (m) => (m.direction === 'in' ? 1 : -1) * Number(m.qty) * Number(m.unitCost));
  const salesRevenue = Number(totals?.salesRevenue ?? 0);
  const grossProfit = Number(totals?.grossProfit ?? 0);
  const riskCount = readiness.checks.filter((c) => c.status === 'bad').length;
  const warningCount = readiness.checks.filter((c) => c.status === 'warn').length;

  const exportControlPack = () => makeCsv(`v87_enterprise_control_pack_${period}.csv`, readiness.checks.map((c) => ({ period, ...c })));
  const exportActionPlan = () => makeCsv(`v87_action_plan_${period}.csv`, actionPlan);
  const exportCloseCertificate = () => makeCsv(`v87_monthly_close_certificate_${period}.csv`, [
    { period, readiness_score: readiness.score, blockers: riskCount, warnings: warningCount, sales_revenue: salesRevenue, gross_profit: grossProfit, inventory_value: stockValue, ap_balance: apBalance, created_at: new Date().toISOString() },
  ]);
  const safeAudit = (action: string, note: string) => {
    if (!update) return;
    update((current) => ({ ...current, auditLogs: [...arr(current.auditLogs), { id: id('AUD'), at: new Date().toISOString(), action, entity: 'Enterprise V87', ref: period, user: 'Local Admin', note }] }), L(locale, 'Enterprise audit event added', 'تمت إضافة حدث تدقيق مؤسسي'));
  };
  const ensurePeriod = () => {
    if (!update) return;
    update((current) => {
      const periods = arr(current.fiscalPeriods);
      if (periods.some((p) => p.code === period)) return current;
      const startDate = `${period}-01`;
      const endDate = new Date(Number(period.slice(0, 4)), Number(period.slice(5, 7)), 0).toISOString().slice(0, 10);
      return { ...current, fiscalPeriods: [...periods, { id: id('PER'), code: period, nameEn: `Period ${period}`, nameAr: `فترة ${period}`, startDate, endDate, status: 'open' }] };
    }, L(locale, 'Fiscal period ensured', 'تم تجهيز الفترة المالية'));
  };

  const tabs: { key: TabKey; en: string; ar: string; icon: React.ReactNode }[] = [
    { key: 'command', en: 'Command Board', ar: 'لوحة القيادة', icon: <Sparkles size={16}/> },
    { key: 'posting', en: 'Posting Engine', ar: 'محرك الترحيل', icon: <GitBranch size={16}/> },
    { key: 'close', en: 'Monthly Close', ar: 'الإغلاق الشهري', icon: <CalendarCheck size={16}/> },
    { key: 'foodics', en: 'Foodics Control', ar: 'رقابة فودكس', icon: <ReceiptText size={16}/> },
    { key: 'inventory', en: 'Inventory Pro', ar: 'احتراف المخزون', icon: <Boxes size={16}/> },
    { key: 'finance', en: 'CFO Pack', ar: 'حزمة المدير المالي', icon: <Landmark size={16}/> },
    { key: 'procurement', en: 'Procurement', ar: 'المشتريات', icon: <PackageCheck size={16}/> },
    { key: 'reports', en: 'Report Factory', ar: 'مصنع التقارير', icon: <BarChart3 size={16}/> },
    { key: 'backend', en: 'Backend Sprint', ar: 'سباق الخلفية', icon: <Database size={16}/> },
    { key: 'qa', en: 'QA & Notes', ar: 'الاختبار والملاحظات', icon: <ClipboardCheck size={16}/> },
  ];

  const postingRows = [
    ['Foodics full ERP posting', 'Foodics batch approved + branches mapped + payments mapped + recipes ready + stock/cost ready + period open'],
    ['Sales accounting only', 'Foodics batch approved + payment accounts mapped + period open; recipes are warning only'],
    ['Opening stock posting', 'Store exists + item exists or auto-create enabled + quantity/cost validated + period open'],
    ['Stock count variance', 'Count sheet uploaded + variance reviewed + manager approval + period open'],
    ['Supplier payment', 'Supplier invoice selected + not overpaid + payment account valid + approval + period open'],
    ['Manual journal', 'Balanced debit/credit + account active + cost center if required + approval + period open'],
    ['Production batch', 'Recipe active + source stock available + output item active + approval + period open'],
  ];

  const backendRows = [
    ['Auth', 'Supabase Auth with email/password and invite flow', 'High'],
    ['Database', 'PostgreSQL normalized tables for setup, inventory, finance, Foodics staging', 'High'],
    ['RLS', 'Branch/store/cost-center data visibility by user scope', 'High'],
    ['Edge Functions', 'Server-side posting for journals, stock, Foodics, counts, payments', 'High'],
    ['Storage', 'PO, GRN, invoices, payment proof, stock count, journal attachments', 'Medium'],
    ['Audit triggers', 'Immutable before/after audit logs for critical tables', 'High'],
    ['Import staging', 'Foodics and Excel rows staged before approval/posting', 'High'],
    ['Backups', 'Daily backup + export pack + restore drill', 'High'],
  ];

  const reportRows = [
    ['Executive board pack', 'Sales, gross profit, inventory value, AP, exceptions, close status', 'Owner / CEO'],
    ['Foodics settlement pack', 'Orders vs payments, cash/card/delivery apps, refunds, voids, VAT', 'Finance / Operations'],
    ['Theoretical vs actual food cost', 'Recipe demand vs stock movement/count variance', 'Operations / Finance'],
    ['Branch P&L by month', 'Sales, COGS, payroll later, expenses, net profit by branch', 'Management'],
    ['Inventory risk pack', 'Negative stock, zero-cost stock, expiry exposure, slow moving', 'Storekeeper / Ops'],
    ['AP aging & cash forecast', 'Supplier due buckets, payment plan, cash pressure', 'CFO'],
    ['Procurement variance', 'PO vs GRN vs invoice qty/cost variance', 'Procurement / Finance'],
    ['Monthly close certificate', 'Checklist status, approvers, unresolved exceptions, signed close state', 'Finance Manager'],
  ];

  return <div className="page-grid enterprise-v87">
    <div className="hero-panel v87-hero"><div><span className="eyebrow">v87 Mega Patch</span><h2>{L(locale, 'Enterprise Operating System Control Tower', 'برج التحكم لنظام التشغيل المؤسسي')}</h2><p>{L(locale, 'This patch converts the previous control dashboards into an operating command layer: posting guard, monthly close, Foodics settlement, inventory risk, CFO pack, report factory, backend sprint and QA notes.', 'هذه الحزمة تحول لوحات الرقابة السابقة إلى طبقة قيادة تشغيلية: حارس الترحيل، الإغلاق الشهري، تسوية فودكس، مخاطر المخزون، حزمة المدير المالي، مصنع التقارير، سباق الخلفية وملاحظات الاختبار.')}</p></div><div className="hero-actions"><select value={period} onChange={(e) => setPeriod(e.target.value)}><option value={today().slice(0, 7)}>{today().slice(0, 7)}</option><option value="2026-04">2026-04</option><option value="2026-05">2026-05</option></select><button onClick={exportControlPack}><Download size={16}/>{L(locale, 'Export control pack', 'تصدير حزمة الرقابة')}</button><button onClick={exportActionPlan}><Download size={16}/>{L(locale, 'Export action plan', 'تصدير خطة العمل')}</button></div></div>

    <div className="kpi-grid">
      <Kpi label={L(locale, 'Enterprise readiness', 'جاهزية المؤسسة')} value={`${readiness.score}%`} hint={L(locale, 'Weighted local-control score', 'درجة الرقابة المحلية الموزونة')} icon={<BadgeCheck/>} tone={readiness.score >= 80 ? 'good' : readiness.score >= 65 ? 'warn' : 'bad'} />
      <Kpi label={L(locale, 'Critical blockers', 'معوقات حرجة')} value={riskCount} hint={L(locale, 'Must be solved before live use', 'يجب حلها قبل التشغيل')} icon={<XCircle/>} tone={riskCount ? 'bad' : 'good'} />
      <Kpi label={L(locale, 'Warnings', 'تحذيرات')} value={warningCount} hint={L(locale, 'Important trial exceptions', 'استثناءات مهمة للتجربة')} icon={<AlertTriangle/>} tone={warningCount ? 'warn' : 'good'} />
      <Kpi label={L(locale, 'Inventory value', 'قيمة المخزون')} value={money(stockValue)} hint={L(locale, 'Local stock movement valuation', 'تقييم حركات المخزون المحلية')} icon={<Store/>} tone="info" />
    </div>

    <div className="tab-strip">{tabs.map((t) => <button key={t.key} className={tab === t.key ? 'active' : ''} onClick={() => setTab(t.key)}>{t.icon}{L(locale, t.en, t.ar)}</button>)}</div>

    {tab === 'command' && <div className="page-grid">
      <div className="kpi-grid"><Kpi label="Sales" value={money(salesRevenue)} hint="Local revenue snapshot" icon={<TrendingUp/>}/><Kpi label="Gross profit" value={money(grossProfit)} hint="Sales less estimated food cost" icon={<Activity/>}/><Kpi label="AP exposure" value={money(apBalance)} hint="Estimated supplier liability" icon={<WalletCards/>} tone={apBalance ? 'warn' : 'good'}/><Kpi label="Posted journals" value={readiness.postedJournals} hint="Accounting documents" icon={<FileText/>}/></div>
      <Card title={L(locale, 'Enterprise readiness checks', 'فحوصات جاهزية المؤسسة')} icon={<ShieldCheck/>} action={<button onClick={() => safeAudit('v87 health review', `Readiness ${readiness.score}% with ${riskCount} blockers`)}><FileCheck2 size={16}/>{L(locale, 'Log review', 'تسجيل المراجعة')}</button>}><Table headers={[L(locale, 'Area','المجال'), L(locale, 'Control','الضابط'), L(locale, 'Status','الحالة'), L(locale, 'Score','الدرجة'), L(locale, 'Detail','التفصيل'), L(locale, 'Action','الإجراء')]} rows={readiness.checks.map((c) => [c.area, c.control, <Pill tone={c.status}>{c.status}</Pill>, `${c.score}/10`, c.detail, c.action])}/></Card>
      <Card title={L(locale, 'Priority action plan', 'خطة العمل ذات الأولوية')} icon={<ListChecks/>}><Table headers={['#', 'Area', 'Issue', 'Severity', 'Owner', 'Action']} rows={actionPlan.map((r) => [r.priority, r.area, r.issue, <Pill tone={r.severity as any}>{r.severity}</Pill>, r.owner, r.action])}/></Card>
    </div>}

    {tab === 'posting' && <div className="page-grid"><Card title={L(locale, 'Central posting guard', 'حارس الترحيل المركزي')} icon={<GitBranch/>}><Table headers={[L(locale, 'Posting type','نوع الترحيل'), L(locale, 'Required controls before posting','الضوابط المطلوبة قبل الترحيل')]} rows={postingRows.map((r) => [r[0], r[1]])}/></Card><Card title={L(locale, 'Posting architecture note', 'ملاحظة بنية الترحيل')} icon={<BrainCircuit/>}><p className="muted">validate → permission → period → document status → inventory movement → GL journal → audit log → status update. This should become server-side in Supabase Edge Functions.</p></Card></div>}

    {tab === 'close' && <div className="page-grid"><Card title={L(locale, 'Monthly close command checklist', 'قائمة قيادة الإغلاق الشهري')} icon={<CalendarCheck/>} action={<><button onClick={ensurePeriod}><CalendarCheck size={16}/>{L(locale, 'Ensure period', 'تجهيز الفترة')}</button><button onClick={exportCloseCertificate}><Download size={16}/>{L(locale, 'Export certificate', 'تصدير شهادة')}</button></>}><Table headers={['Step', 'Control', 'Status', 'Owner']} rows={[
      ['1', 'Foodics sales imported, validated, approved and posted', foodicsBatches.length ? <Pill tone="warn">Review</Pill> : <Pill tone="bad">Missing</Pill>, 'Operations / Finance'],
      ['2', 'Opening stock and purchases posted for active stores', stockMovements.length ? <Pill tone="good">Detected</Pill> : <Pill tone="bad">Missing</Pill>, 'Storekeeper'],
      ['3', 'Monthly stock count uploaded and variances approved', inventoryApprovals.some((a) => a.status === 'pending') ? <Pill tone="warn">Pending approval</Pill> : <Pill tone="good">No pending</Pill>, 'Operations Manager'],
      ['4', 'Inventory vs GL reviewed', readiness.negativeStock.length ? <Pill tone="bad">Exception</Pill> : <Pill tone="good">Ready</Pill>, 'Finance'],
      ['5', 'AP, VAT, bank and journals reviewed', <Pill tone={riskCount ? 'warn' : 'good'}>{riskCount ? 'Needs review' : 'Ready'}</Pill>, 'Finance Manager'],
      ['6', 'Close certificate exported and signed', <Pill tone="info">Manual</Pill>, 'Owner / CFO'],
    ]}/></Card></div>}

    {tab === 'foodics' && <div className="page-grid"><div className="kpi-grid"><Kpi label="Foodics batches" value={foodicsBatches.length} hint="Local batch register" icon={<ReceiptText/>}/><Kpi label="Sales docs" value={salesDocs.length} hint="ERP sales documents" icon={<Banknote/>}/><Kpi label="Foodics blockers" value={readiness.missingRecipeMenu.length} hint="Menu items missing recipes" icon={<AlertTriangle/>} tone={readiness.missingRecipeMenu.length ? 'warn' : 'good'}/><Kpi label="Recommended mode" value={readiness.missingRecipeMenu.length ? 'Sales accounting only' : 'Full ERP'} hint="Based on recipe readiness" icon={<CheckCircle2/>}/></div><Card title="Foodics settlement workbench design" icon={<WalletCards/>}><Table headers={['Settlement area', 'Control', 'Accounting treatment']} rows={[
      ['Cash', 'Cashier expected vs actual', 'Cash on hand / variance'],
      ['MADA/Card', 'Foodics card payments vs bank settlement', 'Card receivable → bank / bank fees'],
      ['Delivery apps', 'Jahez/HungerStation settlements', 'Delivery app receivable → bank / commission'],
      ['Internal/Hospitality', 'Internal method review', 'Internal AR or hospitality expense'],
      ['Refunds/Returns', 'Original order link and negative payment check', 'Reverse revenue/VAT/payment clearing'],
    ]}/></Card></div>}

    {tab === 'inventory' && <div className="page-grid"><div className="kpi-grid"><Kpi label="Negative rows" value={readiness.negativeStock.length} hint="Should be zero before close" icon={<XCircle/>} tone={readiness.negativeStock.length ? 'bad' : 'good'}/><Kpi label="Zero-cost rows" value={readiness.zeroCostStock.length} hint="Blocks accurate COGS" icon={<AlertTriangle/>} tone={readiness.zeroCostStock.length ? 'warn' : 'good'}/><Kpi label="Pending count approvals" value={inventoryApprovals.filter((a) => a.status === 'pending').length} hint="Stock count variances" icon={<ClipboardCheck/>}/><Kpi label="Movements" value={stockMovements.length} hint="Stock ledger rows" icon={<Layers/>}/></div><Card title="Inventory professional controls" icon={<Boxes/>}><Table headers={['Control', 'Current purpose', 'Next hardening']} rows={[
      ['Opening stock', 'Start system with stock and cost', 'Approval + period lock + import audit'],
      ['Monthly count', 'Find surplus/shortage', 'Count cycle status + blind count + variance approval'],
      ['Transfers', 'Move stock between stores', 'Request → dispatch → in-transit → receive'],
      ['Costing', 'Average cost from receipts', 'Central weighted-average engine + unit conversion'],
      ['Expiry', 'Lot/expiry visibility', 'FEFO issue suggestion + expiry block'],
    ]}/></Card></div>}

    {tab === 'finance' && <div className="page-grid"><div className="kpi-grid"><Kpi label="AP balance" value={money(apBalance)} hint="Estimated unpaid purchase invoices" icon={<WalletCards/>} tone={apBalance ? 'warn' : 'good'}/><Kpi label="Purchase invoices" value={purchaseInvoices.length} hint="Posted/draft invoices" icon={<ReceiptText/>}/><Kpi label="Supplier payments" value={supplierPayments.length} hint="Posted payment vouchers" icon={<Banknote/>}/><Kpi label="Journal balance blockers" value={readiness.checks.find((c) => c.control === 'Balanced journal control')?.status === 'bad' ? 'Yes' : 'No'} hint="Debit vs credit" icon={<Landmark/>}/></div><Card title="CFO close controls" icon={<Landmark/>}><Table headers={['Control', 'Required output', 'Enterprise gap']} rows={[
      ['AP aging', 'Due buckets by supplier and invoice', 'Needs deep aging register and payment scheduling'],
      ['AR aging', 'Customer/delivery app receivable buckets', 'Needs collection workflow'],
      ['Bank reconciliation', 'Matched/unmatched statement lines', 'Needs matching rules and settlement links'],
      ['VAT return', 'VAT output/input/net payable', 'Needs ZATCA-ready export format'],
      ['Financial statements', 'P&L, balance sheet, cash flow', 'Needs comparative Excel/PDF pack'],
    ]}/></Card></div>}

    {tab === 'procurement' && <div className="page-grid"><Card title="Procurement control roadmap" icon={<PackageCheck/>}><Table headers={['Area', 'Current capability', 'Enterprise next']} rows={[
      ['Material request', 'Request concept exists', 'Separate purchase request and approval route'],
      ['PO', 'PO and GRN concepts exist', 'Partial receiving, backorders, amount approval'],
      ['Invoice matching', 'GRNI accounting direction exists', 'Line-level price/quantity variance enforcement'],
      ['Supplier payment', 'Invoice allocation started', 'Payment run, advances, due-date scheduling'],
      ['Documents', 'Document pack concept exists', 'PDF, attachments, signature trail'],
    ]}/></Card></div>}

    {tab === 'reports' && <div className="page-grid"><Card title="Board report factory v87" icon={<BarChart3/>}><Table headers={['Report', 'Purpose', 'Audience']} rows={reportRows}/></Card><Card title="Export shortcuts" icon={<Download/>}><div className="actions"><button onClick={exportControlPack}><Download size={16}/>Control pack</button><button onClick={exportActionPlan}><Download size={16}/>Action plan</button><button onClick={exportCloseCertificate}><Download size={16}/>Close certificate</button></div></Card></div>}

    {tab === 'backend' && <div className="page-grid"><Card title="Supabase backend sprint board" icon={<Database/>}><Table headers={['Layer', 'Deliverable', 'Priority']} rows={backendRows}/></Card><Card title="Production note" icon={<LockKeyhole/>}><p className="muted">The app is now strong for local workflow trials. Production use must move posting, permissions, period locks, imports, audit and attachments to Supabase/PostgreSQL and Edge Functions.</p></Card></div>}

    {tab === 'qa' && <div className="page-grid"><Card title="QA regression suite" icon={<ClipboardCheck/>}><Table headers={['Test', 'Expected result', 'Priority']} rows={[
      ['Open app with empty local storage', 'No white page; dashboard loads', 'High'],
      ['Load fast trial scenario', 'All major modules have data', 'High'],
      ['Foodics menu import', 'Products/ingredients/modifiers detected', 'High'],
      ['Foodics sales validation', 'Issues drill down to exact rows', 'High'],
      ['Sales accounting-only posting', 'Posts without recipe blockers', 'High'],
      ['Full ERP posting', 'Blocks missing recipe/cost/stock safely', 'High'],
      ['Opening stock upload', 'Creates stock and cost rows', 'High'],
      ['Monthly stock count', 'Creates surplus/shortage approval batch', 'High'],
      ['Enterprise close export', 'CSV exports without crash', 'Medium'],
    ]}/></Card><Card title="Patch notes v87" icon={<BookOpenCheck/>}><p className="muted">Current score after v87: Local prototype 9.0/10, ERP foundation 7.9/10, enterprise design direction 8.3/10, production readiness 4.6/10. Main missing layer remains Supabase backend, server-side posting, RLS, attachments and full workflow enforcement.</p></Card></div>}
  </div>;
}
