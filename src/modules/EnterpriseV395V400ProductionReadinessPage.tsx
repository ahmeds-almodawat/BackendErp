import { useMemo, type ReactNode } from 'react';
import { AlertTriangle, CheckCircle2, ClipboardCheck, Download, Gauge, MonitorSmartphone, Rocket, ShieldCheck, Wrench } from 'lucide-react';
import { buildV395V400Gate, v395V400RowsToCsv, type V395V400GateId } from '../engines/enterpriseV395V400ProductionReadinessEngine';

type Locale = 'en' | 'ar';

type Props = {
  gateId: V395V400GateId;
  state: any;
  totals?: any;
  locale: Locale;
  notify?: (type: 'success' | 'warning' | 'error', message: string) => void;
};

function L(locale: Locale, en: string, ar: string) {
  return locale === 'ar' ? ar : en;
}

function safeArray<T = any>(value: unknown): T[] {
  return Array.isArray(value) ? value as T[] : [];
}

function safeGate(rawGate: any, gateId: V395V400GateId) {
  const fallback = {
    gateId,
    version: 'v395-v400 Production Readiness Gates',
    title: 'Production Readiness Gate',
    titleAr: 'بوابة الجاهزية للإنتاج',
    generatedAt: new Date().toISOString(),
    score: 0,
    status: 'blocked',
    counts: {},
    checks: [],
    findings: [{ severity: 'critical', area: 'Gate engine', finding: 'Gate snapshot was incomplete.', action: 'Review v395-v400 gate engine output and route wiring.' }],
    releaseRule: 'Gate must render a complete snapshot before pilot release.',
    releaseRuleAr: 'يجب أن تعرض البوابة لقطة مكتملة قبل الإطلاق التجريبي.',
    nextAction: 'Repair production readiness gate snapshot.',
  };
  return {
    ...fallback,
    ...(rawGate && typeof rawGate === 'object' ? rawGate : {}),
    findings: safeArray(rawGate?.findings ?? fallback.findings),
    checks: safeArray(rawGate?.checks ?? fallback.checks),
    counts: rawGate?.counts && typeof rawGate.counts === 'object' ? rawGate.counts : {},
  };
}

function toneFor(status: string) {
  if (status === 'ready' || status === 'good') return 'good';
  if (status === 'blocked' || status === 'critical') return 'bad';
  return 'warn';
}

function StatusPill({ value }: { value: string }) {
  return <span className={`status ${toneFor(value)}`}>{value}</span>;
}

function iconFor(gateId: V395V400GateId) {
  if (gateId === 'tablet') return <MonitorSmartphone/>;
  if (gateId === 'deployment') return <Rocket/>;
  if (gateId === 'uat') return <ClipboardCheck/>;
  if (gateId === 'security') return <ShieldCheck/>;
  if (gateId === 'rehearsal') return <Wrench/>;
  return <Gauge/>;
}

function prefixFor(gateId: V395V400GateId) {
  if (gateId === 'tablet') return 'v395';
  if (gateId === 'deployment') return 'v396';
  if (gateId === 'uat') return 'v397';
  if (gateId === 'security') return 'v398';
  if (gateId === 'rehearsal') return 'v399';
  return 'v400';
}

function MiniKpi({ label, value, hint, icon }: { label: string; value: string; hint: string; icon: ReactNode }) {
  return <div className="kpi"><div className="kpi-icon">{icon}</div><div><span>{label}</span><strong>{value}</strong><small>{hint}</small></div></div>;
}

function Card({ title, children, icon, action }: { title: string; children: ReactNode; icon?: ReactNode; action?: ReactNode }) {
  return <section className="card"><div className="card-header"><div className="card-title">{icon}{title}</div>{action}</div>{children}</section>;
}

function Table({ headers, rows }: { headers: string[]; rows: ReactNode[][] }) {
  return <div className="table-wrap"><table><thead><tr>{headers.map((header) => <th key={header}>{header}</th>)}</tr></thead><tbody>{rows.length ? rows.map((row, rowIndex) => <tr key={rowIndex}>{row.map((cell, cellIndex) => <td key={cellIndex}>{cell}</td>)}</tr>) : <tr><td colSpan={headers.length}>—</td></tr>}</tbody></table></div>;
}

