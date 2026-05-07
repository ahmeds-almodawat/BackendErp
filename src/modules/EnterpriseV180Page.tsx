import { useMemo, useState, type ReactNode } from 'react';
import { AlertTriangle, BadgeCheck, Banknote, Boxes, BrainCircuit, ClipboardCheck, CloudCog, Database, Download, FileCode2, FileStack, GitBranch, Layers, LockKeyhole, PlayCircle, Rocket, ShieldCheck, Sparkles, UploadCloud } from 'lucide-react';
import { buildV180ApiContracts, buildV180BackendModes, buildV180Command, buildV180FinanceHardening, buildV180InventoryHardening, buildV180MasterDataControls, buildV180PostingOrchestrator, buildV180Program, buildV180QaSuite, buildV180Scores, downloadCsv, money, pct } from '../engines/enterpriseV180Engine';

type Locale = 'en' | 'ar';
type Tab = 'command' | 'program' | 'mode' | 'master' | 'posting' | 'inventory' | 'finance' | 'contracts' | 'qa' | 'scores';
type Props = { state: any; totals: any; update?: (fn: (current: any) => any, success?: string) => void; locale: Locale; notify?: (type: 'success' | 'warning' | 'error', message: string) => void };
function L(locale: Locale, en: string, ar: string) { return locale === 'ar' ? ar : en; }
function monthNow() { return new Date().toISOString().slice(0, 7); }
function id(prefix: string) { return `${prefix}-${Math.random().toString(36).slice(2, 10)}`; }
function toneFrom(value: string): 'good' | 'warn' | 'bad' | 'info' { const text = String(value).toLowerCase(); if (text.includes('block') || text.includes('missing') || text.includes('duplicate') || text.includes('broken')) return 'bad'; if (text.includes('partial') || text.includes('warning') || text.includes('designed') || text.includes('required') || text.includes('next')) return 'warn'; if (text.includes('ready') || text.includes('included') || text.includes('clean') || text.includes('balanced') || text.includes('working')) return 'good'; return 'info'; }
function Pill({ tone, children }: { tone: 'good' | 'warn' | 'bad' | 'info'; children: ReactNode }) { return <span className={`pill ${tone}`}>{children}</span>; }
function Card({ title, icon, action, children }: { title: string; icon?: ReactNode; action?: ReactNode; children: ReactNode }) { return <section className="card"><div className="card-header"><div className="card-title">{icon}{title}</div>{action}</div>{children}</section>; }
function Kpi({ label, value, hint, icon, tone = 'info' }: { label: string; value: string | number; hint: string; icon: ReactNode; tone?: 'good' | 'warn' | 'bad' | 'info' }) { return <div className={`kpi-card ${tone}`}><div className="kpi-icon">{icon}</div><div><span>{label}</span><strong>{value}</strong><small>{hint}</small></div></div>; }
function Table({ headers, rows }: { headers: ReactNode[]; rows: ReactNode[][] }) { return <div className="table-wrap"><table><thead><tr>{headers.map((h, i) => <th key={i}>{h}</th>)}</tr></thead><tbody>{rows.length ? rows.map((row, r) => <tr key={r}>{row.map((cell, c) => <td key={c}>{cell}</td>)}</tr>) : <tr><td colSpan={headers.length} className="muted">No rows</td></tr>}</tbody></table></div>; }

