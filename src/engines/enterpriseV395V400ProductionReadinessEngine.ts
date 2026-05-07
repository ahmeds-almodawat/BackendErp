export type V395V400GateId = 'tablet' | 'deployment' | 'uat' | 'security' | 'rehearsal' | 'release';
export type V395V400Status = 'ready' | 'watch' | 'blocked';
export type V395V400Severity = 'critical' | 'warning' | 'info' | 'good';

export interface V395V400Finding {
  severity: V395V400Severity;
  area: string;
  finding: string;
  action: string;
}

export interface V395V400CheckRow {
  check: string;
  status: V395V400Status;
  evidence: string;
  nextAction: string;
}

export interface V395V400GateSnapshot {
  gateId: V395V400GateId;
  version: string;
  title: string;
  titleAr: string;
  generatedAt: string;
  score: number;
  status: V395V400Status;
  counts: Record<string, number>;
  checks: V395V400CheckRow[];
  findings: V395V400Finding[];
  releaseRule: string;
  releaseRuleAr: string;
  nextAction: string;
}

function arr<T = any>(value: unknown): T[] {
  return Array.isArray(value) ? value as T[] : [];
}

function obj(value: unknown): Record<string, any> {
  return value && typeof value === 'object' ? value as Record<string, any> : {};
}

function n(value: unknown) {
  const number = Number(value ?? 0);
  return Number.isFinite(number) ? number : 0;
}

function finding(list: V395V400Finding[], severity: V395V400Severity, area: string, message: string, action: string) {
  list.push({ severity, area, finding: message, action });
}

function check(checkName: string, status: V395V400Status, evidence: string, nextAction: string): V395V400CheckRow {
  return { check: checkName, status, evidence, nextAction };
}

function statusFromFindings(findings: V395V400Finding[]): V395V400Status {
  if (findings.some((item) => item.severity === 'critical')) return 'blocked';
  if (findings.some((item) => item.severity === 'warning')) return 'watch';
  return 'ready';
}

function scoreFromFindings(findings: V395V400Finding[], base = 100) {
  const penalty = findings.reduce((sum, item) => {
    if (item.severity === 'critical') return sum + 22;
    if (item.severity === 'warning') return sum + 9;
    if (item.severity === 'info') return sum + 2;
    return sum;
  }, 0);
  return Math.max(0, Math.min(100, Math.round(base - penalty)));
}

function gateBase(gateId: V395V400GateId, version: string, title: string, titleAr: string, findings: V395V400Finding[], counts: Record<string, number>, checks: V395V400CheckRow[], releaseRule: string, releaseRuleAr: string, nextActionReady: string): V395V400GateSnapshot {
  if (!findings.length) finding(findings, 'good', title, 'No blocking evidence found in the local readiness snapshot.', nextActionReady);
  const status = statusFromFindings(findings);
  return {
    gateId,
    version,
    title,
    titleAr,
    generatedAt: new Date().toISOString(),
    score: scoreFromFindings(findings),
    status,
    counts,
    checks,
    findings,
    releaseRule,
    releaseRuleAr,
    nextAction: status === 'blocked' ? 'Close critical blockers before pilot release.' : status === 'watch' ? 'Collect missing evidence and repeat the release rehearsal.' : nextActionReady,
  };
}

function countAudits(state: any, term: string) {
  return arr(state?.audits).filter((audit: any) => JSON.stringify(audit).toLowerCase().includes(term)).length;
}

function countRows(state: any, keys: string[]) {
  return keys.reduce((sum, key) => sum + arr(state?.[key]).length, 0);
}

