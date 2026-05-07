export type V391V394GateId = 'reportPack' | 'alerts' | 'support' | 'performance';
export type V391V394GateStatus = 'ready' | 'watch' | 'blocked';
export type V391V394Severity = 'critical' | 'warning' | 'info' | 'good';

export interface V391V394Finding {
  severity: V391V394Severity;
  area: string;
  finding: string;
  action: string;
}

export interface V391V394CheckRow {
  check: string;
  status: V391V394GateStatus;
  evidence: string;
  nextAction: string;
}

export interface V391V394GateSnapshot {
  gateId: V391V394GateId;
  version: string;
  title: string;
  titleAr: string;
  generatedAt: string;
  score: number;
  status: V391V394GateStatus;
  counts: Record<string, number>;
  checks: V391V394CheckRow[];
  findings: V391V394Finding[];
  cutoverRule: string;
  cutoverRuleAr: string;
  nextAction: string;
}

export interface V391V394OperationalConfidenceSnapshot {
  version: string;
  generatedAt: string;
  overallScore: number;
  status: V391V394GateStatus;
  gates: V391V394GateSnapshot[];
  nextAction: string;
}

function arr<T = any>(value: unknown): T[] {
  return Array.isArray(value) ? value as T[] : [];
}

function n(value: unknown) {
  const number = Number(value ?? 0);
  return Number.isFinite(number) ? number : 0;
}

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function statusFromFindings(findings: V391V394Finding[]): V391V394GateStatus {
  if (findings.some((finding) => finding.severity === 'critical')) return 'blocked';
  if (findings.some((finding) => finding.severity === 'warning')) return 'watch';
  return 'ready';
}

function scoreFromFindings(findings: V391V394Finding[], base = 100) {
  const penalty = findings.reduce((sum, finding) => {
    if (finding.severity === 'critical') return sum + 20;
    if (finding.severity === 'warning') return sum + 9;
    if (finding.severity === 'info') return sum + 2;
    return sum;
  }, 0);
  return Math.max(0, Math.min(100, Math.round(base - penalty)));
}

function finding(list: V391V394Finding[], severity: V391V394Severity, area: string, message: string, action: string) {
  list.push({ severity, area, finding: message, action });
}

function check(check: string, status: V391V394GateStatus, evidence: string, nextAction: string): V391V394CheckRow {
  return { check, status, evidence, nextAction };
}

function countKeys(value: any) {
  if (!value || typeof value !== 'object') return 0;
  return Object.keys(value).length;
}

function hasRows(state: any, key: string) {
  return arr(state?.[key]).length > 0;
}

