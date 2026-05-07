import { useMemo, useState } from 'react';
import { AlertTriangle, CheckCircle2, ClipboardCopy, Database, LockKeyhole, Server, ShieldCheck, XCircle } from 'lucide-react';
import { buildV382BackendModeSnapshot, v382ChecksToRows, type V382CheckStatus, type V382GateStatus } from '../engines/enterpriseV382BackendModeEngine';

type Locale = 'en' | 'ar';

type Props = {
  locale: Locale;
  notify?: (type: 'success' | 'warning' | 'error', message: string) => void;
};

function L(locale: Locale, en: string, ar: string) {
  return locale === 'ar' ? ar : en;
}

function statusLabel(status: V382GateStatus, locale: Locale) {
  const labels: Record<V382GateStatus, [string, string]> = {
    'safe-local': ['Safe local demo', 'تجربة محلية آمنة'],
    'staging-watch': ['Staging watch', 'تجهيز تجريبي مع ملاحظات'],
    'staging-ready': ['Staging ready', 'جاهز للتجربة'],
    'production-blocked': ['Production blocked', 'الإنتاج محجوب'],
    'production-ready': ['Production gate ready', 'بوابة الإنتاج جاهزة'],
    unsafe: ['Unsafe configuration', 'إعداد غير آمن'],
  };
  const [en, ar] = labels[status];
  return L(locale, en, ar);
}

function statusClass(status: V382CheckStatus | V382GateStatus) {
  if (status === 'pass' || status === 'staging-ready' || status === 'production-ready') return 'success';
  if (status === 'fail' || status === 'unsafe' || status === 'production-blocked') return 'danger';
  return 'warning';
}

function StatusIcon({ status }: { status: V382CheckStatus | V382GateStatus }) {
  if (status === 'pass' || status === 'staging-ready' || status === 'production-ready') return <CheckCircle2 size={18} />;
  if (status === 'fail' || status === 'unsafe' || status === 'production-blocked') return <XCircle size={18} />;
  return <AlertTriangle size={18} />;
}

function Card({ title, children, icon }: { title: string; children: React.ReactNode; icon?: React.ReactNode }) {
  return <section className="card"><div className="card-header"><div className="card-title">{icon}{title}</div></div>{children}</section>;
}

function KPI({ label, value, hint, icon }: { label: string; value: string; hint: string; icon: React.ReactNode }) {
  return <div className="kpi"><div className="kpi-icon">{icon}</div><div><span>{label}</span><strong>{value}</strong><small>{hint}</small></div></div>;
}

