import { useMemo, useState } from 'react';
import { AlertTriangle, CheckCircle2, ClipboardCopy, Download, KeyRound, LockKeyhole, Route, ShieldCheck, UserCheck, XCircle } from 'lucide-react';
import {
  buildV383RBACSnapshot,
  v383RowsToCsv,
  type V383CoverageRow,
  type V383CoverageStatus,
  type V383GateStatus,
} from '../engines/enterpriseV383RBACHardeningEngine';

type Locale = 'en' | 'ar';

type Props = {
  state: any;
  locale: Locale;
  notify?: (type: 'success' | 'warning' | 'error', message: string) => void;
};

const PERMISSION_CATALOG = [
  { key: 'dashboard.view' },
  { key: 'settings.master.manage' },
  { key: 'inventory.view' },
  { key: 'inventory.transfer.post' },
  { key: 'inventory.adjustment.request' },
  { key: 'inventory.adjustment.approve' },
  { key: 'purchasing.invoice.create' },
  { key: 'purchasing.invoice.post' },
  { key: 'purchasing.po.approve' },
  { key: 'purchasing.grn.post' },
  { key: 'purchasing.payment.post' },
  { key: 'production.recipe.manage' },
  { key: 'production.batch.create' },
  { key: 'production.batch.post' },
  { key: 'production.variance.view' },
  { key: 'sales.post' },
  { key: 'pos.shift.open' },
  { key: 'finance.view' },
  { key: 'finance.journal.create' },
  { key: 'finance.journal.post' },
  { key: 'finance.statements.view' },
  { key: 'finance.assets.manage' },
  { key: 'finance.bank.reconcile' },
  { key: 'finance.period.lock' },
  { key: 'finance.opening.post' },
  { key: 'finance.payment_run.post' },
  { key: 'access.user.create' },
  { key: 'access.user.manage' },
  { key: 'hr.employee.manage' },
  { key: 'hr.attendance.punch_own' },
  { key: 'imports.manage' },
  { key: 'access.manage' },
];

function L(locale: Locale, en: string, ar: string) {
  return locale === 'ar' ? ar : en;
}

function gateLabel(status: V383GateStatus, locale: Locale) {
  const labels: Record<V383GateStatus, [string, string]> = {
    'local-watch': ['Local RBAC watch', 'مراقبة الصلاحيات محلياً'],
    'staging-blocked': ['Staging blocked', 'التجربة محجوبة'],
    'staging-ready': ['Staging RBAC ready', 'صلاحيات التجربة جاهزة'],
    'production-blocked': ['Production blocked', 'الإنتاج محجوب'],
    'production-ready': ['Production RBAC ready', 'صلاحيات الإنتاج جاهزة'],
  };
  const [en, ar] = labels[status];
  return L(locale, en, ar);
}

function statusClass(status: V383CoverageStatus | V383GateStatus) {
  if (status === 'covered' || status === 'staging-ready' || status === 'production-ready') return 'success';
  if (status === 'missing' || status === 'staging-blocked' || status === 'production-blocked') return 'danger';
  return 'warning';
}

function StatusIcon({ status }: { status: V383CoverageStatus | V383GateStatus }) {
  if (status === 'covered' || status === 'staging-ready' || status === 'production-ready') return <CheckCircle2 size={18} />;
  if (status === 'missing' || status === 'staging-blocked' || status === 'production-blocked') return <XCircle size={18} />;
  return <AlertTriangle size={18} />;
}

function Card({ title, children, icon }: { title: string; children: React.ReactNode; icon?: React.ReactNode }) {
  return <section className="card"><div className="card-header"><div className="card-title">{icon}{title}</div></div>{children}</section>;
}

function KPI({ label, value, hint, icon }: { label: string; value: string; hint: string; icon: React.ReactNode }) {
  return <div className="kpi"><div className="kpi-icon">{icon}</div><div><span>{label}</span><strong>{value}</strong><small>{hint}</small></div></div>;
}

function CoverageTable({ rows, locale }: { rows: V383CoverageRow[]; locale: Locale }) {
  return <div className="table-wrap"><table><thead><tr>
    <th>{L(locale, 'Control', 'الضابط')}</th>
    <th>{L(locale, 'Permission', 'الصلاحية')}</th>
    <th>{L(locale, 'Status', 'الحالة')}</th>
    <th>{L(locale, 'Evidence', 'الدليل')}</th>
    <th>{L(locale, 'Action', 'الإجراء')}</th>
  </tr></thead><tbody>{rows.map((row) => <tr key={`${row.key}-${row.label}`}>
    <td><strong>{row.label}</strong><br/><small>{row.risk}</small></td>
    <td><code>{row.requiredPermission}</code></td>
    <td><span className={`status-pill ${statusClass(row.status)}`}><StatusIcon status={row.status} /> {row.status}</span></td>
    <td>{row.evidence}</td>
    <td>{row.action}</td>
  </tr>)}</tbody></table></div>;
}