function buildTabletGate(state: any): V395V400GateSnapshot {
  const findings: V395V400Finding[] = [];
  const users = arr(state?.userAccounts);
  const routes = ['Dashboard', 'Inventory', 'Purchasing', 'Sales/POS', 'Production', 'Finance', 'Reports', 'Import/Export'];
  const mobileEvidence = countAudits(state, 'mobile') + countAudits(state, 'tablet');
  const errorLogs = arr(state?.appErrorLogs).length + countAudits(state, 'white page') + countAudits(state, 'module failed');
  if (!users.length) finding(findings, 'warning', 'Pilot users', 'No user accounts are available for tablet/mobile role testing.', 'Create pilot operators and manager reviewers before tablet UAT.');
  if (!mobileEvidence) finding(findings, 'warning', 'Device evidence', 'No tablet/mobile QA evidence is recorded.', 'Run tablet widths for cashier, branch manager, store keeper, and finance reviewer flows.');
  if (errorLogs) finding(findings, 'warning', 'Stability evidence', `${errorLogs} local UI error indicator(s) found.`, 'Export diagnostics and close module rendering issues before pilot.');
  return gateBase('tablet', 'v395 Tablet / Mobile UX Gate', 'Tablet / Mobile UX Gate', 'بوابة تجربة الأجهزة اللوحية والجوال', findings,
    { users: users.length, routeCoverage: routes.length, mobileEvidence, errorSignals: errorLogs },
    [
      check('Critical route touch coverage', mobileEvidence ? 'watch' : 'blocked', `${routes.length} critical route(s) require tablet review.`, 'Open each route at tablet width and capture pass/fail evidence.'),
      check('Operator role coverage', users.length ? 'watch' : 'blocked', `${users.length} user account(s) detected.`, 'Test cashier, store keeper, branch manager, finance, and owner roles.'),
      check('White-page resilience', errorLogs ? 'watch' : 'ready', `${errorLogs} UI error signal(s) detected.`, 'Keep module error boundaries and export diagnostics available.'),
    ],
    'Tablet pilot is allowed only after every critical route renders without horizontal breakage and every pilot role can complete its review flow.',
    'يسمح بتجربة الأجهزة اللوحية فقط بعد عمل كل المسارات الحرجة دون كسر في العرض وتمكن كل دور تجريبي من إكمال المراجعة.',
    'Proceed to tablet UAT evidence capture.');
}

function buildDeploymentGate(state: any): V395V400GateSnapshot {
  const findings: V395V400Finding[] = [];
  const backups = arr(state?.backupArchiveRuns).length + countAudits(state, 'backup');
  const backendEvidence = countAudits(state, 'backend') + countAudits(state, 'supabase');
  const deploymentEvidence = countAudits(state, 'deploy') + countAudits(state, 'vercel');
  if (!backups) finding(findings, 'critical', 'Backup before deploy', 'No backup evidence exists before deployment.', 'Export a v381 backup ZIP and verify restore before deployment.');
  if (!backendEvidence) finding(findings, 'warning', 'Backend mode', 'No backend/Supabase cutover evidence recorded.', 'Capture v382 Backend Mode gate evidence before staging deployment.');
  if (!deploymentEvidence) finding(findings, 'warning', 'Deployment trail', 'No deployment audit evidence recorded.', 'Record environment, commit SHA, build output, and rollback plan.');
  return gateBase('deployment', 'v396 Deployment Gate', 'Deployment Gate', 'بوابة النشر', findings,
    { backupEvidence: backups, backendEvidence, deploymentEvidence, auditLogs: arr(state?.audits).length },
    [
      check('Backup before release', backups ? 'ready' : 'blocked', `${backups} backup evidence item(s).`, 'Take one full platform backup ZIP and restore it on a test copy.'),
      check('Environment separation', backendEvidence ? 'watch' : 'blocked', `${backendEvidence} backend/cutover audit item(s).`, 'Separate local, staging, and production environment variables.'),
      check('Rollback plan', deploymentEvidence ? 'watch' : 'blocked', `${deploymentEvidence} deployment evidence item(s).`, 'Document one-command rollback and database restore point.'),
    ],
    'Deployment is blocked unless backup, restore, environment, build, and rollback evidence are captured for the exact release commit.',
    'يمنع النشر ما لم يتم توثيق النسخ الاحتياطي والاستعادة والبيئة والبناء وخطة الرجوع لنفس إصدار الإطلاق.',
    'Prepare staging deployment checklist and rollback rehearsal.');
}