function buildReportPackGate(state: any, totals: any = {}): V391V394GateSnapshot {
  const findings: V391V394Finding[] = [];
  const journals = arr(state?.journals);
  const purchases = arr(state?.purchaseInvoices);
  const sales = arr(state?.sales);
  const stockMovements = arr(state?.stockMovements);
  const snapshots = arr(state?.reportSnapshots);
  const reportRows = arr(state?.reports);
  const exports = arr(state?.reportExports);
  const hasFinanceEvidence = journals.length || n(totals?.revenue) || n(totals?.expenses) || purchases.length;
  const hasInventoryEvidence = stockMovements.length || arr(state?.items).length;
  const hasSalesEvidence = sales.length || arr(state?.menuItems).length;
  const missingCore = [
    !hasFinanceEvidence ? 'finance' : '',
    !hasInventoryEvidence ? 'inventory' : '',
    !hasSalesEvidence ? 'sales/POS' : '',
  ].filter(Boolean);

  if (missingCore.length) finding(findings, 'critical', 'Source coverage', `Missing report evidence for ${missingCore.join(', ')}.`, 'Run demo/import/posting scenarios before calling report packs trusted.');
  if (!snapshots.length) finding(findings, 'warning', 'Snapshot lane', 'No report snapshot records exist in local state.', 'Use v379 report snapshot worker evidence before heavy dashboards are trusted.');
  if (!exports.length && !reportRows.length) finding(findings, 'warning', 'Exports', 'No local report/export evidence detected.', 'Produce one management pack export and verify it opens.');
  if (!arr(state?.audits).length) finding(findings, 'warning', 'Audit trail', 'No audit logs detected for report generation/export.', 'Audit every management pack generation and export.');
  if (!findings.length) finding(findings, 'good', 'Report pack gate', 'Report pack evidence looks ready for pilot review.', 'Proceed to formula truth and drill-down proof.');

  return {
    gateId: 'reportPack',
    version: 'v391 Report Pack Gate',
    title: 'Report Pack Gate',
    titleAr: 'بوابة حزم التقارير',
    generatedAt: new Date().toISOString(),
    score: scoreFromFindings(findings),
    status: statusFromFindings(findings),
    counts: { journals: journals.length, purchases: purchases.length, sales: sales.length, stockMovements: stockMovements.length, snapshots: snapshots.length, reportRows: reportRows.length, exports: exports.length, auditLogs: arr(state?.audits).length },
    checks: [
      check('Finance report source coverage', hasFinanceEvidence ? 'ready' : 'blocked', `${journals.length} journal(s), ${purchases.length} purchase invoice(s).`, 'Connect P&L, balance sheet, GL, VAT, AP, and cash reports to posted evidence.'),
      check('Inventory report source coverage', hasInventoryEvidence ? 'ready' : 'blocked', `${stockMovements.length} stock movement(s), ${arr(state?.items).length} item(s).`, 'Connect valuation and stock status to movement ledger and rebuild evidence.'),
      check('Sales report source coverage', hasSalesEvidence ? 'ready' : 'blocked', `${sales.length} sale row(s), ${arr(state?.menuItems).length} menu item(s).`, 'Connect sales mix, settlement, VAT, and COGS to POS replay evidence.'),
      check('Export/audit evidence', exports.length || arr(state?.audits).length ? 'watch' : 'blocked', `${exports.length} export(s), ${arr(state?.audits).length} audit row(s).`, 'Create management pack artifact and audit trail before pilot.'),
    ],
    cutoverRule: 'Report packs are production-ready only when every KPI can drill down to posted, locked, backend source rows and a generated snapshot artifact.',
    cutoverRuleAr: 'تصبح حزم التقارير جاهزة للإنتاج فقط عندما يمكن تتبع كل مؤشر إلى قيود ومصادر خلفية مقفلة مع أثر لقطة تقارير مولدة.',
    nextAction: statusFromFindings(findings) === 'blocked' ? 'Close missing report source coverage first.' : statusFromFindings(findings) === 'watch' ? 'Generate one audited report pack and verify export.' : 'Proceed to drill-down and formula validation.',
  };
}