export default function EnterpriseV383RBACPage({ state, locale, notify }: Props) {
  const snapshot = useMemo(() => buildV383RBACSnapshot(state, PERMISSION_CATALOG), [state]);
  const [copied, setCopied] = useState(false);
  const criticalFindings = snapshot.findings.filter((finding) => finding.risk === 'critical').length;
  const missingFindings = snapshot.findings.filter((finding) => finding.status === 'missing').length;

  const exportCsv = () => {
    const csv = v383RowsToCsv([...snapshot.routeCoverage, ...snapshot.rpcCoverage, ...snapshot.dangerousActionCoverage, ...snapshot.findings]);
    const blob = new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `v383-rbac-hardening-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    notify?.('success', L(locale, 'RBAC hardening CSV exported.', 'تم تصدير ملف صلاحيات RBAC.'));
  };

  const copyChecklist = async () => {
    const text = [
      'v383 RBAC Production Hardening Checklist',
      `Status: ${snapshot.gateStatus}`,
      `Score: ${snapshot.gateScore}`,
      `Critical findings: ${criticalFindings}`,
      `Missing mappings: ${missingFindings}`,
      '',
      ...snapshot.findings.slice(0, 20).map((finding) => `- ${finding.label}: ${finding.action}`),
    ].join('\n');
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      notify?.('success', L(locale, 'RBAC checklist copied.', 'تم نسخ قائمة صلاحيات RBAC.'));
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      notify?.('warning', L(locale, 'Could not copy checklist automatically.', 'تعذر نسخ القائمة تلقائياً.'));
    }
  };

  return <div className="page-grid">
    <section className={`hero-panel ${statusClass(snapshot.gateStatus)}`}>
      <div>
        <span className="eyebrow">{L(locale, 'v383 RBAC Production Hardening', 'v383 تقوية الصلاحيات للإنتاج')}</span>
        <h2>{gateLabel(snapshot.gateStatus, locale)}</h2>
        <p>{snapshot.nextAction}</p>
      </div>
      <div className="hero-score"><strong>{snapshot.gateScore}</strong><span>{L(locale, 'RBAC score', 'درجة الصلاحيات')}</span></div>
    </section>

    <div className="kpi-grid">
      <KPI label={L(locale, 'Permissions', 'الصلاحيات')} value={String(snapshot.permissionCount)} hint={L(locale, 'catalog keys', 'مفاتيح الكتالوج')} icon={<KeyRound />} />
      <KPI label={L(locale, 'Roles', 'الأدوار')} value={String(snapshot.roleCount)} hint={L(locale, 'local role definitions', 'تعريفات الأدوار المحلية')} icon={<ShieldCheck />} />
      <KPI label={L(locale, 'Active users', 'المستخدمون النشطون')} value={String(snapshot.activeUserCount)} hint={L(locale, 'must have scope', 'يجب ربطهم بالنطاق')} icon={<UserCheck />} />
      <KPI label={L(locale, 'Critical findings', 'ملاحظات حرجة')} value={String(criticalFindings)} hint={L(locale, 'block production', 'تحجب الإنتاج')} icon={<LockKeyhole />} />
    </div>

    <Card title={L(locale, 'Production gate actions', 'إجراءات بوابة الإنتاج')} icon={<ShieldCheck size={18} />}>
      <div className="actions">
        <button onClick={copyChecklist}><ClipboardCopy size={16} /> {copied ? L(locale, 'Copied', 'تم النسخ') : L(locale, 'Copy checklist', 'نسخ القائمة')}</button>
        <button onClick={exportCsv}><Download size={16} /> {L(locale, 'Export CSV', 'تصدير CSV')}</button>
      </div>
      <div className="notice warning">{L(locale, 'v383 is a gate and evidence layer. It does not replace Supabase RLS tests or server-side permission checks.', 'v383 هي طبقة بوابة وأدلة ولا تغني عن اختبارات RLS وفحوصات الصلاحيات في الخادم.')}</div>
    </Card>

    <Card title={L(locale, 'Route permission map', 'خريطة صلاحيات الصفحات')} icon={<Route size={18} />}>
      <CoverageTable rows={snapshot.routeCoverage} locale={locale} />
    </Card>

    <Card title={L(locale, 'Backend RPC permission map', 'خريطة صلاحيات وظائف الخلفية')} icon={<LockKeyhole size={18} />}>
      <CoverageTable rows={snapshot.rpcCoverage} locale={locale} />
    </Card>

    <Card title={L(locale, 'Dangerous action inventory', 'قائمة الإجراءات الحساسة')} icon={<AlertTriangle size={18} />}>
      <CoverageTable rows={snapshot.dangerousActionCoverage} locale={locale} />
    </Card>

    <Card title={L(locale, 'Open RBAC findings', 'ملاحظات الصلاحيات المفتوحة')} icon={<XCircle size={18} />}>
      {snapshot.findings.length ? <CoverageTable rows={snapshot.findings} locale={locale} /> : <div className="notice success">{L(locale, 'No open RBAC findings detected by the v383 gate.', 'لم يتم رصد ملاحظات صلاحيات مفتوحة من بوابة v383.')}</div>}
    </Card>
  </div>;
}