function buildUatGate(state: any): V395V400GateSnapshot {
  const findings: V395V400Finding[] = [];
  const purchasing = countRows(state, ['purchaseRequests', 'purchaseOrders', 'goodsReceipts', 'purchaseInvoices', 'supplierPayments']);
  const inventory = countRows(state, ['stockMovements', 'stockCounts', 'stockAdjustments', 'inventoryApprovals']);
  const sales = countRows(state, ['sales', 'posReplayAppliedRows', 'salesPosBatches']);
  const production = countRows(state, ['productionBatches', 'recipes', 'recipeLines']);
  const finance = countRows(state, ['journals', 'financeReconciliationRuns', 'reportSnapshots']);
  const users = arr(state?.userAccounts).length;
  const weakAreas = [purchasing ? '' : 'purchasing', inventory ? '' : 'inventory', sales ? '' : 'sales/POS', production ? '' : 'production', finance ? '' : 'finance'].filter(Boolean);
  if (weakAreas.length) finding(findings, 'critical', 'Scenario coverage', `Missing transaction evidence for ${weakAreas.join(', ')}.`, 'Run one end-to-end month scenario before UAT signoff.');
  if (!users) finding(findings, 'warning', 'UAT users', 'No user accounts detected for role-based UAT.', 'Create named UAT users and assign roles/scopes.');
  if (!arr(state?.audits).length) finding(findings, 'warning', 'UAT evidence', 'No audit trail exists for UAT execution.', 'Record UAT scenario pass/fail evidence and tester notes.');
  return gateBase('uat', 'v397 UAT Gate', 'UAT Gate', 'بوابة اختبار قبول المستخدم', findings,
    { purchasing, inventory, sales, production, finance, users, auditLogs: arr(state?.audits).length },
    [
      check('Procure-to-pay scenario', purchasing ? 'watch' : 'blocked', `${purchasing} purchasing row(s).`, 'Run PR → PO → GRN → invoice → payment evidence.'),
      check('Inventory scenario', inventory ? 'watch' : 'blocked', `${inventory} inventory row(s).`, 'Run stock movement, count, adjustment, and valuation evidence.'),
      check('Sales/POS scenario', sales ? 'watch' : 'blocked', `${sales} sales/POS row(s).`, 'Run POS replay, settlement, refund, payment split, and VAT evidence.'),
      check('Finance/reporting scenario', finance ? 'watch' : 'blocked', `${finance} finance/report row(s).`, 'Run reconciliation and management pack snapshot evidence.'),
    ],
    'UAT can be signed only after every critical business scenario has named tester evidence, expected result, actual result, and owner approval.',
    'لا يتم اعتماد اختبار قبول المستخدم إلا بعد وجود دليل لكل سيناريو أعمال حرج مع المختبر والنتيجة المتوقعة والفعلية وموافقة المالك.',
    'Prepare UAT signoff pack and scenario tracker.');
}

function buildSecurityGate(state: any): V395V400GateSnapshot {
  const findings: V395V400Finding[] = [];
  const roles = arr(state?.roles);
  const users = arr(state?.userAccounts);
  const access = arr(state?.userAccess);
  const disabledUsers = users.filter((user: any) => user?.active === false || String(user?.status || '').toLowerCase() === 'disabled').length;
  const rbacEvidence = countAudits(state, 'rbac') + countAudits(state, 'permission');
  const backendEvidence = countAudits(state, 'service_role') + countAudits(state, 'service role') + countAudits(state, 'secret');
  if (!roles.length) finding(findings, 'critical', 'Roles', 'No roles are configured.', 'Create owner, finance, inventory, branch, report, and import roles.');
  if (users.length && !access.length) finding(findings, 'critical', 'Assignments', 'Users exist but no access assignments are detected.', 'Assign every active user a role and branch/store scope.');
  if (!rbacEvidence) finding(findings, 'warning', 'RBAC evidence', 'No RBAC audit evidence detected.', 'Export v383 RBAC Gate and prove route/RPC permission coverage.');
  if (backendEvidence) finding(findings, 'critical', 'Secret exposure', 'Possible service-role/secret text appears in local audit evidence.', 'Verify no service-role key is exposed to browser code or committed files.');
  return gateBase('security', 'v398 Security Review Gate', 'Security Review Gate', 'بوابة مراجعة الأمن', findings,
    { roles: roles.length, users: users.length, accessAssignments: access.length, disabledUsers, rbacEvidence, secretSignals: backendEvidence },
    [
      check('Role model exists', roles.length ? 'watch' : 'blocked', `${roles.length} role(s).`, 'Map every dangerous action to a role and permission.'),
      check('User scope coverage', users.length && access.length ? 'watch' : 'blocked', `${users.length} user(s), ${access.length} access assignment(s).`, 'Every active user needs role and branch/store scope.'),
      check('Secret exposure check', backendEvidence ? 'blocked' : 'ready', `${backendEvidence} possible secret signal(s).`, 'Keep service-role keys only in server/Edge Function secrets.'),
    ],
    'Production is blocked until RBAC, RLS, storage policies, service secrets, audit immutability, and backup access are reviewed and signed off.',
    'يمنع الإنتاج حتى تتم مراجعة واعتماد الصلاحيات و RLS وسياسات التخزين والأسرار وسجل التدقيق والوصول للنسخ الاحتياطي.',
    'Run security signoff and RLS smoke tests.');
}

