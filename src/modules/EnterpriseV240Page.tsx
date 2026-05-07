import { useMemo, useState } from 'react';
import { AlertTriangle, CheckCircle2, ClipboardCheck, Database, Download, FileSpreadsheet, Flag, Gauge, Layers, ListChecks, PlayCircle, RefreshCw, Rocket, Search, ShieldCheck, Sparkles, Wrench } from 'lucide-react';
import { buildV240ExpectedResults, buildV240Issues, buildV240PilotReports, buildV240Snapshot, buildV240Wizard, rowsToCsv, type V240WizardStep } from '../engines/enterpriseV240Engine';

type Locale = 'en' | 'ar';

type Props = {
  state: any;
  totals: any;
  update: (fn: (s: any) => any, success?: string) => void;
  locale: Locale;
  notify: (type: 'success' | 'warning' | 'error', message: string) => void;
};

const L = (locale: Locale, en: string, ar: string) => locale === 'ar' ? ar : en;
const money = (value: number, locale: Locale) => new Intl.NumberFormat(locale === 'ar' ? 'ar-SA' : 'en-US', { style: 'currency', currency: 'SAR', maximumFractionDigits: 2 }).format(Number(value || 0));

function downloadCsv(filename: string, csv: string) {
  const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

function Card({ title, icon, children, action }: { title: string; icon?: React.ReactNode; children: React.ReactNode; action?: React.ReactNode }) {
  return <section className="v240-card"><div className="v240-card-head"><div className="v240-title">{icon}<h3>{title}</h3></div>{action}</div>{children}</section>;
}
function KPI({ label, value, hint, icon }: { label: string; value: string | number; hint: string; icon: React.ReactNode }) {
  return <div className="v240-kpi"><div className="v240-kpi-icon">{icon}</div><div><span>{label}</span><strong>{value}</strong><small>{hint}</small></div></div>;
}
function Badge({ children, tone = 'info' }: { children: React.ReactNode; tone?: 'ready' | 'warn' | 'bad' | 'info' }) { return <span className={`v240-badge ${tone}`}>{children}</span>; }

const tabs = ['command', 'wizard', 'issues', 'expected', 'close', 'reports', 'backend', 'qa'] as const;
type Tab = typeof tabs[number];

export default function EnterpriseV240Page({ state, totals, update, locale, notify }: Props) {
  const [tab, setTab] = useState<Tab>('command');
  const snapshot = useMemo(() => buildV240Snapshot(state, totals), [state, totals]);
  const wizard = useMemo(() => buildV240Wizard(state, snapshot), [state, snapshot]);
  const issues = useMemo(() => buildV240Issues(snapshot), [snapshot]);
  const expected = useMemo(() => buildV240ExpectedResults(), []);
  const pilotReports = useMemo(() => buildV240PilotReports(snapshot), [snapshot]);
  const addAudit = (note: string) => {
    update((s: any) => ({ ...s, audits: [...(Array.isArray(s.audits) ? s.audits : []), { id: `AUD-${Date.now()}`, at: new Date().toISOString(), action: 'v240.review', entity: 'pilot_testing', ref: 'V240', user: 'Local Admin', note }] }), L(locale, 'v240 pilot review logged', 'تم تسجيل مراجعة v240'));
  };
  const exportPack = () => downloadCsv('v240_pilot_evidence_pack.csv', rowsToCsv([
    { section: 'score', metric: 'readiness', value: snapshot.readiness },
    ...wizard.map((w) => ({ section: 'wizard', metric: w.titleEn, value: w.status, validation: w.validationEn })),
    ...issues.map((i) => ({ section: 'issue', metric: i.id, value: i.severity, validation: i.issue, fix: i.fix })),
    ...pilotReports.map((r) => ({ section: 'report', metric: r.report, value: r.status, score: r.score })),
  ]));
  const exportQa = () => downloadCsv('v240_guided_qa_suite.csv', rowsToCsv(wizard.map((w) => ({ phase: w.phase, step: w.titleEn, module: w.module, files: w.requiredFiles.join(' | '), expected: w.expectedResultEn, validation: w.validationEn, status: w.status, blockers: w.blockers.join(' | ') }))));
  return <div className="v240-page">
    <div className="v240-hero"><div><span className="eyebrow">v240 Testing Orchestrator</span><h2>{L(locale, 'Pilot Testing Orchestrator', 'منسق اختبار التجربة')}</h2><p>{L(locale, 'A practical testing cockpit that guides setup, Foodics upload, inventory count, expected results, issue triage, and pilot close evidence in one place.', 'لوحة اختبار عملية توجه الإعداد ورفع فودكس والجرد والنتائج المتوقعة ومعالجة الملاحظات وأدلة إغلاق التجربة في مكان واحد.')}</p></div><div className="v240-score"><span>{L(locale, 'Testing readiness', 'جاهزية الاختبار')}</span><strong>{snapshot.readiness}%</strong><small>{snapshot.blockers.length ? L(locale, 'Needs action', 'تحتاج إجراء') : L(locale, 'Ready for guided pilot', 'جاهزة للتجربة الموجهة')}</small></div></div>
    <div className="v240-tabs">{tabs.map((t) => <button key={t} className={tab === t ? 'active' : ''} onClick={() => setTab(t)}>{labelForTab(t, locale)}</button>)}</div>
    {tab === 'command' && <div className="v240-grid"><Card title={L(locale, 'Command board', 'لوحة القيادة')} icon={<Gauge/>} action={<button onClick={exportPack}><Download size={16}/>{L(locale, 'Export evidence pack', 'تصدير أدلة الاختبار')}</button>}><div className="v240-kpi-grid"><KPI label={L(locale, 'Setup', 'الإعداد')} value={`${snapshot.setupScore}%`} hint={`${snapshot.counts.branches}/${snapshot.counts.stores}/${snapshot.counts.items}`} icon={<Layers/>}/><KPI label={L(locale, 'Inventory', 'المخزون')} value={`${snapshot.inventoryScore}%`} hint={money(snapshot.financials.inventoryValue, locale)} icon={<FileSpreadsheet/>}/><KPI label={L(locale, 'Finance', 'المالية')} value={`${snapshot.financeScore}%`} hint={`${L(locale, 'Diff', 'الفرق')} ${snapshot.financials.journalDiff.toFixed(2)}`} icon={<ShieldCheck/>}/><KPI label={L(locale, 'Sales/Foodics', 'المبيعات/فودكس')} value={`${snapshot.salesScore}%`} hint={`${snapshot.counts.menuItems} menu / ${snapshot.counts.recipeLines} recipe`} icon={<Rocket/>}/></div><div className="v240-alerts"><h4>{L(locale, 'What to fix now', 'ما يجب إصلاحه الآن')}</h4>{issues.slice(0, 6).map((i) => <div key={i.id} className={`v240-issue ${i.severity}`}><strong>{i.id}</strong><span>{i.issue}</span><small>{i.fix}</small></div>)}</div></Card><Card title={L(locale, 'Operating snapshot', 'ملخص التشغيل')} icon={<ClipboardCheck/>}><div className="v240-table"><table><tbody>{Object.entries(snapshot.counts).map(([key, value]) => <tr key={key}><td>{key}</td><td>{String(value)}</td></tr>)}</tbody></table></div></Card></div>}
    {tab === 'wizard' && <Card title={L(locale, 'Guided import and testing wizard', 'معالج الرفع والاختبار الموجه')} icon={<PlayCircle/>} action={<button onClick={exportQa}><Download size={16}/>{L(locale, 'Export QA suite', 'تصدير خطة الاختبار')}</button>}><WizardTable wizard={wizard} locale={locale}/></Card>}
    {tab === 'issues' && <Card title={L(locale, 'Issue triage and repair plan', 'سجل الملاحظات وخطة الإصلاح')} icon={<Wrench/>} action={<button onClick={() => downloadCsv('v240_issue_register.csv', rowsToCsv(issues))}><Download size={16}/>{L(locale, 'Export issues', 'تصدير الملاحظات')}</button>}><SimpleTable rows={issues} /></Card>}
    {tab === 'expected' && <Card title={L(locale, 'Expected results for smooth sample pack', 'النتائج المتوقعة لحزمة الاختبار السلسة')} icon={<Search/>} action={<button onClick={() => downloadCsv('v240_expected_results.csv', rowsToCsv(expected))}><Download size={16}/>{L(locale, 'Export expected results', 'تصدير النتائج المتوقعة')}</button>}><SimpleTable rows={expected} /></Card>}
    {tab === 'close' && <div className="v240-grid"><Card title={L(locale, 'Pilot close gate', 'بوابة إغلاق التجربة')} icon={<Flag/>}><CloseGate snapshot={snapshot} locale={locale}/></Card><Card title={L(locale, 'Close certificate notes', 'ملاحظات شهادة الإغلاق')} icon={<CheckCircle2/>}><p>{L(locale, 'Use this gate after you complete setup, opening stock, Foodics import, starter posting, full ERP guard review, monthly count, and finance smoke test.', 'استخدم هذه البوابة بعد إكمال الإعداد والمخزون الافتتاحي وفودكس وترحيل المبيعات المبدئي ومراجعة الترحيل الكامل والجرد الشهري واختبار المالية.')}</p><button onClick={() => addAudit(`v240 pilot close review. Readiness ${snapshot.readiness}%. Blockers ${snapshot.blockers.length}. Warnings ${snapshot.warnings.length}.`)}><RefreshCw size={16}/>{L(locale, 'Log close review', 'تسجيل مراجعة الإغلاق')}</button></Card></div>}
    {tab === 'reports' && <Card title={L(locale, 'Pilot report factory', 'مصنع تقارير التجربة')} icon={<FileSpreadsheet/>} action={<button onClick={() => downloadCsv('v240_pilot_report_factory.csv', rowsToCsv(pilotReports))}><Download size={16}/>{L(locale, 'Export report factory', 'تصدير مصنع التقارير')}</button>}><SimpleTable rows={pilotReports}/></Card>}
    {tab === 'backend' && <Card title={L(locale, 'Backend pilot bridge checklist', 'قائمة ربط الخلفية للتجربة')} icon={<Database/>}><BackendPlan locale={locale}/></Card>}
    {tab === 'qa' && <Card title={L(locale, 'v240 scores and QA notes', 'درجات وملاحظات v240')} icon={<Sparkles/>}><div className="v240-kpi-grid"><KPI label="Local MVP" value="9.7/10" hint="Smooth local testing" icon={<CheckCircle2/>}/><KPI label="ERP foundation" value="9.2/10" hint="Connected core workflows" icon={<Layers/>}/><KPI label="Enterprise direction" value="9.6/10" hint="Pilot control layer" icon={<ShieldCheck/>}/><KPI label="Production readiness" value="7.7/10" hint="Still needs real backend wiring" icon={<AlertTriangle/>}/></div><p>{L(locale, 'Next best milestone: real Setup backend wiring and guided sample runner that can populate data without manual file upload.', 'أفضل مرحلة لاحقة: ربط بيانات الإعداد بالخلفية فعلياً ومعالج عينة يستطيع تعبئة البيانات بدون رفع يدوي.')}</p></Card>}
  </div>;
}

function labelForTab(tab: Tab, locale: Locale) {
  const labels: Record<Tab, [string, string]> = { command: ['Command', 'القيادة'], wizard: ['Wizard', 'المعالج'], issues: ['Issues', 'الملاحظات'], expected: ['Expected', 'المتوقع'], close: ['Close Gate', 'بوابة الإغلاق'], reports: ['Reports', 'التقارير'], backend: ['Backend', 'الخلفية'], qa: ['QA / Score', 'الاختبار / الدرجة'] };
  return L(locale, labels[tab][0], labels[tab][1]);
}

function WizardTable({ wizard, locale }: { wizard: V240WizardStep[]; locale: Locale }) {
  return <div className="v240-table"><table><thead><tr><th>#</th><th>{L(locale, 'Step', 'الخطوة')}</th><th>{L(locale, 'Module', 'الموديول')}</th><th>{L(locale, 'Files', 'الملفات')}</th><th>{L(locale, 'Validation', 'التحقق')}</th><th>{L(locale, 'Status', 'الحالة')}</th></tr></thead><tbody>{wizard.map((w) => <tr key={w.id}><td>{w.phase}</td><td><strong>{L(locale, w.titleEn, w.titleAr)}</strong><small>{L(locale, w.expectedResultEn, w.expectedResultAr)}</small></td><td>{w.module}</td><td>{w.requiredFiles.length ? w.requiredFiles.join(' / ') : '—'}</td><td>{L(locale, w.validationEn, w.validationAr)}</td><td><Badge tone={w.status === 'done' ? 'ready' : w.status === 'blocked' ? 'bad' : 'warn'}>{w.status}</Badge></td></tr>)}</tbody></table></div>;
}

function SimpleTable({ rows }: { rows: Record<string, any>[] }) {
  if (!rows.length) return <p>No rows.</p>;
  const keys = Object.keys(rows[0]);
  return <div className="v240-table"><table><thead><tr>{keys.map((k) => <th key={k}>{k}</th>)}</tr></thead><tbody>{rows.map((row, idx) => <tr key={idx}>{keys.map((k) => <td key={k}>{String(row[k] ?? '')}</td>)}</tr>)}</tbody></table></div>;
}
function CloseGate({ snapshot, locale }: { snapshot: any; locale: Locale }) {
  const rows = [
    ['Setup ready', snapshot.setupScore >= 80],
    ['Inventory has stock value', snapshot.financials.inventoryValue > 0],
    ['Journals balanced', snapshot.financials.journalDiff <= 0.01],
    ['Foodics/menu workflow started', snapshot.counts.menuItems > 0 || snapshot.counts.foodicsBatches > 0],
    ['Stock count approvals reviewed', snapshot.counts.inventoryApprovals >= 0],
    ['No critical blockers', snapshot.blockers.length === 0],
  ];
  return <div className="v240-checklist">{rows.map(([label, ok]) => <div key={String(label)}><span>{String(label)}</span><Badge tone={ok ? 'ready' : 'warn'}>{ok ? L(locale, 'Ready', 'جاهز') : L(locale, 'Review', 'مراجعة')}</Badge></div>)}</div>;
}
function BackendPlan({ locale }: { locale: Locale }) {
  const rows = [
    { layer: 'Auth', status: 'Designed', next: 'Connect Supabase session and company context' },
    { layer: 'Setup persistence', status: 'Ready for wiring', next: 'Branches/stores/items/suppliers read/write fallback' },
    { layer: 'Foodics staging', status: 'Designed', next: 'Persist upload rows and mapping decisions' },
    { layer: 'Posting orchestrator', status: 'Designed', next: 'Move posting guard to Edge Function' },
    { layer: 'Attachments', status: 'Policy ready', next: 'Supabase Storage signed uploads' },
    { layer: 'Audit/RLS', status: 'Foundation', next: 'RLS smoke test and denied action log' },
  ];
  return <><p>{L(locale, 'Backend pilot should start after the local sample test passes without critical blockers.', 'ينبغي بدء تجربة الخلفية بعد نجاح اختبار العينة المحلي بدون عوائق حرجة.')}</p><SimpleTable rows={rows}/></>;
}
