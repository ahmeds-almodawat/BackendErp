import { useMemo, type ReactNode } from 'react';
import { AlertTriangle, CheckCircle2, ClipboardCheck, Download, Factory, FileText, Landmark, PackageCheck, ShieldCheck, ShoppingCart, Users } from 'lucide-react';
import { getV386V390Gate, v386V390GateRowsToCsv, type V386V390GateId, type V386V390GateStatus } from '../engines/enterpriseV386V390OperationalGatesEngine';

type Locale = 'en' | 'ar';

type Props = {
  gateId: V386V390GateId;
  state: any;
  locale: Locale;
  notify?: (type: 'success' | 'warning' | 'error', message: string) => void;
};

function L(locale: Locale, en: string, ar: string) {
  return locale === 'ar' ? ar : en;
}

function toneFor(status: string) {
  if (status === 'ready' || status === 'good') return 'good';
  if (status === 'blocked' || status === 'critical') return 'bad';
  return 'warn';
}

function StatusPill({ value }: { value: string }) {
  return <span className={`status ${toneFor(value)}`}>{value}</span>;
}

function iconFor(gateId: V386V390GateId) {
  if (gateId === 'inventory') return <PackageCheck/>;
  if (gateId === 'sales') return <ShoppingCart/>;
  if (gateId === 'production') return <Factory/>;
  if (gateId === 'financeClose') return <Landmark/>;
  return <Users/>;
}

function titlePrefix(gateId: V386V390GateId) {
  if (gateId === 'inventory') return 'v386';
  if (gateId === 'sales') return 'v387';
  if (gateId === 'production') return 'v388';
  if (gateId === 'financeClose') return 'v389';
  return 'v390';
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

const EMPTY_GATE = {
  gateId: 'inventory' as V386V390GateId,
  version: 'v386-v390 Operational Gate Safe Fallback',
  title: 'Operational Gate',
  titleAr: 'بوابة تشغيلية',
  generatedAt: new Date(0).toISOString(),
  score: 0,
  status: 'blocked' as V386V390GateStatus,
  counts: {},
  checks: [],
  findings: [{
    severity: 'critical' as const,
    area: 'Gate rendering',
    finding: 'The requested operational gate returned incomplete data.',
    action: 'Run qa:v386-v390 and refresh the local state after applying the hotfix.',
  }],
  cutoverRule: 'This gate is blocked until operational evidence can be rendered safely.',
  cutoverRuleAr: 'هذه البوابة متوقفة حتى يمكن عرض أدلة التشغيل بأمان.',
  nextAction: 'Refresh the page after applying the v386-v390 render safety hotfix.',
};

export default function EnterpriseV386V390OperationalGatePage({ gateId, state, locale, notify }: Props) {
  const rawGate = useMemo(() => getV386V390Gate(state, gateId), [state, gateId]);
  const gate = rawGate && typeof rawGate === 'object' ? rawGate : { ...EMPTY_GATE, gateId };
  const findings = Array.isArray(gate.findings) ? gate.findings : EMPTY_GATE.findings;
  const checks = Array.isArray(gate.checks) ? gate.checks : [];
  const counts = gate.counts && typeof gate.counts === 'object' ? gate.counts : {};
  const title = gate.title || EMPTY_GATE.title;
  const titleAr = gate.titleAr || EMPTY_GATE.titleAr;
  const cutoverRule = gate.cutoverRule || EMPTY_GATE.cutoverRule;
  const cutoverRuleAr = gate.cutoverRuleAr || EMPTY_GATE.cutoverRuleAr;
  const status = String(gate.status || 'blocked');
  const score = Number.isFinite(Number(gate.score)) ? Number(gate.score) : 0;
  const nextAction = gate.nextAction || EMPTY_GATE.nextAction;
  const critical = findings.filter((finding) => finding.severity === 'critical').length;
  const warnings = findings.filter((finding) => finding.severity === 'warning').length;
  const exportCsv = () => {
    downloadText(`${titlePrefix(gateId).toLowerCase()}-${gateId}-gate-${new Date().toISOString().slice(0, 10)}.csv`, v386V390GateRowsToCsv({ ...gate, findings, checks, counts }));
    notify?.('success', L(locale, 'Operational gate CSV exported.', 'تم تصدير ملف تدقيق البوابة التشغيلية.'));
  };

  return <div className="space-y">
    <div className="page-intro">
      <div>
        <span className="eyebrow">{titlePrefix(gateId)}</span>
        <h2>{L(locale, title, titleAr)}</h2>
        <p>{L(locale, 'Operational readiness gate for pilot cutover. This is an evidence layer; it does not mutate accounting, stock, payroll, or POS posting.', 'بوابة جاهزية تشغيلية للتجربة. هذه طبقة إثبات ولا تعدل القيود أو المخزون أو الرواتب أو ترحيل نقاط البيع.')}</p>
      </div>
      <button onClick={exportCsv}><Download size={16}/>{L(locale, 'Export CSV', 'تصدير CSV')}</button>
    </div>

    <div className="kpi-grid">
      <MiniKpi label={L(locale, 'Gate score', 'درجة البوابة')} value={`${score}%`} hint={L(locale, 'Operational readiness', 'الجاهزية التشغيلية')} icon={<ShieldCheck/>}/>
      <MiniKpi label={L(locale, 'Gate status', 'حالة البوابة')} value={status.toUpperCase()} hint={nextAction} icon={iconFor(gateId)}/>
      <MiniKpi label={L(locale, 'Critical findings', 'ملاحظات حرجة')} value={`${critical}`} hint={L(locale, 'Must be resolved before pilot', 'يجب حلها قبل التجربة')} icon={<AlertTriangle/>}/>
      <MiniKpi label={L(locale, 'Warnings', 'تحذيرات')} value={`${warnings}`} hint={L(locale, 'Need evidence before cutover', 'تحتاج إثبات قبل التحويل')} icon={<ClipboardCheck/>}/>
    </div>

    <Card title={L(locale, 'Readiness checks', 'فحوص الجاهزية')} icon={<CheckCircle2/>}>
      <Table headers={[L(locale, 'Check', 'الفحص'), L(locale, 'Status', 'الحالة'), L(locale, 'Evidence', 'الدليل'), L(locale, 'Next action', 'الإجراء التالي')]} rows={checks.map((row) => [row.check, <StatusPill value={row.status}/>, row.evidence, row.nextAction])}/>
    </Card>

    <Card title={L(locale, 'Findings and required actions', 'الملاحظات والإجراءات المطلوبة')} icon={<FileText/>}>
      <Table headers={[L(locale, 'Severity', 'الخطورة'), L(locale, 'Area', 'المجال'), L(locale, 'Finding', 'الملاحظة'), L(locale, 'Required action', 'الإجراء المطلوب')]} rows={findings.map((finding) => [<StatusPill value={finding.severity}/>, finding.area, finding.finding, finding.action])}/>
    </Card>

    <div className="two-col">
      <Card title={L(locale, 'Counts', 'العدادات')} icon={iconFor(gateId)}>
        <Table headers={[L(locale, 'Object', 'العنصر'), L(locale, 'Count', 'العدد')]} rows={countRows(counts)}/>
      </Card>
      <Card title={L(locale, 'Cutover rule', 'قاعدة التحويل')} icon={<ShieldCheck/>}>
        <div className="notice">{L(locale, cutoverRule, cutoverRuleAr)}</div>
      </Card>
    </div>
  </div>;
}
