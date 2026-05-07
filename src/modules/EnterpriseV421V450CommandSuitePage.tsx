import { useMemo, useState } from 'react';
import { Activity, AlertTriangle, BookOpen, CheckCircle2, ClipboardCheck, Download, GraduationCap, LifeBuoy, ShieldCheck, Target, XCircle } from 'lucide-react';
import { buildEnterpriseV421V450Snapshot, enterpriseV421V450Csv, type EnterpriseV421V450Status } from '../engines/enterpriseV421V450CommandSuiteEngine';

type Locale = 'en' | 'ar';

type Props = {
  state: Record<string, any>;
  totals?: Record<string, any>;
  locale: Locale;
  notify?: (type: 'success' | 'warning' | 'error', message: string) => void;
};

function L(locale: Locale, en: string, ar: string) { return locale === 'ar' ? ar : en; }

function statusLabel(status: EnterpriseV421V450Status) {
  if (status === 'ready') return 'Ready';
  if (status === 'watch') return 'Watch';
  return 'Blocked';
}

function statusIcon(status: EnterpriseV421V450Status) {
  if (status === 'ready') return <CheckCircle2 size={16} />;
  if (status === 'watch') return <AlertTriangle size={16} />;
  return <XCircle size={16} />;
}

function downloadText(filename: string, content: string, mime = 'text/plain;charset=utf-8') {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function Tile({ icon, label, value, hint }: { icon: React.ReactNode; label: string; value: string; hint: string }) {
  return <div className="mini-card"><div className="mini-icon">{icon}</div><span>{label}</span><strong>{value}</strong><small>{hint}</small></div>;
}

export default function EnterpriseV421V450CommandSuitePage({ state, totals = {}, locale, notify }: Props) {
  const [tab, setTab] = useState<'tracks' | 'sop' | 'training' | 'support' | 'quality'>('tracks');
  const snapshot = useMemo(() => buildEnterpriseV421V450Snapshot(state, totals), [state, totals]);

  const exportEvidence = () => {
    downloadText(`enterprise-command-suite-${new Date().toISOString().slice(0, 10)}.csv`, enterpriseV421V450Csv(snapshot), 'text/csv;charset=utf-8');
    notify?.('success', L(locale, 'Command Suite evidence exported.', 'تم تصدير إثباتات مركز القيادة.'));
  };

  return <div className="module-page enterprise-command-suite">
    <div className="module-hero professional">
      <div>
        <span className="eyebrow">{L(locale, 'v421-v450 Enterprise Command Suite', 'v421-v450 Enterprise Command Suite')}</span>
        <h2>{L(locale, 'Pilot governance, SOPs, training, support, and data quality in one cockpit', 'حوكمة التشغيل التجريبي والإجراءات والتدريب والدعم وجودة البيانات في لوحة واحدة')}</h2>
        <p>{L(locale, 'This page does not mutate accounting or inventory. It organizes the evidence needed to operate the ERP smoothly under mid-range heavy workload.', 'هذه الصفحة لا تغيّر القيود أو المخزون، بل تنظّم إثباتات التشغيل المطلوبة لتشغيل النظام بسلاسة تحت أحمال متوسطة إلى عالية.')}</p>
      </div>
      <div className={`hero-score ${snapshot.status}`}><span>{L(locale, 'Pilot score', 'درجة الجاهزية')}</span><strong>{snapshot.score}%</strong><small>{statusLabel(snapshot.status)}</small></div>
    </div>

    <div className="mini-grid four">
      <Tile icon={<CheckCircle2 size={18}/>} label={L(locale, 'Ready tracks', 'مسارات جاهزة')} value={String(snapshot.readyTracks)} hint={L(locale, 'can proceed', 'يمكن المتابعة')} />
      <Tile icon={<AlertTriangle size={18}/>} label={L(locale, 'Watch tracks', 'مسارات للمتابعة')} value={String(snapshot.watchTracks)} hint={L(locale, 'need evidence', 'تحتاج إثبات')} />
      <Tile icon={<XCircle size={18}/>} label={L(locale, 'Blocked tracks', 'مسارات متوقفة')} value={String(snapshot.blockedTracks)} hint={L(locale, 'must close first', 'يجب إغلاقها')} />
      <Tile icon={<ShieldCheck size={18}/>} label={L(locale, 'Mode', 'النمط')} value={L(locale, 'Pilot', 'تجريبي')} hint={L(locale, 'evidence only', 'إثبات فقط')} />
    </div>

    <div className="action-bar wrap">
      <button onClick={exportEvidence}><Download size={16}/>{L(locale, 'Export evidence CSV', 'تصدير CSV')}</button>
      <button onClick={() => downloadText('pilot-readiness-checklist.json', JSON.stringify(snapshot.launchChecklist, null, 2), 'application/json;charset=utf-8')}><ClipboardCheck size={16}/>{L(locale, 'Export checklist', 'تصدير القائمة')}</button>
    </div>

    <div className="tab-row wide">
      <button className={tab === 'tracks' ? 'active-tab' : ''} onClick={() => setTab('tracks')}><Target size={15}/>{L(locale, 'Readiness tracks', 'مسارات الجاهزية')}</button>
      <button className={tab === 'sop' ? 'active-tab' : ''} onClick={() => setTab('sop')}><BookOpen size={15}/>{L(locale, 'SOP library', 'مكتبة الإجراءات')}</button>
      <button className={tab === 'training' ? 'active-tab' : ''} onClick={() => setTab('training')}><GraduationCap size={15}/>{L(locale, 'Training', 'التدريب')}</button>
      <button className={tab === 'support' ? 'active-tab' : ''} onClick={() => setTab('support')}><LifeBuoy size={15}/>{L(locale, 'Support model', 'نموذج الدعم')}</button>
      <button className={tab === 'quality' ? 'active-tab' : ''} onClick={() => setTab('quality')}><Activity size={15}/>{L(locale, 'Data quality', 'جودة البيانات')}</button>
    </div>

    {tab === 'tracks' && <div className="grid two">
      {snapshot.tracks.map((item) => <section className={`card gate-card ${item.status}`} key={item.key}>
        <div className="card-header"><div className="card-title">{statusIcon(item.status)}{L(locale, item.titleEn, item.titleAr)}</div><span className={`status-pill ${item.status}`}>{item.score}%</span></div>
        <p className="muted">{L(locale, 'Owner', 'المالك')}: {L(locale, item.ownerEn, item.ownerAr)}</p>
        <div className="chip-row">{item.checks.map((check) => <span className="chip" key={check}>{check}</span>)}</div>
        {item.blockers.length ? <div className="notice warning"><strong>{L(locale, 'Blockers', 'الموانع')}</strong><ul>{item.blockers.map((b) => <li key={b}>{b}</li>)}</ul></div> : <div className="notice success">{L(locale, 'No blockers detected in local evidence.', 'لا توجد موانع في الإثباتات المحلية.')}</div>}
        <div className="next-action"><strong>{L(locale, 'Next action', 'الإجراء التالي')}</strong><p>{L(locale, item.nextActionEn, item.nextActionAr)}</p></div>
      </section>)}
    </div>}

    {tab === 'sop' && <section className="card"><div className="card-header"><div className="card-title"><BookOpen size={18}/>{L(locale, 'Operating SOP library', 'مكتبة إجراءات التشغيل')}</div></div><div className="table-wrap"><table><thead><tr><th>{L(locale, 'Area', 'المجال')}</th><th>{L(locale, 'SOP', 'الإجراء')}</th><th>{L(locale, 'Purpose', 'الهدف')}</th></tr></thead><tbody>{snapshot.sopLibrary.map((sop) => <tr key={sop.area}><td>{sop.area}</td><td>{L(locale, sop.titleEn, sop.titleAr)}</td><td>{L(locale, sop.purposeEn, sop.purposeAr)}</td></tr>)}</tbody></table></div></section>}

    {tab === 'training' && <section className="card"><div className="card-header"><div className="card-title"><GraduationCap size={18}/>{L(locale, 'Role-based training plan', 'خطة التدريب حسب الدور')}</div></div><div className="grid two">{snapshot.trainingPlan.map((item) => <div className="soft-panel" key={item.roleEn}><strong>{L(locale, item.roleEn, item.roleAr)}</strong><ul>{item.sessions.map((s) => <li key={s}>{s}</li>)}</ul><small>{item.signoff}</small></div>)}</div></section>}

    {tab === 'support' && <section className="card"><div className="card-header"><div className="card-title"><LifeBuoy size={18}/>{L(locale, 'Support and escalation model', 'نموذج الدعم والتصعيد')}</div></div><div className="grid three">{snapshot.supportModel.map((item) => <div className="soft-panel" key={item.tier}><strong>{item.tier}</strong><p>{item.owner}</p><small>{item.response}</small><ul>{item.examples.map((x) => <li key={x}>{x}</li>)}</ul></div>)}</div></section>}

    {tab === 'quality' && <section className="card"><div className="card-header"><div className="card-title"><Activity size={18}/>{L(locale, 'Data quality and launch checklist', 'جودة البيانات وقائمة التشغيل')}</div></div><div className="grid two"><div className="table-wrap"><table><thead><tr><th>{L(locale, 'Metric', 'المؤشر')}</th><th>{L(locale, 'Target', 'المستهدف')}</th><th>{L(locale, 'Current', 'الحالي')}</th><th>{L(locale, 'Status', 'الحالة')}</th></tr></thead><tbody>{snapshot.dataQuality.map((m) => <tr key={m.metric}><td>{m.metric}</td><td>{m.target}</td><td>{m.current}</td><td><span className={`status-pill ${m.status}`}>{statusLabel(m.status)}</span></td></tr>)}</tbody></table></div><div className="checklist-panel">{snapshot.launchChecklist.map((item) => <div className="check-row" key={item.key}>{item.done ? <CheckCircle2 size={16}/> : <XCircle size={16}/>}<div><strong>{L(locale, item.labelEn, item.labelAr)}</strong><small>{item.evidence}</small></div></div>)}</div></div></section>}
  </div>;
}
