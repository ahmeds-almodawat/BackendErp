import { useMemo, useState } from 'react';
import {
  Activity,
  AlertTriangle,
  BadgeCheck,
  CheckCircle2,
  ClipboardCheck,
  DatabaseZap,
  Download,
  FileCheck2,
  GitBranch,
  Layers3,
  LockKeyhole,
  MonitorCheck,
  Rocket,
  ShieldCheck,
  Sparkles,
  TestTube2,
  Wand2,
} from 'lucide-react';
import { buildCloseReadiness, buildDocumentLifecycle, buildExportRows, buildPostingGuardRows, buildQualityChecks, sumJournalLines } from '../engines/enterpriseQualityEngine';
import { checkPostingGuard } from '../engines/postingGuardEngine';

const L = (locale: 'en' | 'ar', en: string, ar: string) => locale === 'ar' ? ar : en;
const arr = (value: unknown): any[] => Array.isArray(value) ? value : [];
const num = (value: unknown) => Number(value || 0);
const money = (value: number) => new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 }).format(value || 0);
const today = () => new Date().toISOString().slice(0, 10);
const id = (prefix: string) => `${prefix}-${Math.random().toString(36).slice(2, 10)}`;

function exportCsv(name: string, rows: Record<string, any>[]) {
  const headers = Array.from(rows.reduce<Set<string>>((set, row) => { Object.keys(row).forEach((k) => set.add(k)); return set; }, new Set<string>()));
  const escape = (v: any) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const csv = [headers.join(','), ...rows.map((row) => headers.map((h) => escape(row[h])).join(','))].join('\n');
  const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}

function Pill({ tone, children }: { tone: 'ready' | 'warning' | 'danger' | 'info' | 'good' | 'warn' | 'bad'; children: any }) {
  const cls = tone === 'ready' || tone === 'good' ? 'good' : tone === 'danger' || tone === 'bad' ? 'bad' : tone === 'warning' || tone === 'warn' ? 'warn' : 'info';
  return <span className={`pill ${cls}`}>{children}</span>;
}

function Card({ title, icon, children, action }: { title: string; icon?: any; children: any; action?: any }) {
  return <section className="card v66-card"><div className="card-header"><div className="card-title">{icon}{title}</div>{action}</div>{children}</section>;
}

function Kpi({ label, value, hint, icon, tone = 'info' }: { label: string; value: string; hint: string; icon?: any; tone?: 'good' | 'warn' | 'bad' | 'info' }) {
  return <div className={`kpi v66-kpi ${tone}`}><div className="kpi-icon">{icon}</div><div><span>{label}</span><strong>{value}</strong><small>{hint}</small></div></div>;
}

function Table({ headers, rows }: { headers: any[]; rows: any[][] }) {
  return <div className="table-wrap"><table><thead><tr>{headers.map((h, i) => <th key={i}>{h}</th>)}</tr></thead><tbody>{rows.length ? rows.map((row, i) => <tr key={i}>{row.map((c, j) => <td key={j}>{c}</td>)}</tr>) : <tr><td colSpan={headers.length}><div className="empty">No rows</div></td></tr>}</tbody></table></div>;
}