function buildAlertsGate(state: any): V391V394GateSnapshot {
  const findings: V391V394Finding[] = [];
  const items = arr(state?.items);
  const stockMovements = arr(state?.stockMovements);
  const approvals = arr(state?.inventoryApprovals);
  const lots = arr(state?.inventoryLots);
  const users = arr(state?.userAccounts);
  const audits = arr(state?.audits);
  const lowStockItems = items.filter((item: any) => n(item?.reorderPoint) > 0 && n(item?.minStock) >= n(item?.reorderPoint)).length;
  const expiredLots = lots.filter((lot: any) => String(lot?.expiryDate || '9999-12-31').slice(0, 10) < todayIso() && n(lot?.qty) > 0).length;
  const pendingApprovals = approvals.filter((approval: any) => ['pending', 'submitted', 'approved'].includes(String(approval?.status || '').toLowerCase())).length;
  const inactiveUsers = users.filter((user: any) => user?.active === false || String(user?.status || '').toLowerCase() === 'disabled').length;

  if (!audits.length) finding(findings, 'warning', 'Audit signals', 'No audit log evidence exists for alert generation.', 'Write alert evaluation events into audit/worker evidence.');
  if (!items.length && !stockMovements.length) finding(findings, 'critical', 'Alert inputs', 'No inventory or movement source exists for operational alerts.', 'Load master data and transaction evidence before enabling operational alerts.');
  if (expiredLots) finding(findings, 'critical', 'Expiry alerts', `${expiredLots} expired lot(s) with quantity on hand detected.`, 'Create blocking expiry alert and quarantine workflow.');
  if (pendingApprovals) finding(findings, 'warning', 'Approval alerts', `${pendingApprovals} approval item(s) need SLA tracking.`, 'Add SLA timers and escalation owners for pending approvals.');
  if (!arr(state?.notifications).length) finding(findings, 'warning', 'Notification channel', 'No notification/message rows detected.', 'Define how operators receive exception alerts inside the app.');
  if (!users.length || inactiveUsers === users.length) finding(findings, 'warning', 'Alert recipients', 'No active recipient user evidence detected.', 'Assign alert owners by role and branch.');
  if (!findings.length) finding(findings, 'good', 'Alerts gate', 'Alert input evidence is ready for exception-center pilot.', 'Proceed to threshold and escalation testing.');

  return {
    gateId: 'alerts',
    version: 'v392 Alerts & Exceptions Gate',
    title: 'Alerts & Exceptions Gate',
    titleAr: 'بوابة التنبيهات والاستثناءات',
    generatedAt: new Date().toISOString(),
    score: scoreFromFindings(findings),
    status: statusFromFindings(findings),
    counts: { items: items.length, stockMovements: stockMovements.length, lots: lots.length, expiredLots, pendingApprovals, notifications: arr(state?.notifications).length, users: users.length, inactiveUsers, audits: audits.length, lowStockItems },
    checks: [
      check('Exception inputs', items.length || stockMovements.length ? 'ready' : 'blocked', `${items.length} item(s), ${stockMovements.length} movement(s).`, 'Load transaction inputs for alert evaluation.'),
      check('Expiry/blocking alerts', expiredLots ? 'blocked' : lots.length ? 'ready' : 'watch', `${expiredLots} expired lot(s), ${lots.length} lot(s).`, 'Define blocking behavior for expired lots and compliance exceptions.'),
      check('Approval SLA alerts', pendingApprovals ? 'watch' : 'ready', `${pendingApprovals} active approval item(s).`, 'Add escalation owner, due time, and closure audit. '),
      check('Recipients/channels', users.length ? 'watch' : 'blocked', `${users.length} user account(s), ${arr(state?.notifications).length} notification row(s).`, 'Map exception categories to roles, branch owners, and backup recipients.'),
    ],
    cutoverRule: 'Alerts are production-ready only when every exception has a source, owner, SLA, notification path, and closure audit event.',
    cutoverRuleAr: 'تصبح التنبيهات جاهزة للإنتاج فقط عندما يكون لكل استثناء مصدر ومالك ومدة استجابة ومسار إشعار وأثر إغلاق.',
    nextAction: statusFromFindings(findings) === 'blocked' ? 'Close critical exception-input and expiry blockers first.' : statusFromFindings(findings) === 'watch' ? 'Define alert owners, SLA timers, and notification evidence.' : 'Proceed to escalation simulation.',
  };
}

