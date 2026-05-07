import { useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowRightLeft,
  BadgeCheck,
  BarChart3,
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
  LockKeyhole,
  PackageCheck,
  ReceiptText,
  ShieldCheck,
  Sparkles,
  Store,
  UploadCloud,
  WalletCards,
  XCircle,
} from 'lucide-react';
import { buildV100BackendPlan, buildV100QaSuite, buildV100Readiness, buildV100ReportFactory, buildV100Roadmap, downloadCsv, money } from '../engines/enterpriseV100Engine';

type Locale = 'en' | 'ar';
type Props = { state: any; totals: any; update?: (fn: (current: any) => any, success?: string) => void; locale: Locale; notify?: (type: 'success' | 'warning' | 'error', message: string) => void };
type TabKey = 'command' | 'backend' | 'posting' | 'close' | 'foodics' | 'inventory' | 'finance' | 'procurement' | 'production' | 'reports' | 'governance' | 'ui' | 'qa';

function L(locale: Locale, en: string, ar: string) { return locale === 'ar' ? ar : en; }
function today() { return new Date().toISOString().slice(0, 10); }
function id(prefix: string) { return `${prefix}-${Math.random().toString(36).slice(2, 10)}`; }
function arr(v: unknown): any[] { return Array.isArray(v) ? v : []; }

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