export default function EnterpriseStabilizationPage({ state, totals, update, locale, notify }: any) {
  const [tab, setTab] = useState('command');
  const checks = useMemo(() => buildQualityChecks(state), [state]);
  const readiness = useMemo(() => buildCloseReadiness(state), [state]);
  const lifecycle = useMemo(() => buildDocumentLifecycle(state), [state]);
  const postingRows = useMemo(() => buildPostingGuardRows(state), [state]);
  const journalTotals = useMemo(() => sumJournalLines(state), [state]);
  const openPeriods = arr(state?.fiscalPeriods).filter((p) => p.status === 'open');
  const blockerCount = readiness.blockers.length;
  const warningCount = readiness.warnings.length;
  const stockMovements = arr(state?.stockMovements);
  const journals = arr(state?.journals);
  const suppliers = arr(state?.suppliers);
  const items = arr(state?.items);
  const sales = arr(state?.sales);

  const tabs = [
    ['command', L(locale, 'Command Board', 'لوحة القيادة'), <Rocket size={16}/>],
    ['posting', L(locale, 'Posting Guard', 'حارس الترحيل'), <ShieldCheck size={16}/>],
    ['lifecycle', L(locale, 'Lifecycle Engine', 'محرك دورة المستند'), <GitBranch size={16}/>],
    ['permissions', L(locale, 'Permission Enforcement', 'فرض الصلاحيات'), <LockKeyhole size={16}/>],
    ['data', L(locale, 'Data Quality', 'جودة البيانات'), <DatabaseZap size={16}/>],
    ['ui', L(locale, 'UI Polish', 'تحسين الواجهة'), <Sparkles size={16}/>],
    ['refactor', L(locale, 'Refactor Map', 'خريطة إعادة التنظيم'), <Layers3 size={16}/>],
    ['backend', L(locale, 'Backend Readiness', 'جاهزية الخلفية'), <MonitorCheck size={16}/>],
    ['qa', L(locale, 'QA Autopilot', 'اختبار تلقائي'), <TestTube2 size={16}/>],
    ['actions', L(locale, 'Safe Actions', 'إجراءات آمنة'), <Wand2 size={16}/>],
  ];

  const exportControlPack = () => exportCsv(`v66_enterprise_control_pack_${today()}.csv`, buildExportRows(state));
  const exportQaPack = () => exportCsv(`v66_qa_regression_suite_${today()}.csv`, qaRows(locale));
  const exportRefactorPack = () => exportCsv(`v66_refactor_map_${today()}.csv`, refactorRows(locale));

  const addAudit = (action: string, note: string) => update((current: any) => ({ ...current, audits: [...arr(current.audits), { id: id('AUD'), at: new Date().toISOString(), action, entity: 'v66_stabilization', ref: 'V66', user: 'Local Admin', note }] }), L(locale, 'Audit note added', 'تمت إضافة ملاحظة تدقيق'));

  const createCurrentPeriod = () => update((current: any) => {
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
    const end = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().slice(0, 10);
    const code = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    if (arr(current.fiscalPeriods).some((p) => p.code === code)) return current;
    return { ...current, fiscalPeriods: [...arr(current.fiscalPeriods), { id: id('PER'), code, nameEn: `Period ${code}`, nameAr: `فترة ${code}`, startDate: start, endDate: end, status: 'open' }] };
  }, L(locale, 'Current fiscal period created/opened', 'تم إنشاء/فتح الفترة الحالية'));

  const addGovernancePermissions = () => update((current: any) => {
    const critical = ['finance.journal.post','finance.period.lock','inventory.adjustment.approve','purchasing.grn.post','purchasing.payment.post','sales.post','access.manage','imports.manage'];
    const roles = arr(current.roles);
    if (!roles.length) {
      return { ...current, roles: [{ id: id('ROLE'), nameEn: 'System Administrator', nameAr: 'مدير النظام', description: 'Full local trial administrator', permissions: critical }] };
    }
    const first = roles[0];
    const merged = Array.from(new Set([...arr(first.permissions), ...critical]));
    return { ...current, roles: roles.map((r, idx) => idx === 0 ? { ...r, permissions: merged } : r) };
  }, L(locale, 'Critical governance permissions added to first admin role', 'تمت إضافة الصلاحيات الحرجة لأول دور إداري'));

  return <div className="page-grid v66-workspace">
    <div className="v66-hero"><div><span className="eyebrow">{L(locale, 'v66 Stabilization + Refactor + Posting Engine', 'إصدار ٦٦: الاستقرار + التنظيم + محرك الترحيل')}</span><h2>{L(locale, 'Enterprise Operating System Stabilizer', 'مثبت نظام التشغيل المؤسسي')}</h2><p>{L(locale, 'This release focuses on making the current ERP safer, cleaner and more connected before Supabase backend migration.', 'يركز هذا الإصدار على جعل النظام أكثر أمانًا وتنظيمًا وترابطًا قبل الانتقال إلى خلفية Supabase.')}</p></div><div className="v66-score"><strong>{readiness.score}%</strong><span>{L(locale, 'Close readiness', 'جاهزية الإغلاق')}</span><Pill tone={readiness.ready ? 'good' : blockerCount ? 'bad' : 'warn'}>{readiness.ready ? L(locale, 'Ready', 'جاهز') : blockerCount ? L(locale, 'Blocked', 'محجوب') : L(locale, 'Needs review', 'يحتاج مراجعة')}</Pill></div></div>

    <div className="kpi-grid">
      <Kpi label={L(locale, 'Readiness Score', 'درجة الجاهزية')} value={`${readiness.score}%`} hint={L(locale, 'Quality checks average', 'متوسط ضوابط الجودة')} icon={<BadgeCheck/>} tone={readiness.ready ? 'good' : blockerCount ? 'bad' : 'warn'} />
      <Kpi label={L(locale, 'Critical Blockers', 'عوائق حرجة')} value={`${blockerCount}`} hint={L(locale, 'Must fix before close', 'يجب إصلاحها قبل الإغلاق')} icon={<AlertTriangle/>} tone={blockerCount ? 'bad' : 'good'} />
      <Kpi label={L(locale, 'Warnings', 'تحذيرات')} value={`${warningCount}`} hint={L(locale, 'Safe for trial, not final', 'مناسبة للتجربة وليست نهائية')} icon={<Activity/>} tone={warningCount ? 'warn' : 'good'} />
      <Kpi label={L(locale, 'Documents Tracked', 'مستندات مراقبة')} value={`${lifecycle.length}`} hint={L(locale, 'Lifecycle rows detected', 'صفوف دورة المستند')} icon={<ClipboardCheck/>} tone="info" />
    </div>

    <div className="tab-row v66-tabs">{tabs.map(([key, label, icon]: any) => <button key={key} className={tab === key ? 'active-tab' : ''} onClick={() => setTab(key)}>{icon}{label}</button>)}</div>

    {tab === 'command' && <div className="page-grid two">
      <Card title={L(locale, 'Enterprise health checks', 'فحوصات صحة المؤسسة')} icon={<FileCheck2/>} action={<button onClick={exportControlPack}><Download size={16}/>{L(locale, 'Export pack', 'تصدير الحزمة')}</button>}>
        <Table headers={[L(locale, 'Area', 'المجال'), L(locale, 'Control', 'الضابط'), L(locale, 'Status', 'الحالة'), L(locale, 'Score', 'الدرجة'), L(locale, 'Next step', 'الخطوة التالية')]} rows={checks.map((c) => [c.area, c.control, <Pill tone={c.status}>{c.status}</Pill>, `${c.score}%`, c.nextStep])}/>
      </Card>
      <Card title={L(locale, 'Operating snapshot', 'لقطة التشغيل')} icon={<Activity/>}>
        <div className="v66-metric-list">
          <div><span>{L(locale, 'Branches', 'الفروع')}</span><strong>{arr(state.branches).length}</strong></div>
          <div><span>{L(locale, 'Stores', 'المخازن')}</span><strong>{arr(state.stores).length}</strong></div>
          <div><span>{L(locale, 'Items/SKUs', 'الأصناف')}</span><strong>{items.length}</strong></div>
          <div><span>{L(locale, 'Stock movements', 'حركات المخزون')}</span><strong>{stockMovements.length}</strong></div>
          <div><span>{L(locale, 'Journals', 'القيود')}</span><strong>{journals.length}</strong></div>
          <div><span>{L(locale, 'Sales docs', 'مستندات البيع')}</span><strong>{sales.length}</strong></div>
          <div><span>{L(locale, 'Suppliers', 'الموردون')}</span><strong>{suppliers.length}</strong></div>
          <div><span>{L(locale, 'Open periods', 'فترات مفتوحة')}</span><strong>{openPeriods.length}</strong></div>
        </div>
        <div className="notice"><strong>{L(locale, 'Journal control:', 'رقابة القيود:')}</strong> {L(locale, 'Debit', 'مدين')} {money(journalTotals.debit)} / {L(locale, 'Credit', 'دائن')} {money(journalTotals.credit)} / {L(locale, 'Difference', 'الفرق')} {money(journalTotals.diff)}</div>
      </Card>
    </div>}

    {tab === 'posting' && <div className="page-grid">
      <Card title={L(locale, 'Central posting guard preview', 'معاينة حارس الترحيل المركزي')} icon={<ShieldCheck/>}>
        <Table headers={[L(locale, 'Posting event', 'حدث الترحيل'), L(locale, 'Required controls', 'الضوابط المطلوبة'), L(locale, 'Current result', 'النتيجة الحالية'), L(locale, 'Action', 'الإجراء')]} rows={postingRows.map((r) => [r.event, r.required, r.current, r.action])}/>
      </Card>
      <Card title={L(locale, 'Guard test results', 'نتائج اختبار الحارس')} icon={<LockKeyhole/>}>
        <Table headers={[L(locale, 'Event', 'الحدث'), L(locale, 'Allowed?', 'مسموح؟'), L(locale, 'Blockers', 'العوائق'), L(locale, 'Warnings', 'التحذيرات'), L(locale, 'Recommended status', 'الحالة المقترحة')]} rows={['foodics_full_post','stock_count_post','supplier_payment_post','manual_journal_post','production_post'].map((key) => { const r = checkPostingGuard(state, key); return [key, <Pill tone={r.allowed ? 'good' : 'bad'}>{r.allowed ? 'Yes' : 'No'}</Pill>, r.blockers.join(' | ') || '-', r.warnings.join(' | ') || '-', r.recommendedStatus]; })}/>
      </Card>
    </div>}

    {tab === 'lifecycle' && <Card title={L(locale, 'Unified document lifecycle register', 'سجل دورة المستند الموحد')} icon={<GitBranch/>} action={<button onClick={() => exportCsv(`v66_document_lifecycle_${today()}.csv`, lifecycle)}><Download size={16}/>{L(locale, 'Export', 'تصدير')}</button>}>
      <Table headers={[L(locale, 'Module', 'الوحدة'), L(locale, 'Document', 'المستند'), L(locale, 'Reference', 'المرجع'), L(locale, 'Status', 'الحالة'), L(locale, 'Risk', 'المخاطر'), L(locale, 'Next action', 'الإجراء التالي')]} rows={lifecycle.map((r) => [r.module, r.document, r.ref, r.status, <Pill tone={r.risk}>{r.risk}</Pill>, r.nextAction])}/>
    </Card>}

    {tab === 'permissions' && <Card title={L(locale, 'Universal permission enforcement map', 'خريطة فرض الصلاحيات الشاملة')} icon={<LockKeyhole/>}>
      <Table headers={[L(locale, 'Critical action', 'الإجراء الحرج'), L(locale, 'Permission key', 'مفتاح الصلاحية'), L(locale, 'Current coverage', 'التغطية الحالية'), L(locale, 'Enterprise rule', 'قاعدة المؤسسة')]} rows={permissionRows(state, locale)}/>
    </Card>}

    {tab === 'data' && <Card title={L(locale, 'Data-quality governance workbench', 'منصة حوكمة جودة البيانات')} icon={<DatabaseZap/>}>
      <Table headers={[L(locale, 'Area', 'المجال'), L(locale, 'Issue', 'المشكلة'), L(locale, 'Status', 'الحالة'), L(locale, 'Recommended fix', 'الإصلاح المقترح')]} rows={checks.filter((c) => ['Master Data','Suppliers','Inventory'].includes(c.area)).map((c) => [c.area, c.detail, <Pill tone={c.status}>{c.status}</Pill>, c.nextStep])}/>
    </Card>}

    {tab === 'ui' && <Card title={L(locale, 'Enterprise UI polish checklist', 'قائمة تحسين الواجهة المؤسسية')} icon={<Sparkles/>}>
      <Table headers={[L(locale, 'UI pattern', 'نمط الواجهة'), L(locale, 'Current level', 'المستوى الحالي'), L(locale, 'Needed for enterprise', 'المطلوب للمؤسسة'), L(locale, 'Priority', 'الأولوية')]} rows={uiRows(locale)}/>
    </Card>}

    {tab === 'refactor' && <Card title={L(locale, 'Modular refactor roadmap', 'خارطة إعادة تنظيم الكود')} icon={<Layers3/>} action={<button onClick={exportRefactorPack}><Download size={16}/>{L(locale, 'Export map', 'تصدير الخريطة')}</button>}>
      <Table headers={[L(locale, 'Package', 'الحزمة'), L(locale, 'Move from', 'النقل من'), L(locale, 'Move to', 'النقل إلى'), L(locale, 'Why', 'السبب'), L(locale, 'Risk', 'المخاطر')]} rows={refactorRows(locale).map((r) => [r.package, r.move_from, r.move_to, r.why, <Pill tone={r.risk === 'Low' ? 'good' : r.risk === 'Medium' ? 'warn' : 'bad'}>{r.risk}</Pill>])}/>
    </Card>}

    {tab === 'backend' && <Card title={L(locale, 'Supabase production launch blueprint', 'مخطط إطلاق Supabase الإنتاجي')} icon={<MonitorCheck/>}>
      <Table headers={[L(locale, 'Layer', 'الطبقة'), L(locale, 'Build item', 'عنصر البناء'), L(locale, 'Why it matters', 'الأهمية'), L(locale, 'Readiness', 'الجاهزية')]} rows={backendRows(locale)}/>
    </Card>}

    {tab === 'qa' && <Card title={L(locale, 'QA autopilot regression suite', 'حزمة الاختبار التلقائي')} icon={<TestTube2/>} action={<button onClick={exportQaPack}><Download size={16}/>{L(locale, 'Export QA suite', 'تصدير الاختبارات')}</button>}>
      <Table headers={[L(locale, 'Test', 'الاختبار'), L(locale, 'Steps', 'الخطوات'), L(locale, 'Expected result', 'النتيجة المتوقعة'), L(locale, 'Priority', 'الأولوية')]} rows={qaRows(locale).map((r) => [r.test, r.steps, r.expected_result, <Pill tone={r.priority === 'High' ? 'bad' : r.priority === 'Medium' ? 'warn' : 'good'}>{r.priority}</Pill>])}/>
    </Card>}

    {tab === 'actions' && <div className="page-grid two">
      <Card title={L(locale, 'Safe local actions', 'إجراءات محلية آمنة')} icon={<Wand2/>}>
        <div className="button-row"><button onClick={() => addAudit('v66_health_review', `Readiness ${readiness.score}%, blockers ${blockerCount}, warnings ${warningCount}`)}><FileCheck2 size={16}/>{L(locale, 'Log health review', 'تسجيل مراجعة الصحة')}</button><button onClick={createCurrentPeriod}><BadgeCheck size={16}/>{L(locale, 'Create current period', 'إنشاء الفترة الحالية')}</button><button onClick={addGovernancePermissions}><LockKeyhole size={16}/>{L(locale, 'Add critical permissions', 'إضافة صلاحيات حرجة')}</button></div>
        <div className="notice warning">{L(locale, 'These actions are safe local-trial helpers. In production they must require approval and audit logs from the backend.', 'هذه إجراءات مساعدة للتجربة المحلية. في الإنتاج يجب أن تتطلب اعتمادًا وسجل تدقيق من الخلفية.')}</div>
      </Card>
      <Card title={L(locale, 'Next enterprise milestone', 'المعلم المؤسسي التالي')} icon={<Rocket/>}>
        <ol className="v66-ordered"><li>{L(locale, 'Keep v66 as stabilization checkpoint.', 'اعتبار v66 نقطة استقرار.')}</li><li>{L(locale, 'Move posting guard into all buttons.', 'تطبيق حارس الترحيل على جميع الأزرار.')}</li><li>{L(locale, 'Start Supabase Auth + schema + RLS.', 'بدء Supabase Auth + الجداول + RLS.')}</li><li>{L(locale, 'Move imports into staging tables.', 'نقل الاستيراد إلى جداول وسيطة.')}</li><li>{L(locale, 'Make audit and attachments real.', 'تفعيل التدقيق والمرفقات فعليًا.')}</li></ol>
      </Card>
    </div>}
  </div>;
}

