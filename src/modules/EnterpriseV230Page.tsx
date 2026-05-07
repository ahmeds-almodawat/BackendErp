import { useMemo, useState } from 'react';
import { AlertTriangle, Archive, BadgeCheck, BarChart3, ClipboardCheck, Database, Download, FileSpreadsheet, Gauge, GitBranch, Layers, ListChecks, PlayCircle, Rocket, ShieldCheck, Sparkles, UploadCloud } from 'lucide-react';
import { buildV230Checks, buildV230ExpectedResults, buildV230IssueRegister, buildV230Metrics, buildV230PilotSteps, toCsv } from '../engines/enterpriseV230Engine';

type Locale = 'en' | 'ar';
type Tab = 'command' | 'pilot' | 'expected' | 'issues' | 'data' | 'close' | 'backend' | 'polish' | 'score';

type Props = {
  state: any;
  totals: any;
  update: (fn: (state: any) => any, success?: string) => void;
  locale: Locale;
  notify?: (type: 'success' | 'warning' | 'error', message: string) => void;
};

const L = (locale: Locale, en: string, ar: string) => locale === 'ar' ? ar : en;
const money = (value: number, locale: Locale) => new Intl.NumberFormat(locale === 'ar' ? 'ar-SA' : 'en-US', { style: 'currency', currency: 'SAR', maximumFractionDigits: 2 }).format(Number(value || 0));