export default function EnterpriseV100Page({ state, totals, update, locale }: Props) {
  const [tab, setTab] = useState<TabKey>('command');
  const [period, setPeriod] = useState(() => today().slice(0, 7));
  const readiness = useMemo(() => buildV100Readiness(state, totals), [state, totals]);
  const roadmap = useMemo(() => buildV100Roadmap(), []);
  const backendPlan = useMemo(() => buildV100BackendPlan(), []);
  const reportFactory = useMemo(() => buildV100ReportFactory(), []);
  const qaSuite = useMemo(() => buildV100QaSuite(), []);
  const badChecks = readiness.checks.filter((check) => check.status === 'bad');
  const warningChecks = readiness.checks.filter((check) => check.status === 'warn');

  const tabs: { key: TabKey; en: string; ar: string; icon: React.ReactNode }[] = [
    { key: 'command', en: 'Command', ar: 'القيادة', icon: <Sparkles size={16}/> },
    { key: 'backend', en: 'Backend', ar: 'الخلفية', icon: <Database size={16}/> },
    { key: 'posting', en: 'Posting', ar: 'الترحيل', icon: <GitBranch size={16}/> },
    { key: 'close', en: 'Close', ar: 'الإغلاق', icon: <CalendarCheck size={16}/> },
    { key: 'foodics', en: 'Foodics', ar: 'فودكس', icon: <ReceiptText size={16}/> },
    { key: 'inventory', en: 'Inventory', ar: 'المخزون', icon: <Store size={16}/> },
    { key: 'finance', en: 'Finance', ar: 'المالية', icon: <Landmark size={16}/> },
    { key: 'procurement', en: 'Procurement', ar: 'المشتريات', icon: <PackageCheck size={16}/> },
    { key: 'production', en: 'Production', ar: 'الإنتاج', icon: <Layers size={16}/> },
    { key: 'reports', en: 'Reports', ar: 'التقارير', icon: <BarChart3 size={16}/> },
    { key: 'governance', en: 'Governance', ar: 'الحوكمة', icon: <ShieldCheck size={16}/> },
    { key: 'ui', en: 'UI Polish', ar: 'تلميع الواجهة', icon: <BrainCircuit size={16}/> },
    { key: 'qa', en: 'QA', ar: 'الاختبار', icon: <ClipboardCheck size={16}/> },
  ];

  const logV100Review = () => {
    if (!update) return;
    update((current) => ({
      ...current,
      audits: [...arr(current.audits), { id: id('AUD'), at: new Date().toISOString(), action: 'v100 readiness review', entity: 'Enterprise V100', ref: period, user: 'Local Admin', note: `Readiness ${readiness.score}% with ${badChecks.length} blockers and ${warningChecks.length} warnings` }],
    }), L(locale, 'v100 readiness review logged', 'تم تسجيل مراجعة جاهزية v100'));
  };

  const ensureFiscalPeriod = () => {
    if (!update) return;
    update((current) => {
      const fiscalPeriods = arr(current.fiscalPeriods);
      if (fiscalPeriods.some((p) => p.code === period)) return current;
      const startDate = `${period}-01`;
      const endDate = new Date(Number(period.slice(0, 4)), Number(period.slice(5, 7)), 0).toISOString().slice(0, 10);
      return { ...current, fiscalPeriods: [...fiscalPeriods, { id: id('PER'), code: period, nameEn: `Period ${period}`, nameAr: `فترة ${period}`, startDate, endDate, status: 'open' }] };
    }, L(locale, 'Fiscal period created/opened for local trial', 'تم إنشاء/فتح الفترة للتجربة المحلية'));
  };

  const exportReadiness = () => downloadCsv(`v100_readiness_${period}.csv`, readiness.checks.map((check) => ({ period, ...check })));
  const exportRoadmap = () => downloadCsv(`v100_roadmap_${period}.csv`, roadmap);
  const exportBackend = () => downloadCsv(`v100_backend_launch_plan_${period}.csv`, backendPlan);
  const exportReports = () => downloadCsv(`v100_report_factory_${period}.csv`, reportFactory);
  const exportQa = () => downloadCsv(`v100_qa_suite_${period}.csv`, qaSuite);
  const exportRisks = () => downloadCsv(`v100_inventory_risks_${period}.csv`, [
    ...readiness.negativeStock.map((row: any) => ({ period, type: 'negative_stock', store: row.storeName, item: row.itemName, qty: row.qty, value: row.value })),
    ...readiness.zeroCostStock.map((row: any) => ({ period, type: 'zero_cost_stock', store: row.storeName, item: row.itemName, qty: row.qty, value: row.value })),
  ]);

  const postingRows = [
    ['Foodics report only', 'Upload + detect files + map references; no GL/stock impact', 'Safe starter mode'],
    ['Foodics sales accounting', 'Approved batch + branch/payment mapping + open period', 'Posts sales/VAT/payment clearing without recipe blocker'],
    ['Foodics full ERP', 'Sales accounting controls + recipe coverage + stock/cost availability', 'Posts sales, VAT, COGS and inventory deduction'],
    ['Opening stock', 'Store/item/date/cost validated + period open + audit note', 'Creates stock and opening inventory journal when cost exists'],
    ['Stock count variance', 'Count uploaded + variance reviewed + approval + period open', 'Posts shortage/surplus movement and GL variance'],
    ['Supplier payment', 'Invoice allocation + amount check + payment account + approval', 'Posts AP reduction and cash/bank credit'],
    ['Manual journal', 'Balanced lines + active accounts + required cost center + approval', 'Posts GL only after review'],
    ['Production batch', 'Active production recipe + source stock + output lot/expiry + approval', 'Transfers raw material value to semi-finished stock'],
  ];

  const closeRows = [
    ['Sales close', readiness.counts.postedFoodics ? 'Detected posted Foodics/local sales activity' : 'No posted Foodics batch detected', readiness.counts.postedFoodics ? 'warn' : 'bad', 'Operations + Finance'],
    ['Inventory close', readiness.pendingApprovals.length ? `${readiness.pendingApprovals.length} variance approval(s) pending` : 'No pending inventory approvals', readiness.pendingApprovals.length ? 'warn' : 'good', 'Storekeeper + Operations'],
    ['Negative stock', readiness.negativeStock.length ? `${readiness.negativeStock.length} rows need correction` : 'No negative rows', readiness.negativeStock.length ? 'bad' : 'good', 'Operations'],
    ['Zero-cost stock', readiness.zeroCostStock.length ? `${readiness.zeroCostStock.length} rows need cost` : 'No zero-cost exposure', readiness.zeroCostStock.length ? 'warn' : 'good', 'Finance + Purchasing'],
    ['Finance close', readiness.journalDifference < 0.01 ? 'Posted journals are balanced' : `Journal difference ${readiness.journalDifference.toFixed(2)}`, readiness.journalDifference < 0.01 ? 'good' : 'bad', 'Finance'],
    ['Backend close', 'Still local-first; production lock must move to database/Edge Function', 'bad', 'Platform'],
  ];

  const uiRows = [
    ['Drawer forms', 'Create/edit screens should move into consistent side drawers', 'High'],
    ['Advanced tables', 'Search, filters, column visibility, sorting, pagination, saved views', 'High'],
    ['Document timeline', 'Every PO/GRN/journal/Foodics batch should show lifecycle and comments', 'High'],
    ['Attachment panel', 'Supplier docs, quotations, delivery notes, invoices, payment proofs, stock count sheets', 'High'],
    ['Print/PDF', 'PO, GRN, payment voucher, journal voucher, stock count, close certificate', 'High'],
    ['Arabic polish', 'RTL spacing, official terminology, Saudi enterprise tone, Arabic exports', 'Medium'],
    ['Global search', 'Search SKU, supplier, invoice, journal, Foodics order, employee', 'Medium'],
  ];

  return <div className="page-grid enterprise-v100">
    <div className="hero-panel v100-hero"><div><span className="eyebrow">v100 Enterprise Production Readiness</span><h2>{L(locale, 'Restaurant ERP v100 Control Tower', 'برج التحكم لنظام المطاعم v100')}</h2><p>{L(locale, 'This release combines the v88 to v100 roadmap into one operating cockpit: backend launch, posting guard, monthly close, Foodics settlement, inventory close, finance pack, procurement variance, production traceability, report factory, governance, UI polish and QA.', 'هذا الإصدار يجمع خارطة v88 إلى v100 في غرفة عمليات واحدة: إطلاق الخلفية، حارس الترحيل، الإغلاق الشهري، تسوية فودكس، إغلاق المخزون، حزمة المالية، انحرافات المشتريات، تتبع الإنتاج، مصنع التقارير، الحوكمة، تلميع الواجهة والاختبار.')}</p></div><div className="hero-actions"><select value={period} onChange={(event) => setPeriod(event.target.value)}><option value={today().slice(0, 7)}>{today().slice(0, 7)}</option><option value="2026-04">2026-04</option><option value="2026-05">2026-05</option><option value="2026-06">2026-06</option></select><button onClick={ensureFiscalPeriod}><CalendarCheck size={16}/>{L(locale, 'Ensure period', 'تجهيز الفترة')}</button><button onClick={logV100Review}><FileCheck2 size={16}/>{L(locale, 'Log review', 'تسجيل المراجعة')}</button><button onClick={exportReadiness}><Download size={16}/>{L(locale, 'Export control pack', 'تصدير حزمة الرقابة')}</button></div></div>

    <div className="tabs wide-tabs">{tabs.map((item) => <button key={item.key} className={tab === item.key ? 'active-tab' : ''} onClick={() => setTab(item.key)}>{item.icon}{L(locale, item.en, item.ar)}</button>)}</div>

    {tab === 'command' && <div className="page-grid"><div className="kpi-grid"><Kpi label={L(locale, 'v100 readiness', 'جاهزية v100')} value={`${readiness.score}%`} hint={L(locale, 'Local enterprise control score', 'درجة الرقابة المؤسسية المحلية')} icon={<Sparkles/>} tone={readiness.score >= 80 ? 'good' : readiness.score >= 60 ? 'warn' : 'bad'}/><Kpi label={L(locale, 'Critical blockers', 'عوائق حرجة')} value={badChecks.length} hint={L(locale, 'Must close before production', 'يجب إغلاقها قبل الإنتاج')} icon={<XCircle/>} tone={badChecks.length ? 'bad' : 'good'}/><Kpi label={L(locale, 'Warnings', 'تحذيرات')} value={warningChecks.length} hint={L(locale, 'Need management review', 'تحتاج مراجعة إدارية')} icon={<AlertTriangle/>} tone={warningChecks.length ? 'warn' : 'good'}/><Kpi label={L(locale, 'Inventory value', 'قيمة المخزون')} value={money(readiness.stockValue)} hint={L(locale, 'From local stock ledger', 'من سجل المخزون المحلي')} icon={<Store/>}/><Kpi label={L(locale, 'Sales revenue', 'إيراد المبيعات')} value={money(readiness.salesRevenue)} hint={L(locale, 'Local reported sales', 'مبيعات محلية مسجلة')} icon={<ReceiptText/>}/><Kpi label={L(locale, 'Gross profit', 'مجمل الربح')} value={money(readiness.grossProfit)} hint={L(locale, 'Sales less COGS', 'المبيعات ناقص التكلفة')} icon={<BarChart3/>}/><Kpi label={L(locale, 'AP exposure', 'تعرض الموردين')} value={money(readiness.apExposure)} hint={L(locale, 'Estimated unpaid supplier balance', 'رصيد موردين تقديري غير مدفوع')} icon={<WalletCards/>} tone={readiness.apExposure ? 'warn' : 'good'}/><Kpi label={L(locale, 'Backend readiness', 'جاهزية الخلفية')} value={`${readiness.backendReadiness}%`} hint={L(locale, 'Still blueprint/local-first', 'ما زالت خارطة/محلي')} icon={<Database/>} tone="warn"/></div><Card title={L(locale, 'v100 readiness checks', 'فحوصات جاهزية v100')} icon={<ShieldCheck/>}><Table headers={[L(locale, 'Area','المجال'), L(locale, 'Control','الضابط'), L(locale, 'Status','الحالة'), L(locale, 'Score','الدرجة'), L(locale, 'Detail','التفصيل'), L(locale, 'Next action','الإجراء التالي')]} rows={readiness.checks.map((row) => [row.area, row.control, <Pill tone={row.status}>{row.status}</Pill>, `${row.score}/10`, row.detail, row.action])}/></Card><Card title={L(locale, 'v88 → v100 delivery map', 'خارطة تنفيذ v88 إلى v100')} icon={<BadgeCheck/>} action={<button onClick={exportRoadmap}><Download size={16}/>{L(locale, 'Export roadmap', 'تصدير الخارطة')}</button>}><Table headers={['Version', 'Title', 'Deliverable', 'Status']} rows={roadmap.map((row) => [row.version, row.title, row.deliverable, row.status])}/></Card></div>}

    {tab === 'backend' && <div className="page-grid"><Card title={L(locale, 'Supabase production launch plan', 'خطة إطلاق Supabase الإنتاجية')} icon={<Database/>} action={<button onClick={exportBackend}><Download size={16}/>{L(locale, 'Export backend plan', 'تصدير الخطة')}</button>}><Table headers={['Wave', 'Layer', 'Deliverable', 'Priority', 'Owner']} rows={backendPlan.map((row) => [row.wave, row.layer, row.deliverable, row.priority, row.owner])}/></Card><Card title={L(locale, 'Why backend is the next real milestone', 'لماذا الخلفية هي المرحلة الحقيقية التالية')} icon={<LockKeyhole/>}><p className="muted">Local mode is excellent for workflow trials. Production needs Supabase Auth, PostgreSQL constraints, RLS, Edge Functions, immutable audit triggers, storage buckets, backups and server-side posting. Without that, users can still manipulate data from the browser.</p></Card></div>}

    {tab === 'posting' && <div className="page-grid"><Card title={L(locale, 'Central posting engine guard', 'حارس محرك الترحيل المركزي')} icon={<GitBranch/>}><Table headers={['Posting type', 'Required controls', 'Treatment']} rows={postingRows.map((row) => [row[0], row[1], row[2]])}/></Card><Card title={L(locale, 'Posting principle', 'مبدأ الترحيل')} icon={<BrainCircuit/>}><p className="muted">validate → permission → period → lifecycle status → inventory movement → GL journal → audit log → status update. In production, this must run server-side in Edge Functions with database transactions.</p></Card></div>}

    {tab === 'close' && <div className="page-grid"><Card title={L(locale, 'Monthly close control certificate', 'شهادة رقابة الإغلاق الشهري')} icon={<CalendarCheck/>}><Table headers={['Area', 'Current finding', 'Status', 'Owner']} rows={closeRows.map((row) => [row[0], row[1], <Pill tone={row[2] as any}>{row[2]}</Pill>, row[3]])}/></Card><Card title={L(locale, 'Close policy', 'سياسة الإغلاق')} icon={<FileCheck2/>}><p className="muted">A month should not close until Foodics sales are posted, stock count variances are approved, negative stock is cleared, zero-cost stock is resolved, journals are balanced, AP/VAT/bank are reviewed, and the close certificate is exported and approved.</p></Card></div>}

    {tab === 'foodics' && <div className="page-grid"><div className="kpi-grid"><Kpi label="Foodics batches" value={readiness.counts.foodicsBatches} hint="Batch register/history" icon={<ReceiptText/>}/><Kpi label="Posted batches" value={readiness.counts.postedFoodics} hint="Posted or marked posted" icon={<CheckCircle2/>} tone={readiness.counts.postedFoodics ? 'good' : 'warn'}/><Kpi label="Missing recipes" value={readiness.missingRecipeMenu.length} hint="Warn for sales accounting; block full ERP" icon={<AlertTriangle/>} tone={readiness.missingRecipeMenu.length ? 'warn' : 'good'}/><Kpi label="Sales docs" value={readiness.counts.salesDocs} hint="ERP sales documents" icon={<FileText/>}/></div><Card title="Foodics settlement controls" icon={<ReceiptText/>}><Table headers={['Settlement', 'Required control', 'Accounting outcome']} rows={[['Cash', 'Cashier expected vs actual and deposit proof', 'Cash on hand → bank / cash variance'], ['MADA/Card', 'Card payments vs bank settlement and bank fees', 'Card receivable → bank + fees'], ['Delivery apps', 'Jahez/HungerStation settlement and commission', 'Delivery receivable → bank + commission'], ['Internal hospitality', 'Internal payment method approval', 'Internal AR or hospitality expense'], ['Refunds/returns', 'Original order reference and refund payment validation', 'Reverse revenue/VAT/payment clearing']]}/></Card></div>}

    {tab === 'inventory' && <div className="page-grid"><div className="kpi-grid"><Kpi label="Negative stock" value={readiness.negativeStock.length} hint="Should be zero before close" icon={<XCircle/>} tone={readiness.negativeStock.length ? 'bad' : 'good'}/><Kpi label="Zero-cost stock" value={readiness.zeroCostStock.length} hint="Blocks accurate COGS" icon={<AlertTriangle/>} tone={readiness.zeroCostStock.length ? 'warn' : 'good'}/><Kpi label="Pending count approvals" value={readiness.pendingApprovals.length} hint="Stock count/adjustment approval" icon={<ClipboardCheck/>} tone={readiness.pendingApprovals.length ? 'warn' : 'good'}/><Kpi label="Stock movements" value={readiness.counts.stockMovements} hint="Inventory ledger rows" icon={<Layers/>}/></div><Card title="Inventory enterprise hardening" icon={<Store/>} action={<button onClick={exportRisks}><Download size={16}/>Export risks</button>}><Table headers={['Control', 'v100 position', 'Enterprise next']} rows={[['Opening stock', 'Upload and unknown-SKU starter option exist', 'Approval + import batch audit + period lock'], ['Monthly stock count', 'Count sheet generation/upload/variance approval exists', 'Blind count, count cycle status and bin-level counting'], ['Costing', 'Average cost direction exists', 'Central weighted-average engine with unit conversion enforcement'], ['Transfers', 'Basic transfer concept exists', 'Request → dispatch → in-transit → receive lifecycle'], ['Expiry/FEFO', 'Lots and expiry concept exists', 'FEFO issue suggestion and expiry blocking']]}/></Card></div>}

    {tab === 'finance' && <div className="page-grid"><div className="kpi-grid"><Kpi label="Journal difference" value={readiness.journalDifference.toFixed(2)} hint="Debit minus credit" icon={<Landmark/>} tone={readiness.journalDifference < 0.01 ? 'good' : 'bad'}/><Kpi label="Posted journals" value={readiness.counts.postedJournals} hint="Accounting register" icon={<FileText/>}/><Kpi label="AP exposure" value={money(readiness.apExposure)} hint="Supplier liability pressure" icon={<WalletCards/>} tone={readiness.apExposure ? 'warn' : 'good'}/><Kpi label="Unmatched bank lines" value={readiness.unmatchedBank.length} hint="Bank reconciliation exceptions" icon={<ArrowRightLeft/>} tone={readiness.unmatchedBank.length ? 'warn' : 'good'}/></div><Card title="CFO professional pack gaps" icon={<Landmark/>}><Table headers={['Area', 'Now', 'Needed for enterprise']} rows={[['Journals', 'Manual, register, reversal concepts', 'Approval workflow, attachments, recurring journals'], ['AP/AR', 'Supplier/customer concepts and payment run direction', 'Deep aging, statements, due-date scheduling, collection workflow'], ['Banking', 'Reconciliation concept', 'Matching rules, settlement linking, bank fee automation'], ['VAT', 'Input/output concept', 'VAT return-ready export and lock after filing'], ['Statements', 'P&L/BS/CF direction', 'Comparative Excel/PDF board pack and year-end close']]}/></Card></div>}

    {tab === 'procurement' && <div className="page-grid"><Card title="Procurement variance pack" icon={<PackageCheck/>}><Table headers={['Control', 'Current status', 'Next hardening']} rows={[['Material request → PO', 'Concept exists', 'Separate PR and approval by amount'], ['PO → GRN', 'GRN direction exists', 'Partial receiving and backorders'], ['GRN → invoice', 'GRNI concept exists', 'Line-level quantity/price variance enforcement'], ['Supplier returns', 'Return concept exists', 'Link to GRN/invoice and credit note'], ['Supplier payment', 'Invoice allocation direction exists', 'Payment schedule, advance payment and voucher PDF']]}/></Card></div>}

    {tab === 'production' && <div className="page-grid"><Card title="Production traceability roadmap" icon={<Layers/>}><Table headers={['Control', 'Purpose', 'Enterprise treatment']} rows={[['Production recipe approval', 'Avoid uncontrolled prep formulas', 'Draft → approved → active version'], ['Planned vs actual', 'Measure kitchen discipline', 'Ingredient actuals, output yield, loss reason'], ['Lot traceability', 'Food safety and cost audit', 'Raw lot → produced lot → final sale'], ['Produced expiry', 'Control dough/sauce expiration', 'Expiry date by batch + FEFO suggestion'], ['Production reversal', 'Correct mistakes safely', 'Controlled reversal with reason and audit']]}/></Card></div>}

    {tab === 'reports' && <div className="page-grid"><Card title="Board report factory" icon={<BarChart3/>} action={<button onClick={exportReports}><Download size={16}/>Export report factory</button>}><Table headers={['Pack', 'Reports', 'Format', 'Priority']} rows={reportFactory.map((row) => [row.pack, row.reports, row.format, row.priority])}/></Card></div>}

    {tab === 'governance' && <div className="page-grid"><Card title="Data governance cockpit" icon={<ShieldCheck/>}><Table headers={['Governance area', 'Current exception', 'Enterprise action']} rows={[['Duplicate SKU', readiness.duplicateSkus.length ? readiness.duplicateSkus.join(', ') : 'None detected', 'Database unique constraint + import validation'], ['Duplicate account', readiness.duplicateAccounts.length ? readiness.duplicateAccounts.join(', ') : 'None detected', 'COA unique constraint + approval'], ['Supplier compliance', `${readiness.suppliersMissingInfo.length} supplier(s) missing VAT/bank/rep data`, 'Supplier completion checklist + attachments'], ['Permission enforcement', `${readiness.counts.roles} role(s) detected`, 'Button-level permission guards + denied action log'], ['Audit trail', 'Local audit exists in parts', 'Database audit triggers and immutable logs']]}/></Card></div>}

    {tab === 'ui' && <div className="page-grid"><Card title="Enterprise UI polish plan" icon={<BrainCircuit/>}><Table headers={['UI layer', 'Target', 'Priority']} rows={uiRows}/></Card></div>}

    {tab === 'qa' && <div className="page-grid"><Card title="QA regression suite" icon={<ClipboardCheck/>} action={<button onClick={exportQa}><Download size={16}/>Export QA</button>}><Table headers={['Test', 'Expected result', 'Priority']} rows={qaSuite.map((row) => [row.test, row.expected, row.priority])}/></Card><Card title="Current score notes" icon={<BadgeCheck/>}><Table headers={['Perspective', 'Score', 'Note']} rows={[[L(locale, 'Local MVP / prototype', 'نموذج محلي'), '9.1/10', L(locale, 'Excellent for workflow testing and demo.', 'ممتاز لاختبار التدفقات والعرض.')], [L(locale, 'Serious ERP foundation', 'أساس ERP جاد'), '8.1/10', L(locale, 'Very strong direction, still needs backend and enforcement.', 'اتجاه قوي جدًا، يحتاج خلفية وإنفاذ.')], [L(locale, 'Enterprise design direction', 'اتجاه مؤسسي'), '8.5/10', L(locale, 'Control layers are now mature for a prototype.', 'طبقات الرقابة أصبحت ناضجة كنموذج.')], [L(locale, 'Production readiness', 'جاهزية الإنتاج'), '4.8/10', L(locale, 'Still local-first; not ready for live books.', 'ما زال محليًا، ليس جاهزًا للدفاتر الحية.')], [L(locale, 'Backend/security readiness', 'جاهزية الخلفية والأمان'), '4.2/10', L(locale, 'Clear blueprint, implementation not done yet.', 'خارطة واضحة، التنفيذ لم يبدأ بعد.')]]}/></Card></div>}
  </div>;
}