function buildRehearsalGate(state: any): V395V400GateSnapshot {
  const findings: V395V400Finding[] = [];
  const backup = countAudits(state, 'backup');
  const restore = countAudits(state, 'restore');
  const reset = countAudits(state, 'reset') + countAudits(state, 'migration');
  const qa = countAudits(state, 'qa') + countAudits(state, 'build');
  const reports = arr(state?.reportSnapshots).length + arr(state?.reports).length;
  if (!backup || !restore) finding(findings, 'critical', 'Restore rehearsal', 'Backup/restore rehearsal evidence is incomplete.', 'Perform backup export, restore into a clean copy, and record evidence.');
  if (!reset) finding(findings, 'warning', 'Migration rehearsal', 'No migration/reset rehearsal evidence detected.', 'Run supabase db reset and capture pass evidence for the release commit.');
  if (!qa) finding(findings, 'warning', 'QA rehearsal', 'No QA/build rehearsal evidence detected in local audit state.', 'Run qa:all, db reset, and build before release.');
  if (!reports) finding(findings, 'warning', 'Report rehearsal', 'No report snapshot/report output exists.', 'Generate one management report pack after restore.');
  return gateBase('rehearsal', 'v399 Production Rehearsal Gate', 'Production Rehearsal Gate', 'بوابة تجربة الإطلاق', findings,
    { backupEvidence: backup, restoreEvidence: restore, migrationEvidence: reset, qaEvidence: qa, reportEvidence: reports },
    [
      check('Backup and restore drill', backup && restore ? 'ready' : 'blocked', `${backup} backup / ${restore} restore evidence item(s).`, 'Restore a full backup ZIP/database copy into a clean environment.'),
      check('Migration reset drill', reset ? 'watch' : 'blocked', `${reset} migration/reset evidence item(s).`, 'Run clean db reset using the release migration chain.'),
      check('Post-restore report drill', reports ? 'watch' : 'blocked', `${reports} report evidence item(s).`, 'Generate reports after restore and compare totals.'),
    ],
    'A release rehearsal passes only when backup, restore, migration reset, QA/build, login, and report generation are all proven on a clean environment.',
    'تنجح تجربة الإطلاق فقط عند إثبات النسخ والاستعادة والمهاجرات والفحص والبناء والدخول والتقارير على بيئة نظيفة.',
    'Schedule final rehearsal and signoff.');
}

