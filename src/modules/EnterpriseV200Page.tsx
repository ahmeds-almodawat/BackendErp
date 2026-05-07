import { useMemo, useState } from 'react';
import { AlertTriangle, Archive, Banknote, CheckCircle2, ClipboardCheck, Database, Download, FileText, Gauge, GitBranch, Layers, LockKeyhole, Paperclip, RefreshCw, Rocket, ShieldCheck, Sparkles, TrendingUp, UploadCloud } from 'lucide-react';
import { buildV200ControlRows, buildV200Program, calculateV200Scores, type V200ControlRow } from '../engines/enterpriseV200Engine';
import { buildSetupPayload, getBackendBridgeStatus } from '../services/backendRepositoryBridge';
import { evaluatePostingIntent } from '../services/productionPostingBridge';
import { attachmentPolicies } from '../services/enterpriseAttachmentVault';

type Props = { state: any; totals: any; update?: (fn: (state: any) => any, message?: string) => void; locale: 'en' | 'ar'; notify?: (type: 'success' | 'warning' | 'error', message: string) => void };
type Tab = 'command' | 'backend' | 'setup' | 'posting' | 'approvals' | 'attachments' | 'inventory' | 'settlement' | 'reports' | 'qa';

const L = (locale: 'en' | 'ar', en: string, ar: string) => locale === 'ar' ? ar : en;
const list = (value: unknown) => Array.isArray(value) ? value : [];
const amount = (value: unknown) => Number(value || 0);

function downloadCsv(filename: string, rows: Record<string, unknown>[]) {
  const headers = Array.from(new Set(rows.flatMap((row) => Object.keys(row))));
  const csv = [headers.join(','), ...rows.map((row) => headers.map((h) => JSON.stringify(row[h] ?? '')).join(','))].join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = filename;
  link.click();
  URL.revokeObjectURL(link.href);
}

function downloadJson(filename: string, data: unknown) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json;charset=utf-8' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = filename;
  link.click();
  URL.revokeObjectURL(link.href);
}

function StatusBadge({ status }: { status: string }) {
  const cls = status === 'Ready' ? 'good' : status === 'Blocked' || status === 'Missing' ? 'bad' : 'warn';
  return <span className={`badge ${cls}`}>{status}</span>;
}

function Panel({ title, icon, children, action }: { title: string; icon?: React.ReactNode; children: React.ReactNode; action?: React.ReactNode }) {
  return <section className="card"><div className="card-header"><div className="card-title">{icon}{title}</div>{action}</div>{children}</section>;
}

function MiniKpi({ label, value, hint, icon }: { label: string; value: string | number; hint: string; icon: React.ReactNode }) {
  return <div className="kpi"><div className="kpi-icon">{icon}</div><div><span>{label}</span><strong>{value}</strong><small>{hint}</small></div></div>;
}

function SimpleTable({ headers, rows }: { headers: string[]; rows: React.ReactNode[][] }) {
  return <div className="table-wrap"><table><thead><tr>{headers.map((h) => <th key={h}>{h}</th>)}</tr></thead><tbody>{rows.length ? rows.map((r, i) => <tr key={i}>{r.map((c, idx) => <td key={idx}>{c}</td>)}</tr>) : <tr><td colSpan={headers.length}>—</td></tr>}</tbody></table></div>;
}