function permissionRows(state: any, locale: 'en' | 'ar') {
  const roles = arr(state?.roles);
  const permissions = new Set(roles.flatMap((r) => arr(r.permissions)));
  const rows = [
    ['Post manual journal', 'finance.journal.post'],
    ['Lock fiscal period', 'finance.period.lock'],
    ['Approve stock count variance', 'inventory.adjustment.approve'],
    ['Post GRN', 'purchasing.grn.post'],
    ['Post supplier payment', 'purchasing.payment.post'],
    ['Post Foodics sales', 'sales.post'],
    ['Manage user access', 'access.manage'],
    ['Import master data', 'imports.manage'],
  ];
  return rows.map(([label, key]) => [label, key, <Pill tone={permissions.has(key) ? 'good' : 'warn'}>{permissions.has(key) ? L(locale, 'Covered', 'مغطى') : L(locale, 'Missing', 'ناقص')}</Pill>, L(locale, 'Require permission + scope + period + audit before action.', 'يتطلب صلاحية + نطاق + فترة + تدقيق قبل التنفيذ.')]);
}

function uiRows(locale: 'en' | 'ar') {
  return [
    [L(locale, 'Consistent page headers', 'عناوين صفحات موحدة'), L(locale, 'Good', 'جيد'), L(locale, 'Add module objective, close status and last updated timestamp.', 'إضافة هدف الوحدة وحالة الإغلاق وآخر تحديث.'), 'Medium'],
    [L(locale, 'Drawer forms', 'نماذج جانبية'), L(locale, 'Partial', 'جزئي'), L(locale, 'Use drawers for create/edit instead of long forms.', 'استخدام نماذج جانبية بدل النماذج الطويلة.'), 'High'],
    [L(locale, 'Advanced tables', 'جداول متقدمة'), L(locale, 'Partial', 'جزئي'), L(locale, 'Search/filter/sort/pagination/saved views everywhere.', 'بحث/تصفية/فرز/صفحات/عروض محفوظة في كل مكان.'), 'High'],
    [L(locale, 'Document timeline', 'خط زمني للمستند'), L(locale, 'Concept', 'تصور'), L(locale, 'Show draft/submitted/approved/posted/reversed events.', 'عرض أحداث مسودة/مرسل/معتمد/مرحل/معكوس.'), 'High'],
    [L(locale, 'Export and print', 'تصدير وطباعة'), L(locale, 'Partial', 'جزئي'), L(locale, 'Add PDF/Excel packs and professional document previews.', 'إضافة حزم PDF/Excel ومعاينات احترافية.'), 'High'],
    [L(locale, 'Arabic polish', 'تحسين العربية'), L(locale, 'Good', 'جيد'), L(locale, 'Review all accounting/control terms with Saudi business tone.', 'مراجعة كل مصطلحات المالية والرقابة بنبرة سعودية مهنية.'), 'Medium'],
  ];
}