function downloadText(filename: string, content: string, mime = 'text/csv;charset=utf-8') {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

function countRows(counts: Record<string, number>) {
  return Object.entries(counts).map(([key, value]) => [key.replace(/([A-Z])/g, ' $1'), value]);
}

export default function EnterpriseV395V400ProductionReadinessPage({ gateId, state, totals = {}, locale, notify }: Props) {
  const gate = useMemo(() => safeGate(buildV395V400Gate(state, gateId, totals), gateId), [state, totals, gateId]);
  const critical = gate.findings.filter((finding: any) => finding.severity === 'critical').length;
  const warnings = gate.findings.filter((finding: any) => finding.severity === 'warning').length;
  const exportCsv = () => {
    downloadText(`${prefixFor(gateId).toLowerCase()}-${gateId}-production-readiness-${new Date().toISOString().slice(0, 10)}.csv`, v395V400RowsToCsv(gate));
    notify?.('success', L(locale, 'Production readiness CSV exported.', 'تم تصدير ملف جاهزية الإنتاج.'));
  };

  return <div className="space-y">
    <div className="page-intro">
      <div>
        <span className="eyebrow">{prefixFor(gateId)}</span>
        <h2>{L(locale, gate.title, gate.titleAr)}</h2>
        <p>{L(locale, 'Production readiness gate for tablet, deployment, UAT, security, rehearsal, and pilot release signoff. This is evidence-only and does not mutate ERP transactions.', 'بوابة جاهزية الإنتاج للأجهزة والنشر والاختبار والأمن وتجربة الإطلاق والاعتماد التجريبي. هذه طبقة إثبات فقط ولا تعدل معاملات النظام.')}</p>
      </div>
      <button onClick={exportCsv}><Download size={16}/>{L(locale, 'Export CSV', 'تصدير CSV')}</button>
    </div>

    <div className="kpi-grid">
      <MiniKpi label={L(locale, 'Gate score', 'درجة البوابة')} value={`${gate.score}%`} hint={L(locale, 'Production readiness', 'جاهزية الإنتاج')} icon={<ShieldCheck/>}/>
      <MiniKpi label={L(locale, 'Gate status', 'حالة البوابة')} value={String(gate.status).toUpperCase()} hint={gate.nextAction} icon={iconFor(gateId)}/>
      <MiniKpi label={L(locale, 'Critical blockers', 'عوائق حرجة')} value={`${critical}`} hint={L(locale, 'Must close before release', 'يجب إغلاقها قبل الإطلاق')} icon={<AlertTriangle/>}/>
      <MiniKpi label={L(locale, 'Warnings', 'تحذيرات')} value={`${warnings}`} hint={L(locale, 'Need evidence before pilot', 'تحتاج إثبات قبل التجربة')} icon={<ClipboardCheck/>}/>
    </div>

    <Card title={L(locale, 'Readiness checks', 'فحوص الجاهزية')} icon={<CheckCircle2/>}>
      <Table headers={[L(locale, 'Check', 'الفحص'), L(locale, 'Status', 'الحالة'), L(locale, 'Evidence', 'الدليل'), L(locale, 'Next action', 'الإجراء التالي')]} rows={gate.checks.map((row: any) => [row.check, <StatusPill value={row.status}/>, row.evidence, row.nextAction])}/>
    </Card>

    <Card title={L(locale, 'Findings and required actions', 'الملاحظات والإجراءات المطلوبة')} icon={<ClipboardCheck/>}>
      <Table headers={[L(locale, 'Severity', 'الخطورة'), L(locale, 'Area', 'المجال'), L(locale, 'Finding', 'الملاحظة'), L(locale, 'Required action', 'الإجراء المطلوب')]} rows={gate.findings.map((finding: any) => [<StatusPill value={finding.severity}/>, finding.area, finding.finding, finding.action])}/>
    </Card>

    <div className="two-col">
      <Card title={L(locale, 'Evidence counts', 'عدادات الإثبات')} icon={iconFor(gateId)}>
        <Table headers={[L(locale, 'Object', 'العنصر'), L(locale, 'Count', 'العدد')]} rows={countRows(gate.counts)}/>
      </Card>
      <Card title={L(locale, 'Release rule', 'قاعدة الإطلاق')} icon={<ShieldCheck/>}>
        <div className="notice">{L(locale, gate.releaseRule, gate.releaseRuleAr)}</div>
      </Card>
    </div>
  </div>;
}