function buildSupportGate(state: any): V391V394GateSnapshot {
  const findings: V391V394Finding[] = [];
  const audits = arr(state?.audits);
  const errors = arr(state?.appErrorLogs).concat(arr(state?.errorLogs));
  const backups = arr(state?.backupRuns).concat(arr(state?.platformBackups));
  const users = arr(state?.userAccounts);
  const settingsObjects = countKeys(state?.settings) + countKeys(state?.appSettings);
  const docsEvidence = arr(state?.documents).length + arr(state?.attachments).length;

  if (!audits.length) finding(findings, 'critical', 'Audit trail', 'No audit log evidence exists for support diagnostics.', 'Ensure critical actions write immutable support/audit events.');
  if (!backups.length) finding(findings, 'warning', 'Recovery evidence', 'No local backup run evidence detected.', 'Create a backup ZIP and record restore drill evidence.');
  if (!users.length) finding(findings, 'warning', 'User context', 'No user accounts exist for support impersonation/scope diagnostics.', 'Create test users and roles before UAT.');
  if (!settingsObjects) finding(findings, 'warning', 'Settings snapshot', 'No settings object evidence detected.', 'Capture backend mode, branding, and feature flag settings in diagnostics.');
  if (!errors.length) finding(findings, 'info', 'Error logs', 'No local error log rows detected.', 'Good if true; still keep client diagnostics export available.');
  if (!docsEvidence) finding(findings, 'info', 'Attachment evidence', 'No attachment/document evidence detected.', 'Add signed-document diagnostics before production document vault.');
  if (!findings.some((finding) => finding.severity === 'critical' || finding.severity === 'warning')) finding(findings, 'good', 'Support gate', 'Support diagnostics evidence is ready for pilot support desk.', 'Proceed to support runbook and incident drill.');

  return {
    gateId: 'support',
    version: 'v393 Support Diagnostics Gate',
    title: 'Support Diagnostics Gate',
    titleAr: 'بوابة تشخيص الدعم',
    generatedAt: new Date().toISOString(),
    score: scoreFromFindings(findings),
    status: statusFromFindings(findings),
    counts: { audits: audits.length, errorLogs: errors.length, backups: backups.length, users: users.length, settingsObjects, documents: docsEvidence },
    checks: [
      check('Audit/diagnostic export', audits.length ? 'ready' : 'blocked', `${audits.length} audit row(s).`, 'Keep a one-click diagnostics export for support desk.'),
      check('Backup/restore proof', backups.length ? 'ready' : 'watch', `${backups.length} backup/restore evidence row(s).`, 'Run backup and restore drill before UAT.'),
      check('User and scope context', users.length ? 'ready' : 'watch', `${users.length} user account(s).`, 'Include active user, role, branch, and route context in diagnostics.'),
      check('Error capture', errors.length ? 'watch' : 'ready', `${errors.length} error log row(s).`, 'Capture module crash diagnostics without white-screening the app.'),
    ],
    cutoverRule: 'Support mode is production-ready only when operators can export diagnostics, prove backups/restores, and trace actions without developer database access.',
    cutoverRuleAr: 'يصبح وضع الدعم جاهزًا للإنتاج فقط عندما يستطيع المشغل تصدير التشخيصات وإثبات النسخ والاستعادة وتتبع الإجراءات دون دخول المطور لقاعدة البيانات.',
    nextAction: statusFromFindings(findings) === 'blocked' ? 'Create audit evidence before pilot.' : statusFromFindings(findings) === 'watch' ? 'Run backup/restore and diagnostics drill.' : 'Prepare support SOP and escalation matrix.',
  };
}

