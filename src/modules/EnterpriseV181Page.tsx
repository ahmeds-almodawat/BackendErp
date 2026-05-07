import { useMemo, useState, type ReactNode } from 'react';
import { BadgeCheck, CloudCog, Database, Download, KeyRound, LockKeyhole, Rocket, Save, ServerCog, ShieldCheck, UploadCloud, AlertTriangle } from 'lucide-react';
import { authControls, downloadCsv, persistencePlan, scoreRows, setupCounts } from '../engines/enterpriseV181Engine';
import { buildSetupSyncPayload, downloadJson, getBackendHealth, postToSupabaseEdge, validateSetupForBackend } from '../services/backendSetupPersistence';

type Locale = 'en' | 'ar';
type Props = { state: any; totals: any; update?: (fn: (current: any) => any, success?: string) => void; locale: Locale; notify?: (type: 'success' | 'warning' | 'error', message: string) => void };
type Tab = 'command' | 'auth' | 'setup' | 'sync' | 'validation' | 'cutover' | 'scores';
function L(locale: Locale, en: string, ar: string) { return locale === 'ar' ? ar : en; }
function id(prefix: string) { return `${prefix}-${Math.random().toString(36).slice(2, 10)}`; }
function toneFrom(status: string): 'good' | 'warn' | 'bad' | 'info' { const s = String(status).toLowerCase(); if (s.includes('block') || s.includes('missing')) return 'bad'; if (s.includes('warning') || s.includes('scaffold') || s.includes('next') || s.includes('designed')) return 'warn'; if (s.includes('ready') || s.includes('added') || s.includes('clean')) return 'good'; return 'info'; }
function Card({ title, icon, action, children }: { title: string; icon?: ReactNode; action?: ReactNode; children: ReactNode }) { return <section className="card"><div className="card-header"><div className="card-title">{icon}{title}</div>{action}</div>{children}</section>; }
function Pill({ tone, children }: { tone: 'good' | 'warn' | 'bad' | 'info'; children: ReactNode }) { return <span className={`pill ${tone}`}>{children}</span>; }
function KPI({ label, value, hint, icon, tone = 'info' }: { label: string; value: string | number; hint: string; icon: ReactNode; tone?: 'good' | 'warn' | 'bad' | 'info' }) { return <div className={`kpi-card ${tone}`}><div className="kpi-icon">{icon}</div><div><span>{label}</span><strong>{value}</strong><small>{hint}</small></div></div>; }
function Table({ headers, rows }: { headers: ReactNode[]; rows: ReactNode[][] }) { return <div className="table-wrap"><table><thead><tr>{headers.map((h, i) => <th key={i}>{h}</th>)}</tr></thead><tbody>{rows.length ? rows.map((row, r) => <tr key={r}>{row.map((cell, c) => <td key={c}>{cell}</td>)}</tr>) : <tr><td colSpan={headers.length} className="muted">No rows</td></tr>}</tbody></table></div>; }

