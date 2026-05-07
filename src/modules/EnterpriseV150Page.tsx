import { useMemo, useState, type ReactNode } from 'react';
import { AlertTriangle, BadgeCheck, BrainCircuit, ClipboardCheck, CloudCog, CreditCard, Database, Download, FileCode2, FileStack, GitBranch, Layers, LockKeyhole, PlayCircle, Rocket, ShieldCheck, Sparkles, UploadCloud } from 'lucide-react';
import { buildV150ApiContracts, buildV150BackendDomains, buildV150Command, buildV150CutoverPlan, buildV150PostingGuard, buildV150Program, buildV150QaSuite, buildV150Scores, downloadCsv, money, pct } from '../engines/enterpriseV150Engine';

type Locale = 'en' | 'ar';
type Tab = 'command' | 'program' | 'backend' | 'contracts' | 'guard' | 'approvals' | 'cutover' | 'qa' | 'scores';
type Props = { state: any; totals: any; update?: (fn: (current: any) => any, success?: string) => void; locale: Locale; notify?: (type: 'success' | 'warning' | 'error', message: string) => void };
function L(locale: Locale, en: string, ar: string) { return locale === 'ar' ? ar : en; }
function todayMonth() { return new Date().toISOString().slice(0, 7); }
function id(prefix: string) { return `${prefix}-${Math.random().toString(36).slice(2, 10)}`; }
function Pill({ tone, children }: { tone: 'good' | 'warn' | 'bad' | 'info'; children: ReactNode }) { return <span className={`pill ${tone}`}>{children}</span>; }
function Card({ title, icon, action, children }: { title: string; icon?: ReactNode; action?: ReactNode; children: ReactNode }) { return <section className="card"><div className="card-header"><div className="card-title">{icon}{title}</div>{action}</div>{children}</section>; }
function Kpi({ label, value, hint, icon, tone = 'info' }: { label: string; value: string | number; hint: string; icon: ReactNode; tone?: 'good' | 'warn' | 'bad' | 'info' }) { return <div className={`kpi-card ${tone}`}><div className="kpi-icon">{icon}</div><div><span>{label}</span><strong>{value}</strong><small>{hint}</small></div></div>; }
function Table({ headers, rows }: { headers: ReactNode[]; rows: ReactNode[][] }) { return <div className="table-wrap"><table><thead><tr>{headers.map((h, i) => <th key={i}>{h}</th>)}</tr></thead><tbody>{rows.length ? rows.map((row, r) => <tr key={r}>{row.map((cell, c) => <td key={c}>{cell}</td>)}</tr>) : <tr><td colSpan={headers.length} className="muted">No rows</td></tr>}</tbody></table></div>; }
function tone(value: string): 'good' | 'warn' | 'bad' | 'info' { const v = String(value).toLowerCase(); if (v.includes('critical') || v.includes('missing') || v.includes('block')) return 'bad'; if (v.includes('skeleton') || v.includes('blueprint') || v.includes('designed') || v.includes('warn') || v.includes('partial')) return 'warn'; if (v.includes('ready') || v.includes('included') || v.includes('clean') || v.includes('balanced')) return 'good'; return 'info'; }