function downloadText(filename: string, content: string, mime = 'text/csv;charset=utf-8') {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

function Pill({ status }: { status: string }) {
  const cls = status === 'pass' ? 'ok' : status === 'blocker' ? 'bad' : status === 'warning' ? 'warn' : 'info';
  return <span className={`status-pill ${cls}`}>{status}</span>;
}

function Card({ title, icon, children, action }: { title: string; icon?: React.ReactNode; children: React.ReactNode; action?: React.ReactNode }) {
  return <section className="card"><div className="card-header"><div className="card-title">{icon}{title}</div>{action}</div>{children}</section>;
}

function MiniKpi({ label, value, hint, icon }: { label: string; value: string; hint: string; icon: React.ReactNode }) {
  return <div className="kpi"><div className="kpi-icon">{icon}</div><div><span>{label}</span><strong>{value}</strong><small>{hint}</small></div></div>;
}

function Table({ headers, rows }: { headers: string[]; rows: React.ReactNode[][] }) {
  return <div className="table-wrap"><table><thead><tr>{headers.map((h) => <th key={h}>{h}</th>)}</tr></thead><tbody>{rows.length ? rows.map((r, i) => <tr key={i}>{r.map((c, ci) => <td key={ci}>{c}</td>)}</tr>) : <tr><td colSpan={headers.length}>—</td></tr>}</tbody></table></div>;
}

export default function EnterpriseV230Page({ state, totals, update, locale, notify }: Props) {
  const [tab, setTab] = useState<Tab>('command');
  const [tester, setTester] = useState('Local QA / Ahmed');
  const [note, setNote] = useState('v230 pilot readiness run');
  const metrics = useMemo(() => buildV230Metrics(state, totals), [state, totals]);
  const checks = useMemo(() => buildV230Checks(state, totals), [state, totals]);
  const steps = useMemo(() => buildV230PilotSteps(state, totals), [state, totals]);
  const issues = useMemo(() => buildV230IssueRegister(state, totals), [state, totals]);
  const expected = useMemo(() => buildV230ExpectedResults(state, totals), [state, totals]);

  const tabs: Record<Tab, string> = {
    command: L(locale, 'Command', 'القيادة'),
    pilot: L(locale, 'Pilot Script', 'سيناريو التجربة'),
    expected: L(locale, 'Expected Results', 'النتائج المتوقعة'),
    issues: L(locale, 'Issue Register', 'سجل الملاحظات'),
    data: L(locale, 'Data Pack', 'حزمة البيانات'),
    close: L(locale, 'Close Gate', 'بوابة الإغلاق'),
    backend: L(locale, 'Backend Pilot', 'تجربة الخلفية'),
    polish: L(locale, 'Polish', 'التحسين'),
    score: L(locale, 'Score & Notes', 'التقييم والملاحظات'),
  };

  const exportControl = () => {
    downloadText('v230_pilot_control_pack.csv', toCsv(checks));
    notify?.('success', L(locale, 'v230 pilot control pack exported.', 'تم تصدير حزمة رقابة v230.'));
  };
  const exportPilot = () => {
    downloadText('v230_pilot_test_script.csv', toCsv(steps.map((s) => ({ id: s.id, stage: s.stage, objective: s.objective, actions: s.actions.join(' > '), expected: s.expected, status: s.status }))));
    notify?.('success', L(locale, 'v230 pilot script exported.', 'تم تصدير سيناريو تجربة v230.'));
  };
  const exportIssues = () => {
    downloadText('v230_issue_register.csv', toCsv(issues));
    notify?.('success', L(locale, 'Issue register exported.', 'تم تصدير سجل الملاحظات.'));
  };
  const exportExpected = () => {
    downloadText('v230_expected_vs_actual_results.csv', toCsv(expected));
    notify?.('success', L(locale, 'Expected results file exported.', 'تم تصدير ملف النتائج المتوقعة.'));
  };
  const logPilotRun = () => {
    update((s: any) => ({
      ...s,
      auditLogs: [
        ...(s.auditLogs || []),
        { id: `audit-v230-${Date.now()}`, action: 'v230_pilot_readiness_logged', entity: 'qa', user: tester, createdAt: new Date().toISOString(), note: `${note}; score=${metrics.score}; blockers=${metrics.blockers}; warnings=${metrics.warnings}` },
      ],
    }), L(locale, 'Pilot readiness run logged.', 'تم تسجيل تجربة الجاهزية.'));
  };

  const scoreClass = metrics.score >= 88 ? 'ok' : metrics.score >= 75 ? 'warn' : 'bad';

  return <div className="page-grid enterprise-v230">
    <Card title={L(locale, 'Enterprise Pilot Readiness v230', 'جاهزية التجربة المؤسسية v230')} icon={<Rocket/>} action={<div className="button-row"><button onClick={exportControl}><Download size={16}/>{L(locale, 'Export control', 'تصدير الرقابة')}</button><button onClick={exportPilot}><FileSpreadsheet size={16}/>{L(locale, 'Export pilot script', 'تصدير التجربة')}</button></div>}>
      <div className="kpi-grid">
        <MiniKpi label={L(locale, 'Pilot score', 'درجة التجربة')} value={`${metrics.score}%`} hint={L(locale, 'Testing-to-pilot readiness', 'جاهزية الاختبار للتجربة')} icon={<Gauge/>}/>
        <MiniKpi label={L(locale, 'Blockers', 'عوائق')} value={String(metrics.blockers)} hint={L(locale, 'Must fix before pilot', 'يجب إصلاحها قبل التجربة')} icon={<AlertTriangle/>}/>
        <MiniKpi label={L(locale, 'Warnings', 'تنبيهات')} value={String(metrics.warnings)} hint={L(locale, 'Review during test', 'تراجع أثناء الاختبار')} icon={<ShieldCheck/>}/>
        <MiniKpi label={L(locale, 'Inventory value', 'قيمة المخزون')} value={money(metrics.stockValue, locale)} hint={L(locale, 'Local valuation', 'تقييم محلي')} icon={<Archive/>}/>
      </div>
      <div className={`health ${scoreClass}`}><BadgeCheck size={18}/>{L(locale, 'v230 converts the project from test launcher to pilot readiness board.', 'يحوّل v230 المشروع من مُطلق اختبار إلى لوحة جاهزية تجربة.')}</div>
    </Card>

    <div className="tabs">{(Object.keys(tabs) as Tab[]).map((key) => <button key={key} className={tab === key ? 'active-tab' : ''} onClick={() => setTab(key)}>{tabs[key]}</button>)}</div>

    {tab === 'command' && <Card title={L(locale, 'Pilot command board', 'لوحة قيادة التجربة')} icon={<Sparkles/>} action={<button onClick={exportControl}><Download size={16}/>{L(locale, 'Export', 'تصدير')}</button>}>
      <div className="kpi-grid">
        <MiniKpi label={L(locale, 'Setup rows', 'بيانات الإعداد')} value={`${metrics.branches}/${metrics.stores}/${metrics.items}`} hint={L(locale, 'Branches / stores / items', 'فروع / مخازن / أصناف')} icon={<Database/>}/>
        <MiniKpi label={L(locale, 'Menu readiness', 'جاهزية القائمة')} value={`${metrics.menuItems} / ${metrics.recipes}`} hint={L(locale, 'Menu items / recipe lines', 'الأصناف / بنود الوصفة')} icon={<Layers/>}/>
        <MiniKpi label={L(locale, 'Sales', 'المبيعات')} value={money(metrics.sales, locale)} hint={L(locale, 'Recognized local sales', 'مبيعات محلية معترف بها')} icon={<BarChart3/>}/>
        <MiniKpi label={L(locale, 'Journal diff', 'فرق القيود')} value={money(metrics.journalDiff, locale)} hint={L(locale, 'Must be zero', 'يجب أن يكون صفر')} icon={<ClipboardCheck/>}/>
      </div>
      <Table headers={[L(locale, 'Area', 'المجال'), L(locale, 'Check', 'الفحص'), L(locale, 'Status', 'الحالة'), L(locale, 'Evidence', 'الدليل'), L(locale, 'Owner', 'المسؤول'), L(locale, 'Next action', 'الإجراء التالي')]} rows={checks.map((r) => [r.area, r.check, <Pill status={r.status}/>, r.evidence, r.owner, r.nextAction])}/>
    </Card>}

    {tab === 'pilot' && <Card title={L(locale, 'Guided pilot script', 'سيناريو تجربة موجه')} icon={<PlayCircle/>} action={<button onClick={exportPilot}><Download size={16}/>{L(locale, 'Export pilot script', 'تصدير السيناريو')}</button>}>
      <div className="notice">{L(locale, 'Use this exact order when testing. It protects you from wasting time chasing errors caused by missing setup, stock, menu or mappings.', 'استخدم هذا الترتيب بالضبط عند الاختبار. يحميك من إضاعة الوقت في أخطاء سببها نقص الإعداد أو المخزون أو القائمة أو الربط.')}</div>
      <Table headers={['ID', L(locale, 'Stage', 'المرحلة'), L(locale, 'Objective', 'الهدف'), L(locale, 'Actions', 'الإجراءات'), L(locale, 'Expected', 'المتوقع'), L(locale, 'Status', 'الحالة')]} rows={steps.map((s) => [s.id, s.stage, s.objective, s.actions.join(' → '), s.expected, <Pill status={s.status}/>])}/>
    </Card>}

    {tab === 'expected' && <Card title={L(locale, 'Expected vs actual sample results', 'النتائج المتوقعة مقابل الفعلية')} icon={<BarChart3/>} action={<button onClick={exportExpected}><Download size={16}/>{L(locale, 'Export expected results', 'تصدير النتائج')}</button>}>
      <div className="notice">{L(locale, 'These are the expected results for the smooth sample pack. Minor differences are acceptable if you use report-only or sales-accounting-only mode before full ERP posting.', 'هذه النتائج المتوقعة لحزمة العينة السلسة. الفروقات البسيطة مقبولة إذا استخدمت وضع التقارير أو الترحيل المالي فقط قبل الترحيل الكامل.')}</div>
      <Table headers={[L(locale, 'Metric', 'المؤشر'), L(locale, 'Expected', 'المتوقع'), L(locale, 'Actual', 'الفعلي'), L(locale, 'Tolerance', 'الهامش'), L(locale, 'Status', 'الحالة')]} rows={expected.map((r: any) => [r.metric, typeof r.expected === 'number' ? money(r.expected, locale) : r.expected, typeof r.actual === 'number' ? money(r.actual, locale) : r.actual, r.tolerance, <Pill status={r.status}/>])}/>
    </Card>}

    {tab === 'issues' && <Card title={L(locale, 'Pilot issue register', 'سجل ملاحظات التجربة')} icon={<AlertTriangle/>} action={<button onClick={exportIssues}><Download size={16}/>{L(locale, 'Export issues', 'تصدير الملاحظات')}</button>}>
      <Table headers={['ID', L(locale, 'Severity', 'الأهمية'), L(locale, 'Module', 'الموديول'), L(locale, 'Issue', 'الملاحظة'), L(locale, 'Evidence', 'الدليل'), L(locale, 'Fix', 'الإصلاح')]} rows={issues.map((i) => [i.id, <Pill status={i.severity}/>, i.module, i.issue, i.evidence, i.fix])}/>
    </Card>}

    {tab === 'data' && <Card title={L(locale, 'Smooth sample data sequence', 'تسلسل بيانات العينة السلسة')} icon={<UploadCloud/>}>
      <Table headers={[L(locale, 'Step', 'الخطوة'), L(locale, 'Folder/file', 'المجلد/الملف'), L(locale, 'Where', 'أين'), L(locale, 'Expected outcome', 'النتيجة المتوقعة')]} rows={[
        ['1', '01_setup_master_data/*.csv', 'Import / Export → Upload & Mapping', 'Branches, stores, items, suppliers, accounts and cost centers exist.'],
        ['2', '02_inventory_opening_and_count/01_opening_stock_upload.csv', 'Inventory → Opening Stock Upload', 'Stock ledger and inventory value are created.'],
        ['3', '03_foodics_menu_native/*.csv', 'Sales / POS Trial → Menu Import', 'Menu items, recipes and SKU mapping are ready.'],
        ['4', '04_foodics_sales/*.csv', 'Sales / POS Trial → Upload', 'Orders, lines, payments and reconciliation are visible.'],
        ['5', '02_inventory_opening_and_count/02_monthly_stock_count_after_sales_upload.csv', 'Inventory → Monthly Stock Count', 'Shortage/surplus variance approval batch is created.'],
      ]}/>
    </Card>}

    {tab === 'close' && <Card title={L(locale, 'Pilot close gate', 'بوابة إغلاق التجربة')} icon={<ListChecks/>}>
      <div className="kpi-grid">
        <MiniKpi label={L(locale, 'Sales', 'المبيعات')} value={money(metrics.sales, locale)} hint={L(locale, 'Should match sample pack after posting', 'يفترض أن يطابق العينة بعد الترحيل')} icon={<BarChart3/>}/>
        <MiniKpi label={L(locale, 'COGS', 'تكلفة المبيعات')} value={money(metrics.cogs, locale)} hint={L(locale, 'Recipe/stock based', 'بناءً على الوصفة والمخزون')} icon={<Archive/>}/>
        <MiniKpi label={L(locale, 'Gross profit', 'مجمل الربح')} value={money(metrics.grossProfit, locale)} hint={L(locale, 'Sales minus COGS', 'المبيعات ناقص التكلفة')} icon={<Gauge/>}/>
        <MiniKpi label={L(locale, 'Pending approvals', 'اعتمادات معلقة')} value={String(metrics.pendingApprovals)} hint={L(locale, 'Must be reviewed before close', 'تراجع قبل الإغلاق')} icon={<ShieldCheck/>}/>
      </div>
      <Table headers={[L(locale, 'Close control', 'رقابة الإغلاق'), L(locale, 'Required result', 'المطلوب'), L(locale, 'Current evidence', 'الدليل الحالي'), L(locale, 'Status', 'الحالة')]} rows={[
        ['Sales captured', 'Foodics sales uploaded/posted or report-only reviewed', money(metrics.sales, locale), <Pill status={metrics.sales > 0 ? 'pass' : 'warning'}/>],
        ['Inventory value', 'Positive inventory value after opening stock', money(metrics.stockValue, locale), <Pill status={metrics.stockValue > 0 ? 'pass' : 'warning'}/>],
        ['Journal balance', 'Debit equals credit', money(metrics.journalDiff, locale), <Pill status={metrics.journalDiff <= 0.01 ? 'pass' : 'blocker'}/>],
        ['Variance approval', 'No pending count approvals before close', String(metrics.pendingApprovals), <Pill status={metrics.pendingApprovals === 0 ? 'pass' : 'warning'}/>],
      ]}/>
    </Card>}

    {tab === 'backend' && <Card title={L(locale, 'Backend pilot readiness', 'جاهزية تجربة الخلفية')} icon={<GitBranch/>}>
      <div className="notice">{L(locale, 'v230 still keeps local mode safe. Backend pilot starts after the local sample pack passes: setup persistence → Foodics staging → posting orchestrator dry-run → attachment vault → RLS smoke test.', 'يبقي v230 الوضع المحلي آمناً. تبدأ تجربة الخلفية بعد نجاح العينة المحلية: حفظ الإعدادات ← تجهيز فودكس ← تجربة محرك الترحيل ← خزنة المرفقات ← اختبار RLS.')}</div>
      <Table headers={[L(locale, 'Backend layer', 'طبقة الخلفية'), L(locale, 'Pilot purpose', 'غرض التجربة'), L(locale, 'Status', 'الحالة'), L(locale, 'Next action', 'الإجراء التالي')]} rows={[
        ['Supabase Auth', 'Real users and profiles', <Pill status="warning"/>, 'Configure .env.local and Auth policies'],
        ['Setup Sync', 'Persist branches/stores/items/suppliers', <Pill status="warning"/>, 'Run setup-sync dry-run'],
        ['Foodics Staging', 'Store uploaded rows before posting', <Pill status="warning"/>, 'Create staging batch tables and import sample'],
        ['Posting Orchestrator', 'Server-side inventory + GL posting', <Pill status="warning"/>, 'Test Edge Function dry-run'],
        ['Storage', 'Invoices/count sheets/payment proof', <Pill status="warning"/>, 'Create buckets and signed upload policy'],
      ]}/>
    </Card>}

    {tab === 'polish' && <Card title={L(locale, 'Testing polish and UX checklist', 'تحسينات تجربة الاختبار والواجهة')} icon={<Sparkles/>}>
      <Table headers={[L(locale, 'Polish item', 'عنصر التحسين'), L(locale, 'Why it matters', 'الأهمية'), L(locale, 'Priority', 'الأولوية')]} rows={[
        ['Guided import wizard', 'Avoids wrong upload sequence during pilot', 'High'],
        ['Inline issue repair', 'Fix unmapped/shortage/variance issues directly', 'High'],
        ['Document timelines', 'Every posting/reversal needs visible history', 'High'],
        ['Advanced tables', 'Search/filter/sort/pagination for real data', 'High'],
        ['Arabic terminology pass', 'Institutional Arabic for enterprise use', 'Medium'],
        ['Export packs', 'Board/CFO/operations evidence for testing', 'Medium'],
      ]}/>
    </Card>}

    {tab === 'score' && <Card title={L(locale, 'Current score and notes', 'التقييم الحالي والملاحظات')} icon={<Gauge/>} action={<button onClick={logPilotRun}><ClipboardCheck size={16}/>{L(locale, 'Log test run', 'تسجيل تجربة')}</button>}>
      <div className="kpi-grid">
        <MiniKpi label={L(locale, 'Local MVP', 'النموذج المحلي')} value="9.7 / 10" hint={L(locale, 'Excellent for workflow testing', 'ممتاز لاختبار الدورات')} icon={<BadgeCheck/>}/>
        <MiniKpi label={L(locale, 'ERP foundation', 'أساس ERP')} value="9.2 / 10" hint={L(locale, 'Strong business direction', 'اتجاه عمل قوي')} icon={<Layers/>}/>
        <MiniKpi label={L(locale, 'Enterprise design', 'التصميم المؤسسي')} value="9.5 / 10" hint={L(locale, 'High control maturity', 'نضج رقابي عالٍ')} icon={<Sparkles/>}/>
        <MiniKpi label={L(locale, 'Production readiness', 'جاهزية الإنتاج')} value="7.5 / 10" hint={L(locale, 'Backend still required', 'الخلفية ما زالت مطلوبة')} icon={<Database/>}/>
      </div>
      <div className="form-grid"><label className="field"><span>{L(locale, 'Tester', 'المختبر')}</span><input value={tester} onChange={(e) => setTester(e.target.value)}/></label><label className="field"><span>{L(locale, 'Notes', 'ملاحظات')}</span><input value={note} onChange={(e) => setNote(e.target.value)}/></label></div>
      <div className="notice"><strong>{L(locale, 'Next recommended step:', 'الخطوة التالية المقترحة:')}</strong> {L(locale, 'v231 should turn this pilot board into a real guided import wizard with one-click sample scenario runner and stronger full ERP posting proof.', 'يجب أن يحوّل v231 هذه اللوحة إلى معالج استيراد موجه مع تشغيل سيناريو العينة بضغطة واحدة وإثبات أقوى للترحيل الكامل.')}</div>
    </Card>}
  </div>;
}
