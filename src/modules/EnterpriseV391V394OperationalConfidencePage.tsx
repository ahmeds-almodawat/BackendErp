import { useMemo, type ReactNode } from 'react';
import { AlertTriangle, BarChart3, CheckCircle2, ClipboardCheck, Download, Gauge, LifeBuoy, ShieldCheck, Siren } from 'lucide-react';
import { buildV391V394Gate, v391V394RowsToCsv, type V391V394GateId } from '../engines/enterpriseV391V394OperationalConfidenceEngine';

type Locale = 'en' | 'ar';

type Props = {
  gateId: V391V394GateId;
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

function safeGate(rawGate: any, gateId: V391V394GateId) {
  const fallback = {
    gateId,
    version: 'v391-v394 Operational Confidence Gates',
    title: 'Operational Confidence Gate',
    titleAr: 'بوابة الثقة التشغيلية',
    generatedAt: new Date().toISOString(),
    score: 0,
    status: 'blocked',
    counts: {},
    checks: [],
    findings: [{ severity: 'critical', area: 'Gate engine', finding: 'Gate snapshot was incomplete.', action: 'Review gate engine output and route wiring.' }],
    cutoverRule: 'Gate must render a complete snapshot before pilot use.',
    cutoverRuleAr: 'يجب أن تعرض البوابة لقطة مكتملة قبل الاستخدام التجريبي.',
    nextAction: 'Repair gate snapshot.',
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

function iconFor(gateId: V391V394GateId) {
  if (gateId === 'reportPack') return <BarChart3/>;
  if (gateId === 'alerts') return <Siren/>;
  if (gateId === 'support') return <LifeBuoy/>;
  return <Gauge/>;
}

function prefixFor(gateId: V391V394GateId) {
  if (gateId === 'reportPack') return 'v391';
  if (gateId === 'alerts') return 'v392';
  if (gateId === 'support') return 'v393';
  return 'v394';
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

export default function EnterpriseV391V394OperationalConfidencePage({ gateId, state, totals = {}, locale, notify }: Props) {
  const gate = useMemo(() => safeGate(buildV391V394Gate(state, gateId, totals), gateId), [state, totals, gateId]);
  const critical = gate.findings.filter((finding: any) => finding.severity === 'critical').length;
  const warnings = gate.findings.filter((finding: any) => finding.severity === 'warning').length;
  const exportCsv = () => {
    downloadText(`${prefixFor(gateId).toLowerCase()}-${gateId}-confidence-${new Date().toISOString().slice(0, 10)}.csv`, v391V394RowsToCsv(gate));
    notify?.('success', L(locale, 'Operational confidence CSV exported.', 'تم تصدير ملف ثقة التشغيل.'));
  };

  return <div className="space-y">
    <div className="page-intro">
      <div>
        <span className="eyebrow">{prefixFor(gateId)}</span>
        <h2>{L(locale, gate.title, gate.titleAr)}</h2>
        <p>{L(locale, 'Operational confidence gate for UAT readiness. This is an evidence layer; it does not mutate reports, alerts, support records, or performance settings.', 'بوابة ثقة تشغيلية لجاهزية الاختبار. هذه طبقة إثبات ولا تعدل التقارير أو التنبيهات أو سجلات الدعم أو إعدادات الأداء.')}</p>
      </div>
      <button onClick={exportCsv}><Download size={16}/>{L(locale, 'Export CSV', 'تصدير CSV')}</button>
    </div>

    <div className="kpi-grid">
      <MiniKpi label={L(locale, 'Gate score', 'درجة البوابة')} value={`${gate.score}%`} hint={L(locale, 'Operational confidence', 'الثقة التشغيلية')} icon={<ShieldCheck/>}/>
      <MiniKpi label={L(locale, 'Gate status', 'حالة البوابة')} value={String(gate.status).toUpperCase()} hint={gate.nextAction} icon={iconFor(gateId)}/>
      <MiniKpi label={L(locale, 'Critical findings', 'ملاحظات حرجة')} value={`${critical}`} hint={L(locale, 'Must close before UAT', 'يجب إغلاقها قبل الاختبار')} icon={<AlertTriangle/>}/>
      <MiniKpi label={L(locale, 'Warnings', 'تحذيرات')} value={`${warnings}`} hint={L(locale, 'Need evidence before pilot', 'تحتاج إثبات قبل التجربة')} icon={<ClipboardCheck/>}/>
    </div>

    <Card title={L(locale, 'Confidence checks', 'فحوص الثقة')} icon={<CheckCircle2/>}>
      <Table headers={[L(locale, 'Check', 'الفحص'), L(locale, 'Status', 'الحالة'), L(locale, 'Evidence', 'الدليل'), L(locale, 'Next action', 'الإجراء التالي')]} rows={gate.checks.map((row: any) => [row.check, <StatusPill value={row.status}/>, row.evidence, row.nextAction])}/>
    </Card>

    <Card title={L(locale, 'Findings and required actions', 'الملاحظات والإجراءات المطلوبة')} icon={<ClipboardCheck/>}>
      <Table headers={[L(locale, 'Severity', 'الخطورة'), L(locale, 'Area', 'المجال'), L(locale, 'Finding', 'الملاحظة'), L(locale, 'Required action', 'الإجراء المطلوب')]} rows={gate.findings.map((finding: any) => [<StatusPill value={finding.severity}/>, finding.area, finding.finding, finding.action])}/>
    </Card>

    <div className="two-col">
      <Card title={L(locale, 'Counts', 'العدادات')} icon={iconFor(gateId)}>
        <Table headers={[L(locale, 'Object', 'العنصر'), L(locale, 'Count', 'العدد')]} rows={countRows(gate.counts)}/>
      </Card>
      <Card title={L(locale, 'Cutover rule', 'قاعدة التحويل')} icon={<ShieldCheck/>}>
        <div className="notice">{L(locale, gate.cutoverRule, gate.cutoverRuleAr)}</div>
      </Card>
    </div>
  </div>;
}
