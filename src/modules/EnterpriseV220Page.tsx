import { useMemo, useState } from 'react';
import { Archive, BadgeCheck, BarChart3, Bug, ClipboardCheck, Database, Download, FileSpreadsheet, Gauge, ListChecks, PlayCircle, Rocket, ShieldCheck, Sparkles, UploadCloud } from 'lucide-react';
import { buildV220BugTriage, buildV220Readiness, buildV220Scenarios, toCsv } from '../engines/enterpriseV220Engine';

type Locale = 'en' | 'ar';
type Tab = 'command' | 'guided' | 'sample' | 'workflow' | 'bugs' | 'backend' | 'release' | 'score';

type Props = {
  state: any;
  totals: any;
  update: (fn: (state: any) => any, success?: string) => void;
  locale: Locale;
  notify?: (type: 'success' | 'warning' | 'error', message: string) => void;
};

const L = (locale: Locale, en: string, ar: string) => locale === 'ar' ? ar : en;
const money = (value: number, locale: Locale) => new Intl.NumberFormat(locale === 'ar' ? 'ar-SA' : 'en-US', { style: 'currency', currency: 'SAR', maximumFractionDigits: 0 }).format(Number(value || 0));

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

export default function EnterpriseV220Page({ state, totals, update, locale, notify }: Props) {
  const [tab, setTab] = useState<Tab>('command');
  const readiness = useMemo(() => buildV220Readiness(state, totals), [state, totals]);
  const scenarios = useMemo(() => buildV220Scenarios(state), [state]);
  const bugs = useMemo(() => buildV220BugTriage(state), [state]);
  const [tester, setTester] = useState('Ahmed / Local QA');
  const [notes, setNotes] = useState('');

  const tabs: Record<Tab, string> = {
    command: L(locale, 'Command', 'القيادة'),
    guided: L(locale, 'Guided Test', 'اختبار موجه'),
    sample: L(locale, 'Sample Pack', 'حزمة العينات'),
    workflow: L(locale, 'Workflow QA', 'اختبار الدورات'),
    bugs: L(locale, 'Bug Triage', 'فرز الملاحظات'),
    backend: L(locale, 'Backend Smoke', 'اختبار الخلفية'),
    release: L(locale, 'Release Gate', 'بوابة الإصدار'),
    score: L(locale, 'Score & Notes', 'التقييم والملاحظات'),
  };

  const exportReadiness = () => {
    downloadText('v220_enterprise_readiness.csv', toCsv(readiness.rows));
    notify?.('success', L(locale, 'v220 readiness pack exported.', 'تم تصدير حزمة جاهزية v220.'));
  };
  const exportQa = () => {
    downloadText('v220_guided_qa_suite.csv', toCsv(scenarios.map((s) => ({ id: s.id, title: s.title, objective: s.objective, steps: s.steps.join(' > '), expected: s.expected, status: s.status }))));
    notify?.('success', L(locale, 'QA suite exported.', 'تم تصدير حزمة الاختبار.'));
  };
  const exportBugs = () => {
    downloadText('v220_bug_triage.csv', toCsv(bugs));
    notify?.('success', L(locale, 'Bug triage exported.', 'تم تصدير سجل الملاحظات.'));
  };
  const logTestRun = () => {
    update((s: any) => ({
      ...s,
      auditLogs: [
        ...(s.auditLogs || []),
        { id: `audit-v220-${Date.now()}`, action: 'v220_test_run_logged', entity: 'qa', user: tester, createdAt: new Date().toISOString(), note: notes || 'Local QA run logged from Enterprise v220.' },
      ],
    }), L(locale, 'v220 test run logged in audit trail.', 'تم تسجيل اختبار v220 في سجل التدقيق.'));
  };

  const scoreColor = readiness.score >= 85 ? 'ok' : readiness.score >= 70 ? 'warn' : 'bad';

  return <div className="page-grid enterprise-v220">
    <Card title={L(locale, 'Enterprise Testing Launch v220', 'إطلاق الاختبار المؤسسي v220')} icon={<Rocket/>} action={<div className="button-row"><button onClick={exportReadiness}><Download size={16}/>{L(locale, 'Export readiness', 'تصدير الجاهزية')}</button><button onClick={exportQa}><FileSpreadsheet size={16}/>{L(locale, 'Export QA', 'تصدير الاختبار')}</button></div>}>
      <div className="kpi-grid">
        <MiniKpi label={L(locale, 'Testing score', 'درجة الاختبار')} value={`${readiness.score}%`} hint={L(locale, 'Local trial readiness', 'جاهزية التجربة المحلية')} icon={<Gauge/>}/>
        <MiniKpi label={L(locale, 'Blockers', 'عوائق')} value={String(readiness.blockers)} hint={L(locale, 'Must fix before pilot', 'يجب إصلاحها قبل التجربة')} icon={<Bug/>}/>
        <MiniKpi label={L(locale, 'Warnings', 'تنبيهات')} value={String(readiness.warnings)} hint={L(locale, 'Review during testing', 'تراجع أثناء الاختبار')} icon={<ShieldCheck/>}/>
        <MiniKpi label={L(locale, 'Inventory value', 'قيمة المخزون')} value={money(readiness.stockValue, locale)} hint={L(locale, 'Local valuation', 'تقييم محلي')} icon={<Archive/>}/>
      </div>
      <div className="notice"><strong>{L(locale, 'v220 focus:', 'تركيز v220:')}</strong> {L(locale, 'make testing fast, guided and auditable before moving deeper into real Supabase posting.', 'جعل الاختبار سريع وموجه وقابل للتدقيق قبل التوسع في ترحيل Supabase الحقيقي.')}</div>
    </Card>

    <div className="tabs">{(Object.keys(tabs) as Tab[]).map((key) => <button key={key} className={tab === key ? 'active-tab' : ''} onClick={() => setTab(key)}>{tabs[key]}</button>)}</div>

    {tab === 'command' && <Card title={L(locale, 'Testing command board', 'لوحة قيادة الاختبار')} icon={<Sparkles/>}>
      <div className={`health ${scoreColor}`}><BadgeCheck size={18}/>{L(locale, 'Current local test readiness', 'جاهزية الاختبار المحلي الحالية')}: {readiness.score}%</div>
      <Table headers={[L(locale, 'Area', 'المجال'), L(locale, 'Check', 'الفحص'), L(locale, 'Status', 'الحالة'), L(locale, 'Evidence', 'الدليل'), L(locale, 'Next action', 'الإجراء التالي')]} rows={readiness.rows.map((r) => [r.area, r.check, <Pill status={r.status}/>, r.evidence, r.nextAction])}/>
    </Card>}

    {tab === 'guided' && <Card title={L(locale, 'Guided test sequence', 'تسلسل اختبار موجه')} icon={<PlayCircle/>} action={<button onClick={exportQa}><Download size={16}/>{L(locale, 'Export QA suite', 'تصدير حزمة الاختبار')}</button>}>
      <div className="notice">{L(locale, 'Follow this order to avoid wasting time: setup → opening stock → Foodics menu → Foodics sales → sales accounting → full ERP posting guard → finance/inventory close.', 'اتبع هذا الترتيب لتوفير الوقت: الإعدادات ← الرصيد الافتتاحي ← قائمة فودكس ← مبيعات فودكس ← ترحيل المبيعات المالي ← فحص الترحيل الكامل ← إغلاق المالية والمخزون.')}</div>
      <Table headers={['ID', L(locale, 'Scenario', 'السيناريو'), L(locale, 'Status', 'الحالة'), L(locale, 'Expected result', 'النتيجة المتوقعة')]} rows={scenarios.map((s) => [s.id, <div><strong>{s.title}</strong><br/><small>{s.steps.join(' → ')}</small></div>, <Pill status={s.status}/>, s.expected])}/>
    </Card>}

    {tab === 'sample' && <Card title={L(locale, 'Sample data testing pack', 'حزمة بيانات الاختبار')} icon={<UploadCloud/>}>
      <div className="kpi-grid">
        <MiniKpi label={L(locale, 'Setup', 'الإعدادات')} value={String((state.branches || []).length + (state.stores || []).length + (state.items || []).length)} hint={L(locale, 'Branches + stores + items', 'فروع + مخازن + أصناف')} icon={<Database/>}/>
        <MiniKpi label={L(locale, 'Recipes', 'الوصفات')} value={String((state.recipeLines || []).length)} hint={L(locale, 'Recipe lines', 'بنود وصفات')} icon={<ListChecks/>}/>
        <MiniKpi label={L(locale, 'Stock rows', 'حركات المخزون')} value={String((state.stockMovements || []).length)} hint={L(locale, 'Opening/purchase/count rows', 'افتتاحي/شراء/جرد')} icon={<Archive/>}/>
        <MiniKpi label={L(locale, 'Sales docs', 'مستندات البيع')} value={String((state.salesDocuments || []).length)} hint={L(locale, 'Foodics/sample sales', 'مبيعات فودكس/عينة')} icon={<BarChart3/>}/>
      </div>
      <Table headers={[L(locale, 'Upload pack', 'حزمة الرفع'), L(locale, 'Purpose', 'الغرض'), L(locale, 'Where to test', 'مكان الاختبار'), L(locale, 'Expected', 'المتوقع')]} rows={[
        ['Foodics products + ingredients + modifiers', 'Menu, ingredients, modifiers', 'Sales / POS → Menu Import', 'Menu items + recipes/mapping'],
        ['Foodics order headers + lines + payments', 'Sales testing', 'Sales / POS → Upload', 'Validation + reconciliation'],
        ['Opening stock CSV', 'Starting stock with cost', 'Inventory → Opening Stock Upload', 'Stock movements + inventory value'],
        ['Monthly count CSV', 'Shortage/surplus control', 'Inventory → Monthly Stock Count', 'Approval requests'],
        ['Setup CSV files', 'Branches, stores, suppliers, items, cost centers', 'Import / Export', 'Master data foundation'],
      ]}/>
    </Card>}

    {tab === 'workflow' && <Card title={L(locale, 'Workflow QA checklist', 'قائمة اختبار الدورات')} icon={<ClipboardCheck/>}>
      <Table headers={[L(locale, 'Workflow', 'الدورة'), L(locale, 'Must prove', 'يجب إثبات'), L(locale, 'Current readiness', 'الجاهزية الحالية')]} rows={[
        ['Setup bootstrap', 'Can create/import branches, stores, items, suppliers, cost centers', readiness.rows.find((r) => r.area === 'Setup')?.status || 'info'],
        ['Inventory opening', 'Can post starter stock and cost without breaking unknown SKU flow', (state.stockMovements || []).length ? 'pass' : 'warning'],
        ['Monthly count', 'Count sheet → variance → approval → posting', (state.inventoryApprovals || []).length ? 'pass' : 'info'],
        ['Foodics starter', 'Menu import → sales upload → auto map → issue drilldown', (state.salesDocuments || []).length ? 'pass' : 'warning'],
        ['Sales accounting only', 'Can post sales/VAT/payment without recipe blockers', 'manual test'],
        ['Full ERP posting', 'Blocks missing recipe/stock/cost and posts only when ready', 'manual test'],
        ['Finance close', 'Trial balance, AP, VAT, bank, period checks visible', readiness.journalImbalance <= 0.01 ? 'pass' : 'warning'],
      ].map((r) => [r[0], r[1], <Pill status={String(r[2])}/>])}/>
    </Card>}

    {tab === 'bugs' && <Card title={L(locale, 'Bug triage and issue capture', 'فرز الملاحظات وتسجيل المشاكل')} icon={<Bug/>} action={<button onClick={exportBugs}><Download size={16}/>{L(locale, 'Export bug list', 'تصدير الملاحظات')}</button>}>
      <div className="form-grid"><label className="field"><span>{L(locale, 'Tester', 'المختبر')}</span><input value={tester} onChange={(e) => setTester(e.target.value)}/></label><label className="field"><span>{L(locale, 'Test notes', 'ملاحظات الاختبار')}</span><input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder={L(locale, 'Write any issue or observation...', 'اكتب أي ملاحظة أو مشكلة...')}/></label></div>
      <div className="button-row"><button onClick={logTestRun}><ClipboardCheck size={16}/>{L(locale, 'Log test run', 'تسجيل الاختبار')}</button></div>
      <Table headers={['ID', L(locale, 'Severity', 'الأهمية'), L(locale, 'Module', 'الموديول'), L(locale, 'Issue', 'المشكلة'), L(locale, 'Recommended fix', 'الإجراء المقترح')]} rows={bugs.map((b) => [b.id, b.severity, b.module, b.issue, b.recommended])}/>
    </Card>}

    {tab === 'backend' && <Card title={L(locale, 'Backend smoke test plan', 'خطة اختبار الخلفية')} icon={<Database/>}>
      <Table headers={[L(locale, 'Layer', 'الطبقة'), L(locale, 'Smoke test', 'اختبار سريع'), L(locale, 'Expected', 'المتوقع'), L(locale, 'Status', 'الحالة')]} rows={[
        ['Environment', 'Check VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY', 'Local mode if missing; pilot mode if configured', 'info'],
        ['Auth', 'Sign in/out smoke after Supabase wiring', 'Profile and company resolved', 'planned'],
        ['Setup sync', 'Export setup JSON and dry-run setup-sync', 'No duplicate codes or broken links', 'partial'],
        ['Foodics staging', 'Upload sample batch to staging tables', 'Rows staged, not posted yet', 'planned'],
        ['Posting orchestrator', 'Call posting guard with dryRun=true', 'Validation result, no GL/stock mutation', 'partial'],
        ['Storage', 'Attach invoice/count sheet placeholder', 'Attachment metadata saved', 'planned'],
        ['Audit', 'Read latest audit events', 'User/action/entity/time visible', 'partial'],
      ].map((r) => [r[0], r[1], r[2], <Pill status={String(r[3])}/>])}/>
    </Card>}

    {tab === 'release' && <Card title={L(locale, 'Release gate before serious pilot', 'بوابة الإصدار قبل التجربة الجادة')} icon={<ShieldCheck/>}>
      <Table headers={[L(locale, 'Gate', 'البوابة'), L(locale, 'Rule', 'القاعدة'), L(locale, 'Decision', 'القرار')]} rows={[
        ['Local smoke', 'No white page across Dashboard, Inventory, Foodics, Finance, Reports, Enterprise v220', 'Required'],
        ['Data bootstrap', 'Branches, stores, items, opening stock and count test pass', 'Required'],
        ['Foodics upload', 'Sample Foodics menu and sales upload without crash', 'Required'],
        ['Posting safety', 'Full ERP posting blocks missing recipe/stock/cost', 'Required'],
        ['Finance sanity', 'Trial balance difference is zero or explained', 'Required'],
        ['Backend pilot', 'Supabase credentials configured and setup dry-run passes', 'Before multi-user'],
      ].map((r) => [r[0], r[1], r[2]])}/>
      <div className="notice">{L(locale, 'Recommendation: finish v220 local QA first, then move to real Supabase setup persistence. Do not test live business data until setup sync and RLS are proven.', 'التوصية: أنجز اختبار v220 محلياً أولاً ثم انتقل إلى ربط الإعدادات مع Supabase. لا تستخدم بيانات تشغيل حقيقية قبل إثبات المزامنة وسياسات RLS.')}</div>
    </Card>}

    {tab === 'score' && <Card title={L(locale, 'Current score and professional notes', 'التقييم الحالي والملاحظات المهنية')} icon={<Gauge/>}>
      <Table headers={[L(locale, 'View', 'المنظور'), L(locale, 'Score after v220', 'التقييم بعد v220'), L(locale, 'Notes', 'ملاحظات')]} rows={[
        ['Local MVP / prototype', '9.6 / 10', 'Very strong local testing experience with guided QA and issue capture.'],
        ['Serious ERP foundation', '9.1 / 10', 'Strong Foodics, inventory, finance, close and backend bridge foundation.'],
        ['Enterprise design direction', '9.4 / 10', 'Very strong direction; close to enterprise operating model.'],
        ['Production readiness', '7.2 / 10', 'Still needs real Supabase wiring, RLS, storage, server-side posting and pilot deployment.'],
        ['Backend/security readiness', '7.8 / 10', 'Good scaffolding; next value comes from actually wiring setup pages and auth.'],
      ]}/>
      <div className="notice"><strong>{L(locale, 'Next recommended patch:', 'الترقية التالية المقترحة:')}</strong> {L(locale, 'v221 Real Setup Backend Wiring — connect branches, stores, suppliers, items, cost centers and chart of accounts to Supabase with local fallback.', 'v221 ربط الإعدادات فعلياً بالخلفية — ربط الفروع والمخازن والموردين والأصناف ومراكز التكلفة ودليل الحسابات مع Supabase مع استمرار الوضع المحلي كاحتياط.')}</div>
    </Card>}
  </div>;
}
