import { useMemo, type ReactNode } from 'react';
import { AlertTriangle, CheckCircle2, ClipboardCheck, Download, FileText, Link2, PackageCheck, ShieldCheck, ShoppingCart, Truck } from 'lucide-react';
import { buildV385PurchasingWorkflowSnapshot, v385PurchasingRowsToCsv, type V385StageStatus } from '../engines/enterpriseV385PurchasingWorkflowEngine';

type Locale = 'en' | 'ar';

type Props = {
  state: any;
  locale: Locale;
  notify?: (type: 'success' | 'warning' | 'error', message: string) => void;
};

function L(locale: Locale, en: string, ar: string) {
  return locale === 'ar' ? ar : en;
}

function toneFor(status: V385StageStatus | string) {
  if (status === 'ready' || status === 'good') return 'good';
  if (status === 'blocked' || status === 'critical') return 'bad';
  return 'warn';
}

function StatusPill({ value }: { value: string }) {
  return <span className={`status ${toneFor(value)}`}>{value}</span>;
}

function MiniKpi({ label, value, hint, icon }: { label: string; value: string; hint: string; icon: ReactNode }) {
  return <div className="kpi"><div className="kpi-icon">{icon}</div><div><span>{label}</span><strong>{value}</strong><small>{hint}</small></div></div>;
}

function Card({ title, children, icon, action }: { title: string; children: ReactNode; icon?: React.ReactNode; action?: React.ReactNode }) {
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

export default function EnterpriseV385PurchasingGatePage({ state, locale, notify }: Props) {
  const snapshot = useMemo(() => buildV385PurchasingWorkflowSnapshot(state), [state]);
  const exportCsv = () => {
    downloadText(`v385-purchasing-workflow-gate-${new Date().toISOString().slice(0, 10)}.csv`, v385PurchasingRowsToCsv(snapshot));
    notify?.('success', L(locale, 'Purchasing workflow audit CSV exported.', 'تم تصدير تدقيق دورة المشتريات بصيغة CSV.'));
  };

  return <div className="space-y">
    <div className="page-intro">
      <div>
        <span className="eyebrow">v385</span>
        <h2>{L(locale, 'Purchasing Workflow Gate', 'بوابة دورة المشتريات')}</h2>
        <p>{L(locale, 'Evidence layer for request → PO → GRN → supplier invoice → AP payment readiness before backend posting cutover.', 'طبقة إثبات لجاهزية طلب الشراء ← أمر الشراء ← الاستلام ← فاتورة المورد ← سداد المورد قبل التحويل للترحيل الخلفي.')}</p>
      </div>
      <button onClick={exportCsv}><Download size={16}/>{L(locale, 'Export CSV', 'تصدير CSV')}</button>
    </div>

    <div className="kpi-grid">
      <MiniKpi label={L(locale, 'Workflow score', 'درجة الدورة')} value={`${snapshot.workflowScore}%`} hint={L(locale, 'Purchasing readiness', 'جاهزية المشتريات')} icon={<ShieldCheck/>}/>
      <MiniKpi label={L(locale, 'Production gate', 'بوابة الإنتاج')} value={snapshot.productionGate.toUpperCase()} hint={snapshot.nextAction} icon={<ClipboardCheck/>}/>
      <MiniKpi label={L(locale, 'Open documents', 'مستندات مفتوحة')} value={`${snapshot.counts.openDocuments}`} hint={L(locale, 'Draft/submitted/approved/open', 'مسودة/مرسل/معتمد/مفتوح')} icon={<FileText/>}/>
      <MiniKpi label={L(locale, 'Blocked documents', 'مستندات معطلة')} value={`${snapshot.counts.blockedDocuments}`} hint={L(locale, 'Rejected/cancelled/blocked', 'مرفوض/ملغي/معطل')} icon={<AlertTriangle/>}/>
    </div>

    <Card title={L(locale, 'Lifecycle readiness', 'جاهزية دورة المشتريات')} icon={<ShoppingCart/>}>
      <Table headers={[L(locale, 'Stage', 'المرحلة'), L(locale, 'Status', 'الحالة'), L(locale, 'Records', 'السجلات'), L(locale, 'Ready', 'جاهز'), L(locale, 'Blocked', 'معطل'), L(locale, 'Evidence', 'الدليل'), L(locale, 'Next action', 'الإجراء التالي')]} rows={snapshot.stageRows.map((row) => [row.stage, <StatusPill value={row.status}/>, row.records, row.ready, row.blocked, row.evidence, row.nextAction])}/>
    </Card>

    <Card title={L(locale, 'Document linking sample', 'عينة ربط المستندات')} icon={<Link2/>}>
      <Table headers={[L(locale, 'Source', 'المصدر'), L(locale, 'Reference', 'المرجع'), L(locale, 'Status', 'الحالة'), L(locale, 'Linked to', 'مرتبط بـ'), L(locale, 'Link status', 'حالة الربط'), L(locale, 'Evidence', 'الدليل')]} rows={snapshot.documentLinks.map((row) => [row.source, row.ref, row.status, row.linkedTo, <StatusPill value={row.linkStatus}/>, row.evidence])}/>
    </Card>

    <Card title={L(locale, 'Findings and required actions', 'الملاحظات والإجراءات المطلوبة')} icon={<PackageCheck/>}>
      <Table headers={[L(locale, 'Severity', 'الخطورة'), L(locale, 'Area', 'المجال'), L(locale, 'Finding', 'الملاحظة'), L(locale, 'Required action', 'الإجراء المطلوب')]} rows={snapshot.findings.map((finding) => [<StatusPill value={finding.severity}/>, finding.area, finding.finding, finding.action])}/>
    </Card>

    <div className="two-col">
      <Card title={L(locale, 'Counts', 'العدادات')} icon={<Truck/>}>
        <Table headers={[L(locale, 'Object', 'العنصر'), L(locale, 'Count', 'العدد')]} rows={[
          [L(locale, 'Suppliers', 'الموردون'), snapshot.counts.suppliers],
          [L(locale, 'Material requests', 'طلبات المواد'), snapshot.counts.materialRequests],
          [L(locale, 'Purchase orders', 'أوامر الشراء'), snapshot.counts.purchaseOrders],
          [L(locale, 'Goods receipts', 'سندات الاستلام'), snapshot.counts.goodsReceipts],
          [L(locale, 'Supplier invoices', 'فواتير الموردين'), snapshot.counts.purchaseInvoices],
          [L(locale, 'Supplier payments', 'مدفوعات الموردين'), snapshot.counts.supplierPayments],
        ]}/>
      </Card>
      <Card title={L(locale, 'Cutover rule', 'قاعدة التحويل')} icon={<CheckCircle2/>}>
        <div className="notice">
          {L(locale, 'Production purchasing must not rely on local state only. A real pilot requires supplier master proof, PO/GRN/invoice/payment linking, backend posting authority, AP settlement evidence, VAT input reconciliation, and reversal-only corrections.', 'يجب ألا تعتمد المشتريات في الإنتاج على الحالة المحلية فقط. يتطلب التشغيل التجريبي إثبات بيانات الموردين، وربط أمر الشراء والاستلام والفاتورة والسداد، وترحيل خلفي معتمد، وإثبات تسوية الموردين، ومطابقة ضريبة المدخلات، والتصحيح بعكس القيد فقط.')}
        </div>
      </Card>
    </div>
  </div>;
}