function buildReleaseGate(state: any): V395V400GateSnapshot {
  const findings: V395V400Finding[] = [];
  const gates = ['v382 backend', 'v383 rbac', 'v384 source', 'v385 purchasing', 'v386 inventory', 'v387 sales', 'v388 production', 'v389 finance', 'v390 hr', 'v391 report', 'v392 alerts', 'v393 support', 'v394 performance'];
  const evidence = gates.reduce((sum, term) => sum + countAudits(state, term), 0);
  const backup = countAudits(state, 'backup');
  const support = countAudits(state, 'support') + arr(state?.supportDiagnosticsRuns).length;
  const blockers = arr(state?.releaseBlockers).length + arr(state?.criticalFindings).length;
  if (!backup) finding(findings, 'critical', 'Backup', 'No release backup evidence exists.', 'Take a release backup and verify restore before pilot release.');
  if (!support) finding(findings, 'warning', 'Support readiness', 'No support/diagnostics run evidence exists.', 'Prepare support contacts, diagnostics export, and issue triage flow.');
  if (!evidence) finding(findings, 'warning', 'Gate signoff', 'No gate signoff evidence was found in local audit state.', 'Export and sign off all v382-v399 gates before release.');
  if (blockers) finding(findings, 'critical', 'Open blockers', `${blockers} blocker/finding row(s) detected.`, 'Close or formally accept every release blocker.');
  return gateBase('release', 'v400 Pilot Release Gate', 'Pilot Release Gate', 'بوابة الإطلاق التجريبي', findings,
    { gateEvidence: evidence, backupEvidence: backup, supportEvidence: support, openBlockers: blockers, auditLogs: arr(state?.audits).length },
    [
      check('Gate signoff pack', evidence ? 'watch' : 'blocked', `${evidence} gate evidence signal(s).`, 'Export all gate CSVs and attach owner signoff.'),
      check('Release backup', backup ? 'ready' : 'blocked', `${backup} backup evidence item(s).`, 'Keep release backup and restore instructions outside the app as well.'),
      check('Support handover', support ? 'watch' : 'blocked', `${support} support evidence item(s).`, 'Define issue intake, escalation, and rollback decision owner.'),
    ],
    'Pilot release is allowed only when all prior gates are signed, backup/restore is proven, support is staffed, and rollback owner is named.',
    'يسمح بالإطلاق التجريبي فقط بعد توقيع كل البوابات السابقة وإثبات النسخ والاستعادة وتجهيز الدعم وتحديد مالك الرجوع.',
    'Create the pilot release signoff package.');
}

export function buildV395V400Gate(state: any, gateId: V395V400GateId, totals: any = {}): V395V400GateSnapshot {
  const safeState = obj(state);
  if (gateId === 'tablet') return buildTabletGate(safeState);
  if (gateId === 'deployment') return buildDeploymentGate(safeState);
  if (gateId === 'uat') return buildUatGate(safeState);
  if (gateId === 'security') return buildSecurityGate(safeState);
  if (gateId === 'rehearsal') return buildRehearsalGate(safeState);
  return buildReleaseGate(safeState);
}

export function buildV395V400Snapshot(state: any, totals: any = {}) {
  const gates: V395V400GateId[] = ['tablet', 'deployment', 'uat', 'security', 'rehearsal', 'release'];
  const snapshots = gates.map((gate) => buildV395V400Gate(state, gate, totals));
  const blocked = snapshots.filter((gate) => gate.status === 'blocked').length;
  const watch = snapshots.filter((gate) => gate.status === 'watch').length;
  const overallScore = Math.round(snapshots.reduce((sum, gate) => sum + gate.score, 0) / Math.max(1, snapshots.length));
  return {
    version: 'v395-v400 Production Readiness Gates',
    generatedAt: new Date().toISOString(),
    overallScore,
    status: blocked ? 'blocked' : watch ? 'watch' : 'ready',
    gates: snapshots,
    nextAction: blocked ? 'Close blocked production-readiness gates before pilot.' : watch ? 'Collect missing evidence and rehearse again.' : 'Prepare signed pilot release package.',
  };
}

export function v395V400RowsToCsv(gate: V395V400GateSnapshot) {
  const rows = [
    ['type', 'severity_or_status', 'area_or_check', 'finding_or_evidence', 'action'],
    ...gate.checks.map((row) => ['check', row.status, row.check, row.evidence, row.nextAction]),
    ...gate.findings.map((row) => ['finding', row.severity, row.area, row.finding, row.action]),
  ];
  return rows.map((row) => row.map((cell) => {
    const text = String(cell ?? '');
    return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
  }).join(',')).join('\n');
}
