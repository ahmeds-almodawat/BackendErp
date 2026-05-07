import { useMemo, useState } from 'react';
import { AlertTriangle, CheckCircle2, ClipboardCheck, Database, Download, FileText, PlayCircle, Rocket, ShieldCheck, XCircle } from 'lucide-react';
import { getSupabaseClient, isSupabaseConfigured } from '../lib/supabase/supabaseClient';
import {
  V407_POSTING_ACTIONS,
  buildV407V420PilotSnapshot,
  v407PilotRowsToCsv,
  type V407PilotStatus,
  type V407PostingAction,
  type V407PostingActionKey,
} from '../engines/enterpriseV407V420PilotEngine';

type Locale = 'en' | 'ar';
type Notify = (type: 'success' | 'warning' | 'error', message: string) => void;

type Props = {
  state: any;
  locale: Locale;
  notify?: Notify;
};

type ActionInputs = Record<string, { id?: string; periodKey?: string; branchId?: string }>;

function L(locale: Locale, en: string, ar: string) { return locale === 'ar' ? ar : en; }

function statusClass(status: V407PilotStatus | string) {
  if (status === 'ready' || status === 'good') return 'success';
  if (status === 'blocked' || status === 'critical') return 'danger';
  return 'warning';
}

function StatusIcon({ status }: { status: V407PilotStatus | string }) {
  if (status === 'ready' || status === 'good') return <CheckCircle2 size={18} />;
  if (status === 'blocked' || status === 'critical') return <XCircle size={18} />;
  return <AlertTriangle size={18} />;
}

function Card({ title, icon, children, action }: { title: string; icon?: React.ReactNode; children: React.ReactNode; action?: React.ReactNode }) {
  return <section className="card"><div className="card-header"><div className="card-title">{icon}{title}</div>{action}</div>{children}</section>;
}

function KPI({ label, value, hint, icon }: { label: string; value: string | number; hint: string; icon: React.ReactNode }) {
  return <div className="kpi"><div className="kpi-icon">{icon}</div><div><span>{label}</span><strong>{value}</strong><small>{hint}</small></div></div>;
}

function buildRpcArgs(action: V407PostingAction, input: { id?: string; periodKey?: string; branchId?: string }) {
  if (action.key === 'vatSettlement' || action.key === 'periodClose') {
    return {
      p_period_key: input.periodKey || new Date().toISOString().slice(0, 7),
      p_branch_id: input.branchId || null,
      p_options: { source: 'v407-v420-pilot-center', requestedAt: new Date().toISOString() },
    };
  }
  return { [action.idField || 'id']: input.id };
}

function actionInputLabel(locale: Locale, action: V407PostingAction) {
  if (action.key === 'vatSettlement' || action.key === 'periodClose') return L(locale, 'Period key', 'مفتاح الفترة');
  return action.idLabel || L(locale, 'Document UUID', 'معرّف المستند UUID');
}