function buildPerformanceGate(state: any): V391V394GateSnapshot {
  const findings: V391V394Finding[] = [];
  const counts = {
    items: arr(state?.items).length,
    stockMovements: arr(state?.stockMovements).length,
    sales: arr(state?.sales).length,
    journals: arr(state?.journals).length,
    audits: arr(state?.audits).length,
    recipes: arr(state?.recipeLines).length + arr(state?.productionRecipes).length,
    imports: arr(state?.importBatches).length + arr(state?.importRows).length + arr(state?.foodicsStagingRows).length,
    workers: arr(state?.workloadRuns).length,
  };
  const totalRows = Object.values(counts).reduce((sum, value) => sum + value, 0);
  const heavySources = Object.entries(counts).filter(([, value]) => value > 5000).map(([key]) => key);
  const noWorkers = !counts.workers;

  if (totalRows === 0) finding(findings, 'warning', 'Dataset size', 'No sizable local dataset exists for performance validation.', 'Load sample heavy data or replay imports before performance sign-off.');
  if (heavySources.length && noWorkers) finding(findings, 'critical', 'Heavy work', `Large local sources (${heavySources.join(', ')}) exist without worker-run evidence.`, 'Route heavy calculations through v375 worker runtime before production.');
  if (counts.sales > 1000 && !arr(state?.posReplayAppliedRows).length) finding(findings, 'warning', 'POS replay budget', 'Sales rows exist without POS replay evidence.', 'Use POS replay worker for batch processing and checkpoint evidence.');
  if (counts.stockMovements > 1000 && !arr(state?.inventoryRebuildBalances).length) finding(findings, 'warning', 'Inventory rebuild budget', 'Stock movements exist without rebuild evidence.', 'Use inventory rebuild worker for balances and valuation snapshots.');
  if (!arr(state?.performanceBudgets).length) finding(findings, 'warning', 'Performance budget', 'No explicit performance budget rows detected.', 'Define route load, export, import, and worker runtime budgets.');
  if (!findings.length) finding(findings, 'good', 'Performance gate', 'Performance gate has no obvious local blockers.', 'Proceed to browser and worker load tests.');

  return {
    gateId: 'performance',
    version: 'v394 Performance Budget Gate',
    title: 'Performance Budget Gate',
    titleAr: 'بوابة ميزانية الأداء',
    generatedAt: new Date().toISOString(),
    score: scoreFromFindings(findings),
    status: statusFromFindings(findings),
    counts: { ...counts, totalRows, heavySources: heavySources.length },
    checks: [
      check('Dataset budget evidence', totalRows ? 'watch' : 'blocked', `${totalRows} local row(s) across key modules.`, 'Run heavy sample datasets for realistic mid-range load.'),
      check('Worker routing', noWorkers ? 'watch' : 'ready', `${counts.workers} workload run(s).`, 'Route imports, reports, inventory rebuild, POS replay, and backups through workers.'),
      check('POS/inventory batch proof', counts.sales || counts.stockMovements ? 'watch' : 'blocked', `${counts.sales} sale row(s), ${counts.stockMovements} stock movement(s).`, 'Benchmark POS replay and inventory rebuild batches.'),
      check('Budget definitions', arr(state?.performanceBudgets).length ? 'ready' : 'watch', `${arr(state?.performanceBudgets).length} budget row(s).`, 'Define max load time, max export time, and max rows per batch.'),
    ],
    cutoverRule: 'Performance is production-ready only when heavy imports, POS replay, reporting, inventory rebuild, and backup operations run outside the UI with measured budgets.',
    cutoverRuleAr: 'يصبح الأداء جاهزًا للإنتاج فقط عندما تعمل الاستيرادات الثقيلة وإعادة تشغيل المبيعات والتقارير وإعادة بناء المخزون والنسخ خارج الواجهة وفق ميزانيات أداء مقاسة.',
    nextAction: statusFromFindings(findings) === 'blocked' ? 'Create realistic load evidence first.' : statusFromFindings(findings) === 'watch' ? 'Define budgets and run worker load tests.' : 'Proceed to UAT performance rehearsal.',
  };
}

export function buildV391V394Gate(state: any, gateId: V391V394GateId, totals: any = {}): V391V394GateSnapshot {
  if (gateId === 'reportPack') return buildReportPackGate(state, totals);
  if (gateId === 'alerts') return buildAlertsGate(state);
  if (gateId === 'support') return buildSupportGate(state);
  return buildPerformanceGate(state);
}

export function buildV391V394OperationalConfidenceSnapshot(state: any, totals: any = {}): V391V394OperationalConfidenceSnapshot {
  const gates = (['reportPack', 'alerts', 'support', 'performance'] as V391V394GateId[]).map((gateId) => buildV391V394Gate(state, gateId, totals));
  const overallScore = Math.round(gates.reduce((sum, gate) => sum + gate.score, 0) / Math.max(1, gates.length));
  const status = gates.some((gate) => gate.status === 'blocked') ? 'blocked' : gates.some((gate) => gate.status === 'watch') ? 'watch' : 'ready';
  return {
    version: 'v391-v394 Operational Confidence Gates',
    generatedAt: new Date().toISOString(),
    overallScore,
    status,
    gates,
    nextAction: status === 'blocked' ? 'Close blocked confidence gates before UAT.' : status === 'watch' ? 'Run report, alert, support, and performance drills.' : 'Proceed to UAT and security rehearsal.',
  };
}

export function v391V394RowsToCsv(gate: V391V394GateSnapshot) {
  const rows = [
    ['type', 'severity_or_status', 'area_or_check', 'finding_or_evidence', 'action'],
    ...gate.findings.map((finding) => ['finding', finding.severity, finding.area, finding.finding, finding.action]),
    ...gate.checks.map((row) => ['check', row.status, row.check, row.evidence, row.nextAction]),
  ];
  return rows.map((row) => row.map((value) => `"${String(value ?? '').replace(/"/g, '""')}"`).join(',')).join('\n');
}