export default function EnterpriseV200Page({ state, totals, update, locale, notify }: Props) {
  const [tab, setTab] = useState<Tab>('command');
  const backend = getBackendBridgeStatus();
  const scores = useMemo(() => calculateV200Scores(state, totals), [state, totals]);
  const rows = useMemo(() => buildV200ControlRows(state, totals), [state, totals]);
  const program = useMemo(() => buildV200Program(), []);
  const avgScore = Math.round(scores.reduce((sum, s) => sum + s.score, 0) / Math.max(scores.length, 1));
  const blockers = rows.filter((r) => r.status === 'Blocked' || (r.status === 'Missing' && r.priority === 'Critical'));
  const warnings = rows.filter((r) => r.status === 'Partial' || r.status === 'Missing');
  const setupPayload = useMemo(() => buildSetupPayload(state), [state]);
  const postingSample = evaluatePostingIntent({ documentType: 'foodics_batch', reference: 'FOODICS-PILOT', mode: 'full-erp' }, state);
  const exportReadiness = () => downloadCsv('v200_enterprise_readiness.csv', rows.map((r) => ({ ...r })));
  const exportProgram = () => downloadCsv('v200_program_plan.csv', program.map((r) => ({ ...r })));
  const exportSetup = () => downloadJson('v200_setup_sync_payload.json', setupPayload);
  const logHealth = () => {
    if (!update) return notify?.('warning', L(locale, 'Update function is not available in this build.', 'دالة التحديث غير متاحة في هذا الإصدار.'));
    update((s) => ({ ...s, auditEvents: [...list(s.auditEvents), { id: `AUD-${Date.now()}`, at: new Date().toISOString(), action: 'v200_health_review', entity: 'enterprise_v200', ref: 'V200', note: `Readiness ${avgScore}; blockers ${blockers.length}; warnings ${warnings.length}` }] }), L(locale, 'v200 health review logged', 'تم تسجيل مراجعة v200'));
  };

  const tabs: Record<Tab, { en: string; ar: string; icon: React.ReactNode }> = {
    command: { en: 'Command', ar: 'القيادة', icon: <Gauge size={16}/> },
    backend: { en: 'Backend Bridge', ar: 'جسر الخلفية', icon: <Database size={16}/> },
    setup: { en: 'Setup Persistence', ar: 'استمرارية الإعدادات', icon: <UploadCloud size={16}/> },
    posting: { en: 'Posting Orchestrator', ar: 'منسق الترحيل', icon: <GitBranch size={16}/> },
    approvals: { en: 'Approvals', ar: 'الاعتمادات', icon: <ShieldCheck size={16}/> },
    attachments: { en: 'Attachment Vault', ar: 'خزنة المرفقات', icon: <Paperclip size={16}/> },
    inventory: { en: 'Inventory Pro', ar: 'المخزون الاحترافي', icon: <Archive size={16}/> },
    settlement: { en: 'Settlement & Finance', ar: 'التسويات والمالية', icon: <Banknote size={16}/> },
    reports: { en: 'Report Factory', ar: 'مصنع التقارير', icon: <FileText size={16}/> },
    qa: { en: 'QA / Go-live', ar: 'الاختبار والانطلاق', icon: <ClipboardCheck size={16}/> },
  };

  const criticalActions: V200ControlRow[] = [
    { area: 'Foodics full ERP posting', status: postingSample.allowed ? 'Partial' : 'Blocked', priority: 'Critical', owner: 'Finance / Operations', nextAction: postingSample.allowed ? 'Route through backend posting-orchestrator before production.' : postingSample.blockers.join(' | ') },
    { area: 'Stock count variance posting', status: list(state.inventoryApprovals).length ? 'Partial' : 'Missing', priority: 'High', owner: 'Inventory Controller', nextAction: 'Require approval, period check, inventory movement and GL journal.' },
    { area: 'Supplier payment', status: list(state.purchasePayments).length ? 'Partial' : 'Missing', priority: 'High', owner: 'Finance Manager', nextAction: 'Allocate payment by invoice and require payment voucher attachment.' },
    { area: 'Manual journal posting', status: list(state.journals).length ? 'Partial' : 'Missing', priority: 'Critical', owner: 'Finance Manager', nextAction: 'Enable maker-checker approval and supporting document control.' },
    { area: 'Period close / reopen', status: list(state.fiscalPeriods).length ? 'Partial' : 'Missing', priority: 'Critical', owner: 'CFO', nextAction: 'Prevent backdated posting after close unless reopened by authority.' },
  ];

  return <div className="page-stack">
    <div className="hero-card"><div><span className="eyebrow">v182 → v200</span><h2>{L(locale, 'Enterprise Production Bridge', 'جسر الإنتاج المؤسسي')}</h2><p>{L(locale, 'A single mega patch for backend bridge, setup persistence, posting orchestration, approvals, attachments, inventory close, settlement, reports and go-live QA.', 'حزمة موحدة لجسر الخلفية واستمرارية الإعدادات ومنسق الترحيل والاعتمادات والمرفقات وإغلاق المخزون والتسويات والتقارير واختبارات الانطلاق.')}</p></div><div className="hero-score"><strong>{avgScore}%</strong><span>{L(locale, 'v200 readiness', 'جاهزية v200')}</span></div></div>
    <div className="tabbar">{(Object.keys(tabs) as Tab[]).map((key) => <button key={key} onClick={() => setTab(key)} className={tab === key ? 'active' : ''}>{tabs[key].icon}{L(locale, tabs[key].en, tabs[key].ar)}</button>)}</div>

    {tab === 'command' && <div className="page-stack">
      <div className="kpi-grid">
        <MiniKpi label={L(locale, 'Backend mode', 'وضع الخلفية')} value={backend.mode} hint={backend.reason} icon={<Database size={20}/>}/>
        <MiniKpi label={L(locale, 'Blockers', 'العوائق')} value={blockers.length} hint={L(locale, 'Critical items before pilot', 'بنود حرجة قبل التجربة')} icon={<AlertTriangle size={20}/>}/>
        <MiniKpi label={L(locale, 'Warnings', 'التنبيهات')} value={warnings.length} hint={L(locale, 'Partial or missing controls', 'ضوابط جزئية أو ناقصة')} icon={<Sparkles size={20}/>}/>
        <MiniKpi label={L(locale, 'Inventory value', 'قيمة المخزون')} value={`${Number(totals?.inventoryValue || 0).toLocaleString()} SAR`} hint={L(locale, 'Local trial valuation', 'تقييم تجريبي محلي')} icon={<Archive size={20}/>}/>
      </div>
      <Panel title={L(locale, 'Current scores', 'الدرجات الحالية')} icon={<TrendingUp/>} action={<button onClick={exportReadiness}><Download size={14}/> {L(locale, 'Export readiness', 'تصدير الجاهزية')}</button>}>
        <SimpleTable headers={[L(locale, 'Area', 'المجال'), L(locale, 'Score', 'الدرجة'), L(locale, 'Target', 'المستهدف'), L(locale, 'Note', 'ملاحظة')]} rows={scores.map((s) => [s.label, <strong>{s.score}%</strong>, `${s.target}%`, s.note])}/>
      </Panel>
      <Panel title={L(locale, 'Enterprise control rows', 'بنود الرقابة المؤسسية')} icon={<ShieldCheck/>} action={<button onClick={logHealth}><RefreshCw size={14}/> {L(locale, 'Log health review', 'تسجيل المراجعة')}</button>}>
        <SimpleTable headers={[L(locale, 'Area', 'المجال'), L(locale, 'Status', 'الحالة'), L(locale, 'Priority', 'الأولوية'), L(locale, 'Owner', 'المالك'), L(locale, 'Next action', 'الإجراء التالي')]} rows={rows.map((r) => [r.area, <StatusBadge status={r.status}/>, r.priority, r.owner, r.nextAction])}/>
      </Panel>
    </div>}

    {tab === 'backend' && <div className="page-stack">
      <Panel title={L(locale, 'Backend bridge status', 'حالة جسر الخلفية')} icon={<Database/>} action={<button onClick={exportSetup}><Download size={14}/> {L(locale, 'Export setup JSON', 'تصدير JSON للإعدادات')}</button>}>
        <div className="info-grid"><div><span className="eyebrow">MODE</span><h3>{backend.mode}</h3><p>{backend.reason}</p></div><div><span className="eyebrow">ENV</span><h3>{backend.configured ? 'Configured' : 'Not configured'}</h3><p>{backend.supabaseUrl || 'VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY required for pilot sync.'}</p></div></div>
      </Panel>
      <Panel title={L(locale, 'Backend API layers', 'طبقات API الخلفية')} icon={<Layers/>}>
        <SimpleTable headers={['API', 'Purpose', 'Status']} rows={[
          ['setup-sync', 'Persist branches/stores/items/suppliers/accounts/cost centers', <StatusBadge status="Partial"/>],
          ['master-data-validate', 'Detect duplicate, orphan, inactive and compliance issues', <StatusBadge status="Partial"/>],
          ['foodics-staging', 'Stage headers, lines, payments, mappings and issues', <StatusBadge status="Partial"/>],
          ['posting-orchestrator', 'Post inventory + GL + audit from approved documents', <StatusBadge status="Partial"/>],
          ['attachment-vault', 'Signed upload URLs and document attachment policy', <StatusBadge status="Partial"/>],
          ['period-close', 'Close / reopen period with authority controls', <StatusBadge status="Partial"/>],
        ]}/>
      </Panel>
    </div>}

    {tab === 'setup' && <Panel title={L(locale, 'Setup persistence readiness', 'جاهزية استمرارية الإعدادات')} icon={<UploadCloud/>}>
      <SimpleTable headers={[L(locale, 'Dataset', 'مجموعة البيانات'), L(locale, 'Rows', 'الصفوف'), L(locale, 'Backend policy', 'سياسة الخلفية')]} rows={[
        ['Branches', list(state.branches).length, 'Upsert by code; block duplicate code.'],
        ['Stores', list(state.stores).length, 'Upsert by code; validate linked branch.'],
        ['Suppliers', list(state.suppliers).length, 'Upsert by code; warn missing VAT/bank/representative.'],
        ['Items / SKUs', list(state.items).length, 'Upsert by SKU; SKU is global primary business key.'],
        ['Cost Centers', list(state.costCenters).length, 'Upsert by code; validate branch/company scope.'],
        ['Chart of Accounts', list(state.accounts).length, 'Upsert by account code; block duplicate code.'],
        ['Roles / Permissions', `${list(state.roles).length} / ${list(state.permissions).length}`, 'Seed baseline permissions, then allow custom roles.'],
      ]}/>
    </Panel>}

    {tab === 'posting' && <div className="page-stack"><Panel title={L(locale, 'Central posting orchestrator', 'منسق الترحيل المركزي')} icon={<GitBranch/>}>
      <div className="callout"><strong>validate → permission → period → lifecycle → inventory → GL → audit → status</strong><p>{L(locale, 'Every production posting must use this flow. Frontend-only posting is acceptable only in local trial mode.', 'كل ترحيل إنتاجي يجب أن يستخدم هذا المسار. الترحيل من الواجهة فقط مقبول للتجربة المحلية فقط.')}</p></div>
      <SimpleTable headers={[L(locale, 'Action', 'الإجراء'), L(locale, 'Status', 'الحالة'), L(locale, 'Priority', 'الأولوية'), L(locale, 'Owner', 'المالك'), L(locale, 'Next action', 'الإجراء التالي')]} rows={criticalActions.map((r) => [r.area, <StatusBadge status={r.status}/>, r.priority, r.owner, r.nextAction])}/>
    </Panel></div>}

    {tab === 'approvals' && <Panel title={L(locale, 'Approval workflow foundation', 'أساس مسار الاعتمادات')} icon={<ShieldCheck/>}>
      <SimpleTable headers={['Document', 'Maker', 'Checker', 'Approval basis', 'Production rule']} rows={[
        ['Foodics batch', 'Operations uploads/matches', 'Finance Manager approves posting', 'Batch mode + issue severity', 'No posting without approved batch.'],
        ['Stock count variance', 'Storekeeper uploads count', 'Inventory Controller / Branch Manager', 'Variance value and item category', 'Variance posts only after approval.'],
        ['Supplier payment', 'Accountant prepares', 'Finance Manager / Owner', 'Amount threshold', 'Payment allocated by invoice and voucher.'],
        ['Manual journal', 'Accountant drafts', 'Finance Manager reviews', 'Journal source and amount', 'Posted journals cannot be edited; reversal only.'],
        ['Recipe version', 'Chef / Cost Controller drafts', 'Operations / Finance approves', 'Cost impact / branch scope', 'Effective date required before use.'],
      ]}/>
    </Panel>}

    {tab === 'attachments' && <Panel title={L(locale, 'Attachment vault policy', 'سياسة خزنة المرفقات')} icon={<Paperclip/>}>
      <SimpleTable headers={['Document', 'Required', 'Storage bucket', 'Examples']} rows={attachmentPolicies.map((p) => [p.documentType, p.required ? <StatusBadge status="Ready"/> : <StatusBadge status="Partial"/>, p.bucket, p.examples.join(', ')])}/>
    </Panel>}

    {tab === 'inventory' && <div className="page-stack"><Panel title={L(locale, 'Inventory professional hardening', 'تقوية المخزون الاحترافية')} icon={<Archive/>}>
      <SimpleTable headers={['Control', 'Status', 'Next implementation']} rows={[
        ['Transfer lifecycle', <StatusBadge status="Partial"/>, 'Request → approve → dispatch → in-transit → receive → close.'],
        ['Weighted average costing', <StatusBadge status="Partial"/>, 'Centralize cost engine for purchases, transfers, production, sales and variances.'],
        ['FEFO / expiry issue', <StatusBadge status="Missing"/>, 'Suggest nearest expiry lot first and warn expired/quarantine lots.'],
        ['Inventory period close', <StatusBadge status="Partial"/>, 'Block backdated stock movements after inventory month close.'],
        ['Reservations', <StatusBadge status="Missing"/>, 'Reserve stock for approved transfer/production/sales commitments.'],
      ]}/>
    </Panel></div>}

    {tab === 'settlement' && <Panel title={L(locale, 'Settlement and finance hardening', 'تقوية التسويات والمالية')} icon={<Banknote/>}>
      <SimpleTable headers={['Area', 'Current direction', 'Next production control']} rows={[
        ['Cash settlement', 'Foodics payments captured', 'Compare expected cash vs cashier close and bank deposit.'],
        ['MADA/card', 'Payment methods mapped to clearing account', 'Settlement statement import and fee/shortage matching.'],
        ['Delivery apps', 'Receivable concept exists', 'Settlement by platform with commission/VAT deduction.'],
        ['AP aging', 'Supplier statements exist', 'Age by due date and create payment run by priority.'],
        ['Bank reconciliation', 'Design exists', 'Auto-match by amount/date/reference with exception queue.'],
        ['Vouchers', 'Payment concept exists', 'Separate payment/receipt voucher registers and print packs.'],
      ]}/>
    </Panel>}

    {tab === 'reports' && <Panel title={L(locale, 'Board report factory', 'مصنع تقارير مجلس الإدارة')} icon={<FileText/>} action={<button onClick={() => downloadCsv('v200_report_factory.csv', [
      { report: 'Monthly close certificate', owner: 'CFO', output: 'PDF + Excel' },
      { report: 'Foodics settlement pack', owner: 'Finance Manager', output: 'Excel' },
      { report: 'Inventory variance and risk pack', owner: 'Inventory Controller', output: 'Excel' },
      { report: 'Theoretical vs actual food cost', owner: 'Operations / Finance', output: 'Excel + Dashboard' },
    ])}><Download size={14}/> Export</button>}>
      <SimpleTable headers={['Report', 'Purpose', 'Data dependency', 'Output']} rows={[
        ['Monthly close certificate', 'Owner/CFO sign-off', 'Close checklist, GL, inventory, Foodics', 'PDF/Excel pack'],
        ['Foodics settlement', 'Cash/card/delivery reconciliation', 'Orders, payments, refunds, settlements', 'Excel + dashboard'],
        ['Theoretical vs actual food cost', 'Detect waste/leakage', 'Recipes, stock count, sales, movements', 'Dashboard + CSV'],
        ['Branch P&L by month', 'Branch performance', 'Sales, COGS, payroll, expenses', 'Excel/PDF'],
        ['Procurement variance', 'PO/GRN/invoice control', 'PO, GRN, invoices, returns', 'CSV/Excel'],
        ['AP/AR aging and cash forecast', 'Liquidity planning', 'AP, AR, payments, receipts', 'CFO pack'],
      ]}/>
    </Panel>}

    {tab === 'qa' && <div className="page-stack">
      <Panel title={L(locale, 'v182 → v200 program plan', 'خطة البرنامج v182 إلى v200')} icon={<Rocket/>} action={<button onClick={exportProgram}><Download size={14}/> {L(locale, 'Export program', 'تصدير البرنامج')}</button>}>
        <SimpleTable headers={['Step', 'Status', 'Priority', 'Owner', 'Next action']} rows={program.map((r) => [r.area, <StatusBadge status={r.status}/>, r.priority, r.owner, r.nextAction])}/>
      </Panel>
      <Panel title={L(locale, 'Current score notes', 'ملاحظات الدرجة الحالية')} icon={<CheckCircle2/>}>
        <div className="callout"><strong>{L(locale, 'Current score after v200', 'الدرجة بعد v200')}</strong><p>{L(locale, 'Local MVP 9.5/10, ERP foundation 9.0/10, enterprise design 9.3/10, production readiness 7.0/10, backend/security readiness 7.6/10.', 'النموذج المحلي 9.5/10، أساس ERP 9.0/10، التصميم المؤسسي 9.3/10، جاهزية الإنتاج 7.0/10، جاهزية الخلفية والأمان 7.6/10.')}</p><p>{L(locale, 'Remaining critical gap: real end-to-end Supabase wiring, Auth/RLS tests, server-side posting and production deployment.', 'الفجوة الحرجة المتبقية: الربط الكامل مع Supabase واختبارات Auth/RLS والترحيل من الخادم والنشر الإنتاجي.')}</p></div>
      </Panel>
    </div>}
  </div>;
}