export default function EnterpriseV407V420PilotCenterPage({ state, locale, notify }: Props) {
  const snapshot = useMemo(() => buildV407V420PilotSnapshot(state), [state]);
  const [inputs, setInputs] = useState<ActionInputs>(() => Object.fromEntries(V407_POSTING_ACTIONS.map((action) => [action.key, {}])));
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [resultText, setResultText] = useState('');
  const supabaseReady = isSupabaseConfigured();

  const setInput = (key: V407PostingActionKey, patch: Partial<ActionInputs[string]>) => {
    setInputs((current) => ({ ...current, [key]: { ...(current[key] || {}), ...patch } }));
  };

  const exportCsv = () => {
    const csv = v407PilotRowsToCsv(snapshot);
    const blob = new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `pilot-completion-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    notify?.('success', L(locale, 'Pilot evidence CSV exported.', 'تم تصدير ملف أدلة التشغيل التجريبي.'));
  };

  const runRpc = async (action: V407PostingAction) => {
    const input = inputs[action.key] || {};
    const client = getSupabaseClient();
    if (!client) {
      notify?.('warning', L(locale, 'Supabase is not configured in this browser session.', 'لم يتم إعداد Supabase في جلسة المتصفح هذه.'));
      return;
    }
    if (action.key !== 'vatSettlement' && action.key !== 'periodClose' && !input.id) {
      notify?.('warning', L(locale, 'Enter or select a document UUID first.', 'أدخل أو اختر معرّف المستند UUID أولاً.'));
      return;
    }
    setBusyAction(action.key);
    setResultText('');
    try {
      const args = buildRpcArgs(action, input);
      const { data, error } = await client.rpc(action.rpcName, args);
      if (error) throw new Error(error.message || 'Supabase RPC failed');
      const rendered = JSON.stringify({ rpc: action.rpcName, args, data }, null, 2);
      setResultText(rendered);
      notify?.('success', L(locale, `${action.title} RPC completed.`, `اكتمل استدعاء ${action.title}.`));
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setResultText(JSON.stringify({ rpc: action.rpcName, error: message }, null, 2));
      notify?.('error', message);
    } finally {
      setBusyAction(null);
    }
  };

  return <div className="page-grid">
    <section className="hero-card">
      <div>
        <span className="eyebrow">v407-v420 Pilot Completion</span>
        <h2>{L(locale, 'Production Pilot Center', 'مركز التشغيل التجريبي')}</h2>
        <p>{L(locale,
          'One controlled cockpit for backend posting proof, UAT evidence, report truth, backup drill, and pilot release readiness. Use this after Supabase reset, QA, and build pass.',
          'مركز موحد لإثبات الترحيل الخلفي واختبار المستخدم والتقارير والنسخ الاحتياطي وجاهزية الإطلاق التجريبي بعد نجاح Supabase reset و QA والبناء.'
        )}</p>
      </div>
      <div className={`status-pill ${statusClass(snapshot.status)}`}><StatusIcon status={snapshot.status} /> {snapshot.status}</div>
    </section>

    <div className="kpi-grid">
      <KPI label={L(locale, 'Pilot score', 'درجة التجربة')} value={`${snapshot.score}%`} hint={snapshot.nextAction} icon={<Rocket size={20} />} />
      <KPI label={L(locale, 'Backend actions', 'إجراءات الخلفية')} value={snapshot.counts.backendPostingActions} hint={L(locale, 'Critical RPCs catalogued', 'RPC حرجة موثقة')} icon={<Database size={20} />} />
      <KPI label={L(locale, 'Ready workflows', 'مسارات جاهزة')} value={snapshot.counts.readyWorkflows} hint={L(locale, 'Based on local evidence', 'بناءً على الدليل المحلي')} icon={<CheckCircle2 size={20} />} />
      <KPI label={L(locale, 'Blockers', 'العوائق')} value={snapshot.counts.criticalFindings} hint={L(locale, 'Must be zero before UAT sign-off', 'يجب أن تكون صفر قبل اعتماد UAT')} icon={<ShieldCheck size={20} />} />
    </div>

    <Card title={L(locale, 'Backend posting console', 'وحدة ترحيل الخلفية')} icon={<PlayCircle size={18} />} action={<button onClick={exportCsv}><Download size={16}/>{L(locale, 'Export evidence CSV', 'تصدير الأدلة CSV')}</button>}>
      {!supabaseReady && <div className="notice warning">{L(locale, 'Supabase environment is not configured. Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to .env.local to run live RPC proof from this page.', 'لم يتم إعداد بيئة Supabase. أضف VITE_SUPABASE_URL و VITE_SUPABASE_ANON_KEY في .env.local لتشغيل إثبات RPC من هذه الصفحة.')}</div>}
      <div className="table-wrap"><table><thead><tr>
        <th>{L(locale, 'Workflow', 'المسار')}</th>
        <th>{L(locale, 'RPC', 'RPC')}</th>
        <th>{L(locale, 'Input', 'المدخل')}</th>
        <th>{L(locale, 'Action', 'الإجراء')}</th>
      </tr></thead><tbody>{snapshot.actions.map((action) => {
        const matchingTargets = snapshot.targets.filter((target) => target.actionKey === action.key);
        const input = inputs[action.key] || {};
        return <tr key={action.key}>
          <td><strong>{action.title}</strong><br/><small>{action.requiredPermission} · {action.requiredStatus}</small><br/><small>{action.nextProof}</small></td>
          <td><code>{action.rpcName}</code><br/><small>{action.backendObject}</small></td>
          <td>
            {(action.key === 'vatSettlement' || action.key === 'periodClose') ? <div className="form-grid two">
              <label className="field"><span>{L(locale, 'Period key', 'مفتاح الفترة')}</span><input value={input.periodKey || ''} placeholder="2026-05" onChange={(e) => setInput(action.key, { periodKey: e.target.value })}/></label>
              <label className="field"><span>{L(locale, 'Branch ID optional', 'معرّف الفرع اختياري')}</span><input value={input.branchId || ''} placeholder="optional" onChange={(e) => setInput(action.key, { branchId: e.target.value })}/></label>
            </div> : <div className="form-grid">
              {Boolean(matchingTargets.length) && <select value={input.id || ''} onChange={(e) => setInput(action.key, { id: e.target.value })}>
                <option value="">{L(locale, 'Select local candidate...', 'اختر مرشحًا محليًا...')}</option>
                {matchingTargets.map((target) => <option key={`${target.source}-${target.id}`} value={target.id}>{target.label} · {target.status || 'status?'}</option>)}
              </select>}
              <input value={input.id || ''} placeholder={actionInputLabel(locale, action)} onChange={(e) => setInput(action.key, { id: e.target.value })}/>
            </div>}
          </td>
          <td><button disabled={!supabaseReady || busyAction === action.key} onClick={() => runRpc(action)}><PlayCircle size={16}/>{busyAction === action.key ? L(locale, 'Running...', 'جاري التنفيذ...') : L(locale, 'Run RPC', 'تشغيل RPC')}</button></td>
        </tr>;
      })}</tbody></table></div>
      {resultText && <pre className="code-block">{resultText}</pre>}
    </Card>

    <Card title={L(locale, 'Workflow readiness', 'جاهزية المسارات')} icon={<ClipboardCheck size={18} />}>
      <div className="table-wrap"><table><thead><tr>
        <th>{L(locale, 'Workflow', 'المسار')}</th>
        <th>{L(locale, 'Status', 'الحالة')}</th>
        <th>{L(locale, 'Evidence', 'الدليل')}</th>
        <th>{L(locale, 'Next proof', 'الإثبات التالي')}</th>
      </tr></thead><tbody>{snapshot.workflows.map((row) => <tr key={row.actionKey}>
        <td><strong>{row.workflow}</strong><br/><small>{row.module}</small></td>
        <td><span className={`status-pill ${statusClass(row.status)}`}><StatusIcon status={row.status}/> {row.status}</span></td>
        <td>{row.evidence}<br/><small>{row.blocker}</small></td>
        <td>{row.nextAction}</td>
      </tr>)}</tbody></table></div>
    </Card>

    <Card title={L(locale, 'Pilot checklist', 'قائمة اعتماد التجربة')} icon={<FileText size={18} />}>
      <div className="table-wrap"><table><thead><tr>
        <th>{L(locale, 'Item', 'البند')}</th>
        <th>{L(locale, 'Status', 'الحالة')}</th>
        <th>{L(locale, 'Owner', 'المسؤول')}</th>
        <th>{L(locale, 'Exit criteria', 'شرط الخروج')}</th>
      </tr></thead><tbody>{snapshot.checklist.map((item) => <tr key={item.key}>
        <td><strong>{item.title}</strong><br/><small>{item.evidence}</small></td>
        <td><span className={`status-pill ${statusClass(item.status)}`}><StatusIcon status={item.status}/> {item.status}</span></td>
        <td>{item.owner}</td>
        <td>{item.exitCriteria}</td>
      </tr>)}</tbody></table></div>
    </Card>

    <Card title={L(locale, 'Findings', 'الملاحظات')} icon={<AlertTriangle size={18} />}>
      <div className="table-wrap"><table><thead><tr>
        <th>{L(locale, 'Severity', 'الخطورة')}</th>
        <th>{L(locale, 'Area', 'المجال')}</th>
        <th>{L(locale, 'Finding', 'الملاحظة')}</th>
        <th>{L(locale, 'Action', 'الإجراء')}</th>
      </tr></thead><tbody>{snapshot.findings.map((finding, index) => <tr key={index}>
        <td><span className={`status-pill ${statusClass(finding.severity)}`}><StatusIcon status={finding.severity}/> {finding.severity}</span></td>
        <td>{finding.area}</td>
        <td>{finding.finding}</td>
        <td>{finding.action}</td>
      </tr>)}</tbody></table></div>
    </Card>
  </div>;
}
