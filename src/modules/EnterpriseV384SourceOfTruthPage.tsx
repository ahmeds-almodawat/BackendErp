import { useMemo } from 'react';
import { AlertTriangle, CheckCircle2, Database, Download, FileText, Layers, LockKeyhole, ShieldCheck, XCircle } from 'lucide-react';
import {
  buildV384AuthoritySnapshot,
  v384RowsToCsv,
  type V384AuthorityStatus,
  type V384GateStatus,
  type V384Risk,
} from '../engines/enterpriseV384SourceOfTruthEngine';

type Locale = 'en' | 'ar';

type Props = {
  state: any;
  locale: Locale;
  notify?: (type: 'success' | 'warning' | 'error', message: string) => void;
};

function L(locale: Locale, en: string, ar: string) {
  return locale === 'ar' ? ar : en;
}

function statusClass(status: V384AuthorityStatus | V384GateStatus | V384Risk) {
  if (status === 'backend-authoritative' || status === 'production-ready' || status === 'staging-ready' || status === 'low') return 'success';
  if (status === 'worker-backed' || status === 'staging-foundation' || status === 'local-watch' || status === 'medium') return 'warning';
  return 'danger';
}

function StatusIcon({ status }: { status: V384AuthorityStatus | V384GateStatus | V384Risk }) {
  if (status === 'backend-authoritative' || status === 'production-ready' || status === 'staging-ready' || status === 'low') return <CheckCircle2 size={18} />;
  if (status === 'blocked' || status === 'production-blocked' || status === 'staging-blocked' || status === 'critical') return <XCircle size={18} />;
  return <AlertTriangle size={18} />;
}

function gateLabel(status: V384GateStatus, locale: Locale) {
  const labels: Record<V384GateStatus, [string, string]> = {
    'local-watch': ['Local authority watch', 'مراقبة مصدر البيانات المحلي'],
    'staging-blocked': ['Staging blocked', 'التجربة محجوبة'],
    'staging-ready': ['Staging foundation ready', 'أساس التجربة جاهز'],
    'production-blocked': ['Production blocked', 'الإنتاج محجوب'],
    'production-ready': ['Production source-of-truth ready', 'مصدر الحقيقة للإنتاج جاهز'],
  };
  const [en, ar] = labels[status];
  return L(locale, en, ar);
}

function Card({ title, children, icon }: { title: string; children: React.ReactNode; icon?: React.ReactNode }) {
  return <section className="card"><div className="card-header"><div className="card-title">{icon}{title}</div></div>{children}</section>;
}

function KPI({ label, value, hint, icon }: { label: string; value: string; hint: string; icon: React.ReactNode }) {
  return <div className="kpi"><div className="kpi-icon">{icon}</div><div><span>{label}</span><strong>{value}</strong><small>{hint}</small></div></div>;
}