export default function EnterpriseV382BackendModePage({ locale, notify }: Props) {
  const snapshot = useMemo(() => buildV382BackendModeSnapshot(), []);
  const rows = useMemo(() => v382ChecksToRows(snapshot), [snapshot]);
  const [copied, setCopied] = useState(false);

  const copyEnv = async () => {
    try {
      await navigator.clipboard.writeText(snapshot.envRecipe);
      setCopied(true);
      notify?.('success', L(locale, 'Staging .env.local recipe copied.', 'تم نسخ إعدادات .env.local للتجربة.'));
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      notify?.('warning', L(locale, 'Could not copy automatically. Select the text manually.', 'تعذر النسخ التلقائي. يرجى تحديد النص يدوياً.'));
    }
  };

  return <div className="page-grid">
    <section className={`hero-panel ${statusClass(snapshot.gateStatus)}`}>
      <div>
        <span className="eyebrow">{L(locale, 'v382 Backend Mode Gate', 'v382 بوابة نمط الخلفية')}</span>
        <h2>{statusLabel(snapshot.gateStatus, locale)}</h2>
        <p>{snapshot.nextAction}</p>
      </div>
      <div className="hero-score"><strong>{snapshot.gateScore}</strong><span>{L(locale, 'gate score', 'درجة البوابة')}</span></div>
    </section>

    <div className="kpi-grid">
      <KPI label={L(locale, 'Runtime mode', 'نمط التشغيل')} value={snapshot.runtimeMode} hint={L(locale, 'local / staging / production', 'محلي / تجريبي / إنتاج')} icon={<Server />} />
      <KPI label={L(locale, 'Backend configured', 'اتصال الخلفية')} value={snapshot.backendConfigured ? L(locale, 'Yes', 'نعم') : L(locale, 'No', 'لا')} hint={L(locale, 'Supabase URL + anon key', 'رابط Supabase ومفتاح anon')} icon={<Database />} />
      <KPI label={L(locale, 'Auth required', 'المصادقة مطلوبة')} value={snapshot.authRequired ? L(locale, 'Yes', 'نعم') : L(locale, 'No', 'لا')} hint={L(locale, 'Production forces this on', 'الإنتاج يفرض ذلك')} icon={<LockKeyhole />} />
      <KPI label={L(locale, 'Service key exposed', 'تسريب مفتاح الخدمة')} value={snapshot.serviceRoleExposure ? L(locale, 'Yes', 'نعم') : L(locale, 'No', 'لا')} hint={L(locale, 'Must always be no', 'يجب أن تكون لا دائماً')} icon={<ShieldCheck />} />
    </div>

    <Card title={L(locale, 'Backend cutover checks', 'فحوصات الانتقال إلى الخلفية')} icon={<ShieldCheck size={18} />}>
      <div className="table-wrap"><table><thead><tr>
        <th>{L(locale, 'Check', 'الفحص')}</th>
        <th>{L(locale, 'Status', 'الحالة')}</th>
        <th>{L(locale, 'Evidence', 'الدليل')}</th>
        <th>{L(locale, 'Action', 'الإجراء')}</th>
      </tr></thead><tbody>{rows.map((row) => <tr key={row.key}>
        <td><strong>{row.label}</strong><br/><small>{row.severity}</small></td>
        <td><span className={`status-pill ${statusClass(row.status)}`}><StatusIcon status={row.status} /> {row.status}</span></td>
        <td>{row.evidence}</td>
        <td>{row.action}</td>
      </tr>)}</tbody></table></div>
    </Card>

    <Card title={L(locale, 'Redacted runtime environment', 'بيئة التشغيل بدون أسرار')} icon={<Database size={18} />}>
      <div className="table-wrap"><table><tbody>{Object.entries(snapshot.redactedEnvironment).map(([key, value]) => <tr key={key}><td><strong>{key}</strong></td><td>{value}</td></tr>)}</tbody></table></div>
      <div className="notice warning">{L(locale, 'Never paste or commit service-role keys in frontend VITE variables.', 'لا تضع أو تحفظ مفاتيح service-role في متغيرات VITE الخاصة بالواجهة.')}</div>
    </Card>

    <Card title={L(locale, 'Staging .env.local recipe', 'وصفة .env.local للتجربة')} icon={<ClipboardCopy size={18} />}>
      <textarea readOnly rows={9} value={snapshot.envRecipe} style={{ width: '100%', fontFamily: 'monospace' }} />
      <div className="actions"><button onClick={copyEnv}><ClipboardCopy size={16} /> {copied ? L(locale, 'Copied', 'تم النسخ') : L(locale, 'Copy recipe', 'نسخ الإعدادات')}</button></div>
    </Card>

    <Card title={L(locale, 'Safe cutover order', 'ترتيب الانتقال الآمن')} icon={<CheckCircle2 size={18} />}>
      <ol className="clean-list">
        <li>{L(locale, 'Keep local-demo for UI and workflow testing.', 'استخدم الوضع المحلي فقط لتجارب الواجهة وسير العمل.')}</li>
        <li>{L(locale, 'Use staging with local Supabase after migrations pass.', 'استخدم وضع التجربة مع Supabase المحلي بعد نجاح الهجرات.')}</li>
        <li>{L(locale, 'Run qa:all, supabase db reset, backup export, restore preview, and UAT scenario pack.', 'شغّل qa:all و supabase db reset ونسخة احتياطية وتجربة استعادة وحزمة UAT.')}</li>
        <li>{L(locale, 'Only production after auth, RLS, backup, and restore evidence are signed off.', 'لا تنتقل للإنتاج إلا بعد اعتماد المصادقة وRLS والنسخ والاستعادة.')}</li>
      </ol>
    </Card>
  </div>;
}