function refactorRows(locale: 'en' | 'ar') {
  return [
    { package: 'Finance', move_from: 'App.tsx FinancePage', move_to: 'src/modules/finance', why: 'Make accounting safer and testable', risk: 'Medium' },
    { package: 'Inventory', move_from: 'App.tsx InventoryPage', move_to: 'src/modules/inventory', why: 'Centralize stock count/costing/ledger logic', risk: 'Medium' },
    { package: 'Purchasing', move_from: 'App.tsx PurchasingPage', move_to: 'src/modules/purchasing', why: 'Separate document lifecycle and variance controls', risk: 'Medium' },
    { package: 'Setup', move_from: 'App.tsx SetupPage', move_to: 'src/modules/setup', why: 'Improve import/edit/archive governance', risk: 'Low' },
    { package: 'Reports', move_from: 'App.tsx ReportsPage', move_to: 'src/modules/reports', why: 'Make reports period-aware and exportable', risk: 'Low' },
    { package: 'Posting', move_from: 'scattered functions', move_to: 'src/engines/postingGuardEngine.ts', why: 'One validation path for all postings', risk: 'High' },
    { package: 'Types', move_from: 'App.tsx type definitions', move_to: 'src/types/erp.ts', why: 'Reduce breakage and duplicate type definitions', risk: 'Medium' },
  ];
}