export default function EnterpriseV150Page({ state, totals, update, locale, notify }: Props) {
  const [tab, setTab] = useState<Tab>('command');
  const [period, setPeriod] = useState(todayMonth());
  const command = useMemo(() => buildV150Command(state, totals), [state, totals]);
  const program = useMemo(() => buildV150Program(), []);
  const backend = useMemo(() => buildV150BackendDomains(), []);
  const contracts = useMemo(() => buildV150ApiContracts(), []);
  const guard = useMemo(() => buildV150PostingGuard(), []);
  const cutover = useMemo(() => buildV150CutoverPlan(), []);
  const qa = useMemo(() => buildV150QaSuite(), []);
  const scores = useMemo(() => buildV150Scores(), []);
  const tabs: { key: Tab; en: string; ar: string; icon: ReactNode }[] = [
    { key: 'command', en: 'Command', ar: 'القيادة', icon: <Rocket size={16}/> },
    { key: 'program', en: 'v131-v150 Program', ar: 'برنامج v131-v150', icon: <GitBranch size={16}/> },
    { key: 'backend', en: 'Backend Domains', ar: 'مجالات الخلفية', icon: <Database size={16}/> },
    { key: 'contracts', en: 'API Contracts', ar: 'عقود API', icon: <FileCode2 size={16}/> },
    { key: 'guard', en: 'Posting Guard', ar: 'حارس الترحيل', icon: <ShieldCheck size={16}/> },
    { key: 'approvals', en: 'Approvals & Docs', ar: 'الاعتمادات والمستندات', icon: <FileStack size={16}/> },
    { key: 'cutover', en: 'Cutover', ar: 'الانتقال', icon: <PlayCircle size={16}/> },
    { key: 'qa', en: 'QA Suite', ar: 'اختبارات الجودة', icon: <ClipboardCheck size={16}/> },
    { key: 'scores', en: 'Scores', ar: 'التقييم', icon: <BrainCircuit size={16}/> },
  ];
  const exportCommand = () => downloadCsv(`v150_readiness_${period}.csv`, command.checks.map((row: any) => ({ period, ...row })));
  const exportProgram = () => downloadCsv(`v150_program_${period}.csv`, program);
  const exportBackend = () => downloadCsv(`v150_backend_domains_${period}.csv`, backend);
  const exportContracts = () => downloadCsv(`v150_api_contracts_${period}.csv`, contracts);
  const exportGuard = () => downloadCsv(`v150_posting_guard_${period}.csv`, guard);
  const exportCutover = () => downloadCsv(`v150_cutover_plan_${period}.csv`, cutover);
  const exportQa = () => downloadCsv(`v150_qa_suite_${period}.csv`, qa);
  const logReview = () => {
    if (!update) return;
    update((current: any) => ({ ...current, auditLogs: [...(Array.isArray(current.auditLogs) ? current.auditLogs : []), { id: id('AUD'), at: new Date().toISOString(), action: 'v150_launch_review', entity: 'enterprise_v150', ref: period, user: 'Local Admin', note: `v150 production ${command.scores.production}/100, backend ${command.scores.backend}/100, blockers ${command.blockers.length}` }] }), L(locale, 'v150 launch review logged.', 'تم تسجيل مراجعة إطلاق v150.'));
    notify?.('success', L(locale, 'v150 review logged.', 'تم تسجيل مراجعة v150.'));
  };

  return <div className="page-grid enterprise-v150">
    <Card title={L(locale, 'v150 Production launch suite', 'v150 حزمة إطلاق الإنتاج')} icon={<Rocket/>} action={<div className="button-row compact"><input type="month" value={period} onChange={(e) => setPeriod(e.target.value)}/><button onClick={exportCommand}><Download size={14}/>{L(locale, 'Readiness', 'الجاهزية')}</button><button onClick={exportQa}><Download size={14}/>{L(locale, 'QA', 'الاختبار')}</button></div>}>
      <div className="kpi-grid">
        <Kpi label={L(locale, 'Local MVP', 'النموذج المحلي')} value={pct(command.scores.local)} hint={L(locale, 'Workflow testing', 'اختبار التدفقات')} icon={<Sparkles/>} tone="good"/>
        <Kpi label={L(locale, 'ERP foundation', 'أساس ERP')} value={pct(command.scores.foundation)} hint={L(locale, 'Connected architecture', 'بنية مترابطة')} icon={<BadgeCheck/>} tone="good"/>
        <Kpi label={L(locale, 'Enterprise direction', 'الاتجاه المؤسسي')} value={pct(command.scores.enterprise)} hint={L(locale, 'Controls and cutover', 'الضوابط والانتقال')} icon={<BrainCircuit/>} tone="good"/>
        <Kpi label={L(locale, 'Production readiness', 'جاهزية الإنتاج')} value={pct(command.scores.production)} hint={L(locale, 'Needs real wiring', 'تحتاج ربط فعلي')} icon={<LockKeyhole/>} tone="warn"/>
        <Kpi label={L(locale, 'Backend readiness', 'جاهزية الخلفية')} value={pct(command.scores.backend)} hint={L(locale, 'Schema/function depth', 'عمق الجداول والدوال')} icon={<CloudCog/>} tone="warn"/>
        <Kpi label={L(locale, 'Blockers', 'العوائق')} value={command.blockers.length} hint={L(locale, 'Before go-live', 'قبل التشغيل')} icon={<AlertTriangle/>} tone={command.blockers.length ? 'bad' : 'good'}/>
      </div>
    </Card>
    <div className="tabs">{tabs.map((item) => <button key={item.key} className={tab === item.key ? 'active-tab' : ''} onClick={() => setTab(item.key)}>{item.icon}{L(locale, item.en, item.ar)}</button>)}</div>

    {tab === 'command' && <div className="page-grid two"><Card title={L(locale, 'Readiness command board', 'لوحة قيادة الجاهزية')} icon={<ClipboardCheck/>} action={<button onClick={logReview}><BadgeCheck size={14}/>{L(locale, 'Log review', 'تسجيل مراجعة')}</button>}><Table headers={[L(locale, 'Area', 'المجال'), L(locale, 'Control', 'الضابط'), L(locale, 'Status', 'الحالة'), L(locale, 'Evidence', 'الدليل'), L(locale, 'Next', 'التالي')]} rows={command.checks.map((c: any) => [c.area, c.control, <Pill tone={c.tone}>{c.status}</Pill>, c.evidence, c.next])}/></Card><Card title={L(locale, 'Operating snapshot', 'لقطة التشغيل')} icon={<CreditCard/>}><div className="kpi-grid"><Kpi label="Sales" value={money(command.metrics.sales)} hint="Foodics/local posted sales" icon={<UploadCloud/>}/><Kpi label="Inventory" value={money(command.metrics.inventoryValue)} hint="Stock ledger value" icon={<Layers/>}/><Kpi label="AP" value={money(command.metrics.ap)} hint="Supplier exposure" icon={<CreditCard/>}/><Kpi label="Negative" value={command.metrics.negativePositions} hint="Negative stock positions" icon={<AlertTriangle/>} tone={command.metrics.negativePositions ? 'bad' : 'good'}/></div><Table headers={['Metric','Value']} rows={Object.entries(command.metrics).map(([k,v]) => [k, String(v)])}/></Card></div>}
    {tab === 'program' && <Card title={L(locale, 'Combined v131-v150 launch program', 'برنامج الإطلاق المدمج v131-v150')} icon={<GitBranch/>} action={<button onClick={exportProgram}><Download size={14}/>{L(locale, 'Export', 'تصدير')}</button>}><Table headers={['Version','Stream','Deliverable','Status','Priority']} rows={program.map((r) => [r.version, r.stream, r.deliverable, <Pill tone={tone(r.status)}>{r.status}</Pill>, <Pill tone={tone(r.priority)}>{r.priority}</Pill>])}/></Card>}
    {tab === 'backend' && <Card title={L(locale, 'Production backend domains', 'مجالات الخلفية للإنتاج')} icon={<Database/>} action={<button onClick={exportBackend}><Download size={14}/>{L(locale, 'Export', 'تصدير')}</button>}><Table headers={['Domain','Tables','Functions','RLS','Readiness']} rows={backend.map((r) => [r.domain, r.tables, r.functions, r.rls, <Pill tone={tone(r.readiness)}>{r.readiness}</Pill>])}/></Card>}
    {tab === 'contracts' && <Card title={L(locale, 'v150 API contracts', 'عقود API v150')} icon={<FileCode2/>} action={<button onClick={exportContracts}><Download size={14}/>{L(locale, 'Export', 'تصدير')}</button>}><Table headers={['Endpoint','Input','Output','Guard']} rows={contracts.map((r) => [r.endpoint, r.input, r.output, r.guard])}/></Card>}
    {tab === 'guard' && <Card title={L(locale, 'Central posting guard', 'حارس الترحيل المركزي')} icon={<ShieldCheck/>} action={<button onClick={exportGuard}><Download size={14}/>{L(locale, 'Export', 'تصدير')}</button>}><div className="notice good">{L(locale, 'Target production rule: no important transaction posts directly from the browser. Every posting goes through validate → permission → period → lifecycle → inventory → GL → audit → status.', 'قاعدة الإنتاج المستهدفة: لا يتم ترحيل أي عملية مهمة مباشرة من المتصفح. كل ترحيل يمر عبر التحقق ← الصلاحية ← الفترة ← الحالة ← المخزون ← الأستاذ العام ← التدقيق ← تحديث الحالة.')}</div><Table headers={['Document','Status','Required controls','Server action']} rows={guard.map((r) => [r.document, <Pill tone={tone(r.status)}>{r.status}</Pill>, r.required, r.serverAction])}/></Card>}
    {tab === 'approvals' && <div className="page-grid two"><Card title={L(locale, 'Approval and maker-checker policy', 'سياسة الاعتماد والفصل بين المنفذ والمعتمد')} icon={<ShieldCheck/>}><Table headers={['Document','Maker','Checker','Rule']} rows={[
      ['Foodics batch', 'Sales control', 'Finance / Operations', 'Approve before sales-accounting or full ERP posting'],
      ['Stock count variance', 'Storekeeper', 'Branch manager / Finance', 'Approve shortage/surplus before GL and stock posting'],
      ['Supplier payment', 'Accountant', 'Finance manager / Owner by amount', 'Invoice allocation and period check required'],
      ['Manual journal', 'Accountant', 'Finance manager', 'Debit=credit, attachment optional, period open'],
      ['Recipe version', 'Chef / Cost controller', 'Operations / Finance', 'Effective date and margin impact reviewed'],
    ]}/></Card><Card title={L(locale, 'Attachment vault policy', 'سياسة خزنة المرفقات')} icon={<FileStack/>}><Table headers={['Document','Required attachment','Bucket']} rows={[
      ['Supplier', 'VAT certificate, CR, bank letter', 'supplier-documents'],
      ['PO / Quotation', 'Supplier quotation / approved PR', 'purchase-documents'],
      ['GRN', 'Delivery note / receiving photo', 'purchase-documents'],
      ['Supplier invoice', 'Invoice PDF/image', 'finance-documents'],
      ['Payment voucher', 'Bank proof / receipt', 'finance-documents'],
      ['Stock count', 'Signed count sheet', 'stock-count-documents'],
    ]}/></Card></div>}
    {tab === 'cutover' && <Card title={L(locale, 'Pilot-to-go-live cutover plan', 'خطة الانتقال من التجربة للتشغيل')} icon={<PlayCircle/>} action={<button onClick={exportCutover}><Download size={14}/>{L(locale, 'Export', 'تصدير')}</button>}><Table headers={['Wave','Title','Action','Exit criteria']} rows={cutover.map((r) => [r.wave, r.title, r.action, r.exit])}/></Card>}
    {tab === 'qa' && <Card title={L(locale, 'v150 QA regression suite', 'حزمة اختبارات v150')} icon={<ClipboardCheck/>} action={<button onClick={exportQa}><Download size={14}/>{L(locale, 'Export', 'تصدير')}</button>}><Table headers={['Area','Test','Expected','Priority']} rows={qa.map((r) => [r.area, r.test, r.expected, <Pill tone={tone(r.priority)}>{r.priority}</Pill>])}/></Card>}
    {tab === 'scores' && <Card title={L(locale, 'Current score and professional notes', 'التقييم الحالي والملاحظات المهنية')} icon={<BrainCircuit/>}><Table headers={['View','Score','Note']} rows={scores.map((r) => [r.view, <strong>{r.score}</strong>, r.note])}/><div className="notice warn">{L(locale, 'v150 is a strong backend and production launch package, but the next real value is wiring frontend setup and Foodics staging to Supabase rather than adding more local dashboards.', 'v150 حزمة قوية للإطلاق والخلفية، لكن القيمة العملية التالية هي ربط الإعدادات وفودكس فعلياً مع Supabase بدلاً من إضافة لوحات محلية أكثر.')}</div></Card>}
  </div>;
}