export default function EnterpriseV180Page({ state, totals, update, locale, notify }: Props) {
  const [tab, setTab] = useState<Tab>('command');
  const [period, setPeriod] = useState(monthNow());
  const command = useMemo(() => buildV180Command(state, totals), [state, totals]);
  const program = useMemo(() => buildV180Program(), []);
  const modes = useMemo(() => buildV180BackendModes(), []);
  const master = useMemo(() => buildV180MasterDataControls(state), [state]);
  const posting = useMemo(() => buildV180PostingOrchestrator(), []);
  const inventory = useMemo(() => buildV180InventoryHardening(), []);
  const finance = useMemo(() => buildV180FinanceHardening(), []);
  const contracts = useMemo(() => buildV180ApiContracts(), []);
  const qa = useMemo(() => buildV180QaSuite(), []);
  const scores = useMemo(() => buildV180Scores(), []);
  const tabs: { key: Tab; en: string; ar: string; icon: ReactNode }[] = [
    { key: 'command', en: 'Command', ar: 'القيادة', icon: <Rocket size={16}/> },
    { key: 'program', en: 'v151-v180 Program', ar: 'برنامج v151-v180', icon: <GitBranch size={16}/> },
    { key: 'mode', en: 'Backend Mode', ar: 'وضع الخلفية', icon: <CloudCog size={16}/> },
    { key: 'master', en: 'Master Data', ar: 'البيانات الأساسية', icon: <Database size={16}/> },
    { key: 'posting', en: 'Posting Guard', ar: 'حارس الترحيل', icon: <ShieldCheck size={16}/> },
    { key: 'inventory', en: 'Inventory Hardening', ar: 'تقوية المخزون', icon: <Boxes size={16}/> },
    { key: 'finance', en: 'Finance Hardening', ar: 'تقوية المالية', icon: <Banknote size={16}/> },
    { key: 'contracts', en: 'API Contracts', ar: 'عقود API', icon: <FileCode2 size={16}/> },
    { key: 'qa', en: 'QA', ar: 'الاختبار', icon: <ClipboardCheck size={16}/> },
    { key: 'scores', en: 'Score Notes', ar: 'ملاحظات التقييم', icon: <BrainCircuit size={16}/> },
  ];
  const exportRows = (name: string, rows: Array<Record<string, unknown>>) => downloadCsv(`${name}_${period}.csv`, rows.map((row) => ({ period, ...row })));
  const logReview = () => {
    if (!update) return;
    update((current: any) => ({ ...current, audits: [{ id: id('AUD'), at: new Date().toISOString(), action: 'v180_production_wiring_review', entity: 'enterprise_v180', ref: period, user: 'Local Admin', note: `v180 score ${command.score}/100, blockers ${command.blockers.length}, warnings ${command.warnings.length}` }, ...(Array.isArray(current.audits) ? current.audits : [])] }), L(locale, 'v180 readiness review logged.', 'تم تسجيل مراجعة جاهزية v180.'));
    notify?.('success', L(locale, 'v180 review logged.', 'تم تسجيل مراجعة v180.'));
  };
  const seedBackendProfile = () => {
    if (!update) return;
    update((current: any) => {
      const profiles = Array.isArray(current.importProfiles) ? current.importProfiles : [];
      const exists = profiles.some((p: any) => p.id === 'V180-BACKEND-CUTOVER');
      return {
        ...current,
        importProfiles: exists ? profiles : [{ id: 'V180-BACKEND-CUTOVER', name: 'v180 Backend Cutover Master Profile', importType: 'backend_cutover', fileType: 'csv', mappings: { company: 'company_id', branch: 'branch_code', store: 'store_code', sku: 'sku', account: 'account_code' }, duplicateKey: 'company|entity|code', requiresApproval: true }, ...profiles],
        audits: [{ id: id('AUD'), at: new Date().toISOString(), action: 'v180_seed_backend_profile', entity: 'import_profile', ref: 'V180-BACKEND-CUTOVER', user: 'Local Admin', note: 'Seeded backend cutover import profile.' }, ...(Array.isArray(current.audits) ? current.audits : [])],
      };
    }, L(locale, 'Backend cutover profile seeded.', 'تم إنشاء ملف إعداد الانتقال للخلفية.'));
  };

  return <div className="page-grid enterprise-v180">
    <Card title={L(locale, 'v180 Production wiring + enterprise hardening', 'v180 ربط الإنتاج والتقوية المؤسسية')} icon={<Rocket/>} action={<div className="button-row compact"><input type="month" value={period} onChange={(e) => setPeriod(e.target.value)}/><button onClick={() => exportRows('v180_readiness', command.controls)}><Download size={14}/>{L(locale, 'Readiness', 'الجاهزية')}</button><button onClick={logReview}><BadgeCheck size={14}/>{L(locale, 'Log review', 'تسجيل')}</button></div>}>
      <div className="kpi-grid">
        <Kpi label={L(locale, 'v180 score', 'تقييم v180')} value={pct(command.score)} hint={L(locale, 'Wiring readiness', 'جاهزية الربط')} icon={<Sparkles/>} tone={command.blockers.length ? 'warn' : 'good'}/>
        <Kpi label={L(locale, 'Production readiness', 'جاهزية الإنتاج')} value="6.5 / 10" hint={L(locale, 'Improved, not live yet', 'تحسنت وليست تشغيل نهائي')} icon={<LockKeyhole/>} tone="warn"/>
        <Kpi label={L(locale, 'Backend readiness', 'جاهزية الخلفية')} value="7.0 / 10" hint={L(locale, 'Ready for real wiring', 'جاهزة للربط الفعلي')} icon={<CloudCog/>} tone="good"/>
        <Kpi label={L(locale, 'Inventory value', 'قيمة المخزون')} value={money(command.metrics.inventoryValue)} hint={L(locale, 'Local ledger', 'دفتر محلي')} icon={<Layers/>}/>
        <Kpi label={L(locale, 'Blockers', 'العوائق')} value={command.blockers.length} hint={L(locale, 'Must fix', 'يجب حلها')} icon={<AlertTriangle/>} tone={command.blockers.length ? 'bad' : 'good'}/>
        <Kpi label={L(locale, 'Warnings', 'التنبيهات')} value={command.warnings.length} hint={L(locale, 'Before pilot', 'قبل التجربة')} icon={<FileStack/>} tone={command.warnings.length ? 'warn' : 'good'}/>
      </div>
    </Card>
    <div className="tabs">{tabs.map((item) => <button key={item.key} className={tab === item.key ? 'active-tab' : ''} onClick={() => setTab(item.key)}>{item.icon}{L(locale, item.en, item.ar)}</button>)}</div>
    {tab === 'command' && <div className="page-grid two"><Card title={L(locale, 'Production wiring command board', 'لوحة قيادة ربط الإنتاج')} icon={<ClipboardCheck/>}><Table headers={[L(locale, 'Area', 'المجال'), L(locale, 'Control', 'الضابط'), L(locale, 'Status', 'الحالة'), L(locale, 'Evidence', 'الدليل'), L(locale, 'Next', 'التالي')]} rows={command.controls.map((r) => [r.area, r.control, <Pill tone={r.tone}>{r.status}</Pill>, r.evidence, r.next])}/></Card><Card title={L(locale, 'Local-to-backend snapshot', 'لقطة الانتقال من المحلي للخلفية')} icon={<UploadCloud/>} action={<button onClick={seedBackendProfile}>{L(locale, 'Seed backend profile', 'إنشاء ملف انتقال')}</button>}><Table headers={['Metric','Value']} rows={Object.entries(command.metrics).map(([k,v]) => [k, String(v)])}/></Card></div>}
    {tab === 'program' && <Card title={L(locale, 'v151-v180 combined program', 'برنامج v151-v180 المدمج')} icon={<GitBranch/>} action={<button onClick={() => exportRows('v180_program', program)}><Download size={14}/>{L(locale, 'Export', 'تصدير')}</button>}><Table headers={['Version','Stream','Deliverable','Status','Priority']} rows={program.map((r) => [r.version, r.stream, r.deliverable, <Pill tone={toneFrom(r.status)}>{r.status}</Pill>, <Pill tone={toneFrom(r.priority)}>{r.priority}</Pill>])}/></Card>}
    {tab === 'mode' && <Card title={L(locale, 'Local/Supabase mode bridge', 'جسر الوضع المحلي وسوبابيس')} icon={<CloudCog/>} action={<button onClick={() => exportRows('v180_backend_modes', modes)}><Download size={14}/>{L(locale, 'Export', 'تصدير')}</button>}><Table headers={['Layer','Local mode','Supabase mode','Cutover rule','Readiness']} rows={modes.map((r) => [r.layer, r.localMode, r.supabaseMode, r.cutoverRule, <Pill tone={toneFrom(r.readiness)}>{r.readiness}</Pill>])}/></Card>}
    {tab === 'master' && <Card title={L(locale, 'Master data control center', 'مركز رقابة البيانات الأساسية')} icon={<Database/>} action={<button onClick={() => exportRows('v180_master_data_controls', master)}><Download size={14}/>{L(locale, 'Export', 'تصدير')}</button>}><Table headers={['Area','Control','Status','Evidence','Next']} rows={master.map((r) => [r.area, r.control, <Pill tone={r.tone}>{r.status}</Pill>, r.evidence, r.next])}/></Card>}
    {tab === 'posting' && <Card title={L(locale, 'Central posting orchestrator foundation', 'أساس حارس الترحيل المركزي')} icon={<ShieldCheck/>} action={<button onClick={() => exportRows('v180_posting_orchestrator', posting)}><Download size={14}/>{L(locale, 'Export', 'تصدير')}</button>}><Table headers={['Document','Control','Status','Evidence','Next']} rows={posting.map((r) => [r.area, r.control, <Pill tone={r.tone}>{r.status}</Pill>, r.evidence, r.next])}/></Card>}
    {tab === 'inventory' && <Card title={L(locale, 'Inventory enterprise hardening', 'تقوية المخزون المؤسسية')} icon={<Boxes/>} action={<button onClick={() => exportRows('v180_inventory_hardening', inventory)}><Download size={14}/>{L(locale, 'Export', 'تصدير')}</button>}><Table headers={['Area','Control','Status','Evidence','Next']} rows={inventory.map((r) => [r.area, r.control, <Pill tone={r.tone}>{r.status}</Pill>, r.evidence, r.next])}/></Card>}
    {tab === 'finance' && <Card title={L(locale, 'Finance enterprise hardening', 'تقوية المالية المؤسسية')} icon={<Banknote/>} action={<button onClick={() => exportRows('v180_finance_hardening', finance)}><Download size={14}/>{L(locale, 'Export', 'تصدير')}</button>}><Table headers={['Area','Control','Status','Evidence','Next']} rows={finance.map((r) => [r.area, r.control, <Pill tone={r.tone}>{r.status}</Pill>, r.evidence, r.next])}/></Card>}
    {tab === 'contracts' && <Card title={L(locale, 'v180 production API contracts', 'عقود API للإنتاج v180')} icon={<FileCode2/>} action={<button onClick={() => exportRows('v180_api_contracts', contracts)}><Download size={14}/>{L(locale, 'Export', 'تصدير')}</button>}><Table headers={['Endpoint','Purpose','Input','Output','Guard']} rows={contracts.map((r) => [r.endpoint, r.purpose, r.input, r.output, r.guard])}/></Card>}
    {tab === 'qa' && <Card title={L(locale, 'v180 QA regression suite', 'حزمة اختبار v180')} icon={<ClipboardCheck/>} action={<button onClick={() => exportRows('v180_qa_suite', qa)}><Download size={14}/>{L(locale, 'Export', 'تصدير')}</button>}><Table headers={['Test','Stream','Deliverable','Status','Priority']} rows={qa.map((r) => [r.version, r.stream, r.deliverable, <Pill tone={toneFrom(r.status)}>{r.status}</Pill>, <Pill tone={toneFrom(r.priority)}>{r.priority}</Pill>])}/></Card>}
    {tab === 'scores' && <Card title={L(locale, 'Current score after v180', 'التقييم الحالي بعد v180')} icon={<BrainCircuit/>}><div className="kpi-grid">{scores.map((s) => <Kpi key={s.view} label={s.view} value={s.score} hint={s.note} icon={<Sparkles/>} tone={s.view.includes('Production') || s.view.includes('Backend') ? 'warn' : 'good'}/>)}</div></Card>}
  </div>;
}