function backendRows(locale: 'en' | 'ar') {
  return [
    ['Auth', 'Supabase Auth + profiles + roles', 'Real users and traceability', <Pill tone="warn">Design ready</Pill>],
    ['Database', 'PostgreSQL normalized ERP schema', 'Durable multi-user data', <Pill tone="warn">SQL drafts exist</Pill>],
    ['Security', 'RLS by branch/store/cost center', 'Protect business data', <Pill tone="bad">Not built</Pill>],
    ['Posting', 'Edge Functions for posting', 'Prevent frontend manipulation', <Pill tone="bad">Not built</Pill>],
    ['Storage', 'Buckets for invoices, GRNs, bank proof, supplier docs', 'Document control', <Pill tone="bad">Not built</Pill>],
    ['Audit', 'Audit triggers and immutable logs', 'Accountability', <Pill tone="warn">Concept only</Pill>],
    ['Import', 'Staging tables + error rows + rollback', 'Safe bulk data loading', <Pill tone="warn">Concept only</Pill>],
    ['Backup', 'Backup/restore plan', 'Business continuity', <Pill tone="bad">Not built</Pill>],
  ];
}

function qaRows(locale: 'en' | 'ar') {
  return [
    { test: 'Open app with empty storage', steps: 'Clear local storage and open every sidebar module', expected_result: 'No white page; empty states show safely', priority: 'High' },
    { test: 'Load fast trial scenario', steps: 'Dashboard → Load fast trial scenario → visit Finance, Inventory, Sales, Enterprise HQ', expected_result: 'KPIs and tables populate without crash', priority: 'High' },
    { test: 'Foodics starter flow', steps: 'Upload menu + sales → auto-map SKU → Report Only → Sales Accounting Only', expected_result: 'Missing recipes warn but do not block starter posting', priority: 'High' },
    { test: 'Full ERP posting blocker', steps: 'Try Full ERP Posting with missing cost/recipe/stock', expected_result: 'System blocks only full ERP mode with clear issue buttons', priority: 'High' },
    { test: 'Opening stock upload', steps: 'Inventory → Opening Stock Upload → upload sample', expected_result: 'Unknown SKUs can be auto-created for trial and stock ledger updates', priority: 'High' },
    { test: 'Monthly stock count', steps: 'Generate count sheet → fill counted qty → upload → approval queue', expected_result: 'Shortage/surplus calculated and approval required before posting', priority: 'High' },
    { test: 'Accounting balance', steps: 'Finance → Journal Register/Trial Balance', expected_result: 'No unbalanced posted journals', priority: 'High' },
    { test: 'Enterprise v66 export', steps: 'Enterprise Stabilizer → export control/QA/refactor packs', expected_result: 'CSV files download with BOM and clear rows', priority: 'Medium' },
  ];
}