export default function EnterpriseV181Page({ state, update, locale, notify }: Props) {
  const [tab, setTab] = useState<Tab>('command');
  const [busy, setBusy] = useState(false);
  const [lastResult, setLastResult] = useState<string>('');
  const health = useMemo(() => getBackendHealth(), []);
  const validation = useMemo(() => validateSetupForBackend(state), [state]);
  const payload = useMemo(() => buildSetupSyncPayload(state), [state]);
  const counts = useMemo(() => setupCounts(state), [state]);
  const plan = useMemo(() => persistencePlan(), []);
  const auth = useMemo(() => authControls(), []);
  const scores = useMemo(() => scoreRows(), []);
  const tabs: { key: Tab; en: string; ar: string; icon: ReactNode }[] = [
    { key: 'command', en: 'Command', ar: 'القيادة', icon: <Rocket size={16}/> },
    { key: 'auth', en: 'Auth', ar: 'الدخول', icon: <KeyRound size={16}/> },
    { key: 'setup', en: 'Setup Counts', ar: 'عدادات التأسيس', icon: <Database size={16}/> },
    { key: 'validation', en: 'Validation', ar: 'التحقق', icon: <ShieldCheck size={16}/> },
    { key: 'sync', en: 'Sync Bridge', ar: 'جسر المزامنة', icon: <UploadCloud size={16}/> },
    { key: 'cutover', en: 'Cutover', ar: 'الانتقال', icon: <ServerCog size={16}/> },
    { key: 'scores', en: 'Scores', ar: 'التقييم', icon: <BadgeCheck size={16}/> },
  ];
  const log = (message: string) => {
    if (!update) return;
    update((current: any) => ({ ...current, audits: [{ id: id('AUD'), at: new Date().toISOString(), action: 'v181_backend_setup_sync_review', entity: 'backend_v181', ref: 'V181', user: 'Local Admin', note: message }, ...(Array.isArray(current.audits) ? current.audits : [])] }), L(locale, 'v181 review logged.', 'تم تسجيل مراجعة v181.'));
  };
  const downloadPayload = () => downloadJson(`v181_setup_sync_payload_${new Date().toISOString().slice(0,10)}.json`, payload);
  const dryRunSync = async () => {
    setBusy(true);
    const result = validation.blockers ? `Blocked: ${validation.blockers} blocker(s). Fix setup validation first.` : `Dry run ready: ${payload.branches.length} branches, ${payload.stores.length} stores, ${payload.items.length} items, ${payload.suppliers.length} suppliers.`;
    setLastResult(result);
    log(result);
    notify?.(validation.blockers ? 'warning' : 'success', result);
    setBusy(false);
  };
  const pushToEdge = async () => {
    setBusy(true);
    const result = await postToSupabaseEdge('setup-sync', { mode: 'upsert_master_data', dryRun: true, payload });
    const text = result.ok ? `Supabase setup-sync dry run accepted (${result.status}).` : `Supabase setup-sync not completed (${result.status}): ${JSON.stringify(result.data).slice(0, 180)}`;
    setLastResult(text);
    log(text);
    notify?.(result.ok ? 'success' : 'warning', text);
    setBusy(false);
  };
  return <div className="page-grid enterprise-v181">
    <Card title={L(locale, 'v181 Auth + Setup Persistence Wiring', 'v181 ربط الدخول والبيانات الأساسية')} icon={<CloudCog/>} action={<div className="button-row compact"><button onClick={downloadPayload}><Download size={14}/>{L(locale, 'Setup JSON', 'ملف التأسيس')}</button><button onClick={() => downloadCsv('v181_setup_validation.csv', validation.rows)}><Download size={14}/>{L(locale, 'Validation CSV', 'تصدير التحقق')}</button></div>}>
      <div className="kpi-grid">
        <KPI label={L(locale, 'Setup sync score', 'تقييم مزامنة التأسيس')} value={`${validation.score}%`} hint={L(locale, 'Blocks bad backend migration', 'يمنع ترحيل بيانات خاطئة')} icon={<ShieldCheck/>} tone={validation.blockers ? 'bad' : validation.warnings ? 'warn' : 'good'}/>
        <KPI label={L(locale, 'Backend mode', 'وضع الخلفية')} value={health.mode === 'supabase' ? 'Supabase' : 'Local'} hint={health.message} icon={<ServerCog/>} tone={health.configured ? 'good' : 'warn'}/>
        <KPI label={L(locale, 'Blockers', 'العوائق')} value={validation.blockers} hint={L(locale, 'Must be zero before sync', 'يجب أن تصبح صفر قبل المزامنة')} icon={<AlertTriangle/>} tone={validation.blockers ? 'bad' : 'good'}/>
        <KPI label={L(locale, 'Warnings', 'التحذيرات')} value={validation.warnings} hint={L(locale, 'Fix before pilot', 'تعالج قبل التجربة')} icon={<LockKeyhole/>} tone={validation.warnings ? 'warn' : 'good'}/>
      </div>
    </Card>
    <div className="tabs">{tabs.map((item) => <button key={item.key} className={tab === item.key ? 'active-tab' : ''} onClick={() => setTab(item.key)}>{item.icon}{L(locale, item.en, item.ar)}</button>)}</div>
    {tab === 'command' && <div className="page-grid two"><Card title={L(locale, 'Production wiring position', 'موقف الربط الإنتاجي')} icon={<Rocket/>}><div className="notice">{L(locale, 'v181 is the first practical bridge from local setup data to Supabase persistence. It validates setup data, exports a clean sync payload, and prepares the setup-sync Edge Function flow while keeping Local Trial Mode safe.', 'v181 هو أول جسر عملي من بيانات التأسيس المحلية إلى تخزين Supabase. يتحقق من البيانات ويصدر ملف مزامنة نظيف ويجهز مسار دالة setup-sync مع بقاء وضع التجربة المحلي آمناً.')}</div><Table headers={['Area','Status']} rows={[[L(locale,'Environment','البيئة'), health.message], [L(locale,'Setup payload','ملف التأسيس'), `${payload.branches.length + payload.stores.length + payload.items.length + payload.suppliers.length + payload.chartAccounts.length} rows`], [L(locale,'Validation','التحقق'), `${validation.blockers} blockers / ${validation.warnings} warnings`], [L(locale,'Next','التالي'), L(locale,'Pilot setup sync after blockers are zero.','تجربة مزامنة التأسيس بعد تصفير العوائق.')]]}/></Card><Card title={L(locale, 'Safe actions', 'إجراءات آمنة')} icon={<Save/>}><div className="button-row"><button disabled={busy} onClick={dryRunSync}><BadgeCheck size={14}/>{L(locale, 'Local dry-run', 'اختبار محلي')}</button><button disabled={busy || !health.configured} onClick={pushToEdge}><UploadCloud size={14}/>{L(locale, 'Supabase dry-run', 'اختبار Supabase')}</button><button onClick={() => log('Manual v181 backend setup review logged.')}>{L(locale, 'Log review', 'تسجيل مراجعة')}</button></div>{lastResult && <div className="notice">{lastResult}</div>}</Card></div>}
    {tab === 'auth' && <Card title={L(locale, 'Auth bootstrap controls', 'ضوابط تهيئة الدخول')} icon={<KeyRound/>}><Table headers={[L(locale,'Control','الضابط'), L(locale,'Purpose','الهدف'), L(locale,'Status','الحالة')]} rows={auth.map((r) => [r.control, r.purpose, <Pill tone={toneFrom(String(r.status))}>{r.status}</Pill>])}/></Card>}
    {tab === 'setup' && <Card title={L(locale, 'Setup entities ready for persistence', 'بيانات التأسيس الجاهزة للتخزين')} icon={<Database/>} action={<button onClick={() => downloadCsv('v181_setup_counts.csv', counts)}><Download size={14}/>{L(locale,'Export','تصدير')}</button>}><Table headers={['Entity','Rows','Target','Priority']} rows={counts.map((r) => [r.entity, r.count, r.target, <Pill tone={r.priority === 'Critical' ? 'bad' : 'warn'}>{r.priority}</Pill>])}/></Card>}
    {tab === 'validation' && <Card title={L(locale, 'Backend setup validation', 'التحقق من بيانات الخلفية')} icon={<ShieldCheck/>}><Table headers={['Area','Control','Count','Status']} rows={validation.rows.map((r) => [r.area, r.control, r.count, <Pill tone={toneFrom(r.status)}>{r.status}</Pill>])}/></Card>}
    {tab === 'sync' && <Card title={L(locale, 'Setup sync bridge', 'جسر مزامنة التأسيس')} icon={<UploadCloud/>}><div className="notice">{L(locale, 'Use the JSON export to review exactly what will move to Supabase. In Supabase mode, the dry-run button calls the setup-sync Edge Function without committing production posting.', 'استخدم تصدير JSON لمراجعة ما سينتقل إلى Supabase بالضبط. في وضع Supabase يستدعي زر الاختبار دالة setup-sync بدون ترحيل إنتاجي نهائي.')}</div><Table headers={['Section','Rows']} rows={Object.entries(payload).filter(([k]) => k !== 'exportedAt' && k !== 'company').map(([k, v]) => [k, Array.isArray(v) ? v.length : 1])}/></Card>}
    {tab === 'cutover' && <Card title={L(locale, 'v181 cutover plan', 'خطة الانتقال v181')} icon={<ServerCog/>} action={<button onClick={() => downloadCsv('v181_cutover_plan.csv', plan)}><Download size={14}/>{L(locale,'Export','تصدير')}</button>}><Table headers={['Step','Stream','Action','Status']} rows={plan.map((r) => [r.step, r.stream, r.action, <Pill tone={toneFrom(String(r.status))}>{r.status}</Pill>])}/></Card>}
    {tab === 'scores' && <Card title={L(locale, 'Current score after v181', 'التقييم الحالي بعد v181')} icon={<BadgeCheck/>}><Table headers={['View','Score','Note']} rows={scores.map((r) => [r.view, r.score, r.note])}/></Card>}
  </div>;
}