export default function EnterpriseV384SourceOfTruthPage({ state, locale, notify }: Props) {
  const snapshot = useMemo(() => buildV384AuthoritySnapshot(state), [state]);

  const exportCsv = () => {
    const rows = [
      ...snapshot.authorityRows.map((row) => ({ type: 'workflow', ...row })),
      ...snapshot.backendObjects.map((row) => ({ type: 'backend-object', ...row })),
      ...snapshot.localRisks.map((row) => ({ type: 'local-risk', ...row })),
    ];
    const csv = v384RowsToCsv(rows);
    const blob = new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `v384-source-of-truth-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    notify?.('success', L(locale, 'Source-of-truth audit CSV exported.', 'تم تصدير ملف مراجعة مصدر الحقيقة.'));
  };

  return <div className="page-grid">
    <section className="hero-card">
      <div>
        <span className="eyebrow">v384 Source of Truth Gate</span>
        <h2>{L(locale, 'Backend Source of Truth', 'مصدر الحقيقة الخلفي')}</h2>
        <p>{L(locale,
          'This gate keeps production blocked until every critical workflow has a clear backend authority instead of relying on local browser state.',
          'هذه البوابة تمنع الإنتاج حتى يكون لكل مسار حرج مصدر حقيقة خلفي واضح بدلاً من الاعتماد على بيانات المتصفح المحلية.'
        )}</p>
      </div>
      <div className={`status-pill ${statusClass(snapshot.gateStatus)}`}><StatusIcon status={snapshot.gateStatus} /> {gateLabel(snapshot.gateStatus, locale)}</div>
    </section>

    <div className="kpi-grid">
      <KPI label={L(locale, 'Authority score', 'درجة مصدر الحقيقة')} value={`${snapshot.gateScore}%`} hint={snapshot.nextAction} icon={<Database size={20} />} />
      <KPI label={L(locale, 'Production blockers', 'عوائق الإنتاج')} value={String(snapshot.counts.productionBlockers)} hint={L(locale, 'Must be zero before production.', 'يجب أن تكون صفر قبل الإنتاج.')} icon={<LockKeyhole size={20} />} />
      <KPI label={L(locale, 'Worker-backed workflows', 'مسارات مدعومة بالعامل')} value={String(snapshot.counts.workerBacked)} hint={L(locale, 'Foundation exists but needs business proof.', 'الأساس موجود ويحتاج إثبات تشغيلي.')} icon={<ShieldCheck size={20} />} />
      <KPI label={L(locale, 'Local risks', 'مخاطر محلية')} value={String(snapshot.localRisks.length)} hint={L(locale, 'Local data is demo-only until migrated.', 'البيانات المحلية للتجربة فقط حتى الترحيل.')} icon={<FileText size={20} />} />
    </div>

    <Card title={L(locale, 'Workflow authority map', 'خريطة مصدر الحقيقة للمسارات')} icon={<Layers size={18} />}>
      <div className="table-wrap"><table><thead><tr>
        <th>{L(locale, 'Workflow', 'المسار')}</th>
        <th>{L(locale, 'Status', 'الحالة')}</th>
        <th>{L(locale, 'Required backend object', 'العنصر الخلفي المطلوب')}</th>
        <th>{L(locale, 'Required gate', 'البوابة المطلوبة')}</th>
        <th>{L(locale, 'Action', 'الإجراء')}</th>
      </tr></thead><tbody>{snapshot.authorityRows.map((row) => <tr key={row.key}>
        <td><strong>{row.workflow}</strong><br/><small>{row.module} · {row.risk}</small></td>
        <td><span className={`status-pill ${statusClass(row.status)}`}><StatusIcon status={row.status} /> {row.status}</span></td>
        <td><code>{row.requiredBackendObject}</code></td>
        <td>{row.requiredGate}</td>
        <td>{row.action}</td>
      </tr>)}</tbody></table></div>
    </Card>

    <Card title={L(locale, 'Backend object readiness', 'جاهزية عناصر الخلفية')} icon={<ShieldCheck size={18} />}>
      <div className="table-wrap"><table><thead><tr>
        <th>{L(locale, 'Object', 'العنصر')}</th>
        <th>{L(locale, 'Type', 'النوع')}</th>
        <th>{L(locale, 'Status', 'الحالة')}</th>
        <th>{L(locale, 'Evidence', 'الدليل')}</th>
      </tr></thead><tbody>{snapshot.backendObjects.map((row) => <tr key={row.objectName}>
        <td><strong>{row.objectName}</strong></td>
        <td>{row.objectType}</td>
        <td><span className={`status-pill ${statusClass(row.status)}`}><StatusIcon status={row.status} /> {row.status}</span></td>
        <td>{row.evidence}</td>
      </tr>)}</tbody></table></div>
    </Card>

    <Card title={L(locale, 'Local authority risks', 'مخاطر مصدر البيانات المحلي')} icon={<AlertTriangle size={18} />}>
      {snapshot.localRisks.length ? <div className="table-wrap"><table><thead><tr>
        <th>{L(locale, 'Risk', 'الخطر')}</th>
        <th>{L(locale, 'Severity', 'الخطورة')}</th>
        <th>{L(locale, 'Evidence', 'الدليل')}</th>
        <th>{L(locale, 'Action', 'الإجراء')}</th>
      </tr></thead><tbody>{snapshot.localRisks.map((risk) => <tr key={risk.key}>
        <td><strong>{risk.label}</strong></td>
        <td><span className={`status-pill ${statusClass(risk.risk)}`}><StatusIcon status={risk.risk} /> {risk.risk}</span></td>
        <td>{risk.evidence}</td>
        <td>{risk.action}</td>
      </tr>)}</tbody></table></div> : <div className="notice success">{L(locale, 'No local source-of-truth risks detected in this state.', 'لم يتم رصد مخاطر محلية في هذه الحالة.')}</div>}
    </Card>

    <Card title={L(locale, 'Cutover rule', 'قاعدة الانتقال')} icon={<LockKeyhole size={18} />}>
      <div className="notice warning">
        {L(locale,
          'Do not enable production mode until finance posting, inventory ledger, POS settlement, import cutover, reports, RBAC, backup/restore, and audit evidence are backend-owned and tested from a fresh Supabase reset.',
          'لا تقم بتفعيل وضع الإنتاج حتى تكون قيود المالية ودفتر المخزون وتسوية نقاط البيع والاستيراد والتقارير والصلاحيات والنسخ الاحتياطي والأدلة الرقابية مملوكة للخلفية ومختبرة من قاعدة Supabase جديدة.'
        )}
      </div>
      <div className="button-row"><button onClick={exportCsv}><Download size={16} />{L(locale, 'Export authority audit CSV', 'تصدير مراجعة مصدر الحقيقة CSV')}</button></div>
    </Card>
  </div>;
}
