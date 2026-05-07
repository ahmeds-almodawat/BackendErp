export type V383GateStatus = 'local-watch' | 'staging-blocked' | 'staging-ready' | 'production-blocked' | 'production-ready';
export type V383RiskLevel = 'low' | 'medium' | 'high' | 'critical';
export type V383CoverageStatus = 'covered' | 'partial' | 'missing';

export interface V383PermissionCatalogItem {
  key: string;
  moduleEn?: string;
  labelEn?: string;
  module?: string;
  label?: string;
}

export interface V383RoleLike {
  id?: string;
  key?: string;
  nameEn?: string;
  name?: string;
  permissions?: string[];
}

export interface V383UserAccessLike {
  employeeId?: string;
  userId?: string;
  roleId?: string;
  roleKey?: string;
  scopeType?: string;
  scopeId?: string;
}

export interface V383UserLike {
  id?: string;
  employeeId?: string;
  email?: string;
  status?: string;
  active?: boolean;
}

export interface V383EmployeeLike {
  id?: string;
  name?: string;
  active?: boolean;
}

export interface V383StateLike {
  roles?: V383RoleLike[];
  userAccess?: V383UserAccessLike[];
  userAccounts?: V383UserLike[];
  employees?: V383EmployeeLike[];
  [key: string]: unknown;
}

export interface V383RouteRequirement {
  routeKey: string;
  label: string;
  requiredPermission: string;
  scope: 'global' | 'branch' | 'store' | 'cost-center' | 'company';
  risk: V383RiskLevel;
  backendRequired: boolean;
}

export interface V383RpcRequirement {
  rpcName: string;
  requiredPermission: string;
  caller: 'authenticated-rpc' | 'service-role-worker' | 'edge-function';
  serviceRoleOnly: boolean;
  risk: V383RiskLevel;
  module: string;
}

export interface V383DangerousAction {
  actionKey: string;
  module: string;
  label: string;
  requiredPermission: string;
  risk: V383RiskLevel;
  serverAuthorityRequired: boolean;
}

export interface V383CoverageRow {
  key: string;
  label: string;
  requiredPermission: string;
  status: V383CoverageStatus;
  risk: V383RiskLevel;
  evidence: string;
  action: string;
}

export interface V383RBACSnapshot {
  version: string;
  generatedAt: string;
  gateStatus: V383GateStatus;
  gateScore: number;
  permissionCount: number;
  roleCount: number;
  userCount: number;
  activeUserCount: number;
  scopedAssignmentCount: number;
  routeRequirements: V383RouteRequirement[];
  rpcRequirements: V383RpcRequirement[];
  dangerousActions: V383DangerousAction[];
  routeCoverage: V383CoverageRow[];
  rpcCoverage: V383CoverageRow[];
  dangerousActionCoverage: V383CoverageRow[];
  findings: V383CoverageRow[];
  nextAction: string;
}

export const V383_ROUTE_REQUIREMENTS: V383RouteRequirement[] = [
  { routeKey: 'dashboard', label: 'Executive Dashboard', requiredPermission: 'dashboard.view', scope: 'company', risk: 'medium', backendRequired: false },
  { routeKey: 'smartAnalysis', label: 'Smart Analysis', requiredPermission: 'finance.statements.view', scope: 'company', risk: 'high', backendRequired: true },
  { routeKey: 'reports', label: 'Reports', requiredPermission: 'finance.statements.view', scope: 'company', risk: 'high', backendRequired: true },
  { routeKey: 'workload', label: 'Workload Ops', requiredPermission: 'access.manage', scope: 'global', risk: 'critical', backendRequired: true },
  { routeKey: 'controls', label: 'Control Center', requiredPermission: 'access.manage', scope: 'global', risk: 'critical', backendRequired: true },
  { routeKey: 'sales', label: 'Sales / POS Trial', requiredPermission: 'sales.post', scope: 'branch', risk: 'high', backendRequired: true },
  { routeKey: 'inventory', label: 'Inventory', requiredPermission: 'inventory.view', scope: 'store', risk: 'high', backendRequired: true },
  { routeKey: 'purchasing', label: 'Purchasing', requiredPermission: 'purchasing.invoice.create', scope: 'branch', risk: 'high', backendRequired: true },
  { routeKey: 'production', label: 'Production / Prep', requiredPermission: 'production.batch.create', scope: 'store', risk: 'high', backendRequired: true },
  { routeKey: 'finance', label: 'Finance', requiredPermission: 'finance.view', scope: 'company', risk: 'critical', backendRequired: true },
  { routeKey: 'setup', label: 'Setup', requiredPermission: 'settings.master.manage', scope: 'global', risk: 'critical', backendRequired: true },
  { routeKey: 'users', label: 'Users & Employees', requiredPermission: 'access.user.manage', scope: 'global', risk: 'critical', backendRequired: true },
  { routeKey: 'access', label: 'Access Control', requiredPermission: 'access.manage', scope: 'global', risk: 'critical', backendRequired: true },
  { routeKey: 'hr', label: 'HR & Attendance', requiredPermission: 'hr.employee.manage', scope: 'branch', risk: 'high', backendRequired: true },
  { routeKey: 'imports', label: 'Import / Export', requiredPermission: 'imports.manage', scope: 'company', risk: 'critical', backendRequired: true },
  { routeKey: 'backup', label: 'Backup / Restore', requiredPermission: 'access.manage', scope: 'global', risk: 'critical', backendRequired: true },
  { routeKey: 'backend', label: 'Backend Mode', requiredPermission: 'access.manage', scope: 'global', risk: 'critical', backendRequired: true },
  { routeKey: 'rbac', label: 'RBAC Gate', requiredPermission: 'access.manage', scope: 'global', risk: 'critical', backendRequired: true },
];

export const V383_RPC_REQUIREMENTS: V383RpcRequirement[] = [
  { rpcName: 'worker_enqueue_job', requiredPermission: 'access.manage', caller: 'service-role-worker', serviceRoleOnly: true, risk: 'critical', module: 'worker' },
  { rpcName: 'worker_acquire_job', requiredPermission: 'access.manage', caller: 'service-role-worker', serviceRoleOnly: true, risk: 'critical', module: 'worker' },
  { rpcName: 'worker_enqueue_inventory_rebuild', requiredPermission: 'inventory.adjustment.approve', caller: 'service-role-worker', serviceRoleOnly: true, risk: 'critical', module: 'inventory' },
  { rpcName: 'worker_enqueue_pos_replay', requiredPermission: 'sales.post', caller: 'service-role-worker', serviceRoleOnly: true, risk: 'critical', module: 'sales' },
  { rpcName: 'worker_enqueue_import_cutover', requiredPermission: 'imports.manage', caller: 'service-role-worker', serviceRoleOnly: true, risk: 'critical', module: 'imports' },
  { rpcName: 'worker_enqueue_report_snapshot', requiredPermission: 'finance.statements.view', caller: 'service-role-worker', serviceRoleOnly: true, risk: 'high', module: 'reports' },
  { rpcName: 'worker_enqueue_finance_reconciliation', requiredPermission: 'finance.bank.reconcile', caller: 'service-role-worker', serviceRoleOnly: true, risk: 'critical', module: 'finance' },
  { rpcName: 'worker_enqueue_backup_archive', requiredPermission: 'access.manage', caller: 'service-role-worker', serviceRoleOnly: true, risk: 'critical', module: 'backup' },
  { rpcName: 'app_current_user_has_permission', requiredPermission: 'access.manage', caller: 'authenticated-rpc', serviceRoleOnly: false, risk: 'high', module: 'access' },
];

export const V383_DANGEROUS_ACTIONS: V383DangerousAction[] = [
  { actionKey: 'finance.post_journal', module: 'Finance', label: 'Post journal / official accounting batch', requiredPermission: 'finance.journal.post', risk: 'critical', serverAuthorityRequired: true },
  { actionKey: 'finance.lock_period', module: 'Finance', label: 'Lock or close fiscal period', requiredPermission: 'finance.period.lock', risk: 'critical', serverAuthorityRequired: true },
  { actionKey: 'finance.bank_reconcile', module: 'Finance', label: 'Approve bank reconciliation', requiredPermission: 'finance.bank.reconcile', risk: 'critical', serverAuthorityRequired: true },
  { actionKey: 'inventory.post_adjustment', module: 'Inventory', label: 'Approve stock count / adjustment', requiredPermission: 'inventory.adjustment.approve', risk: 'critical', serverAuthorityRequired: true },
  { actionKey: 'inventory.post_transfer', module: 'Inventory', label: 'Post store transfer', requiredPermission: 'inventory.transfer.post', risk: 'high', serverAuthorityRequired: true },
  { actionKey: 'purchasing.post_invoice', module: 'Purchasing', label: 'Post supplier invoice', requiredPermission: 'purchasing.invoice.post', risk: 'critical', serverAuthorityRequired: true },
  { actionKey: 'purchasing.post_payment', module: 'Purchasing', label: 'Post supplier payment', requiredPermission: 'purchasing.payment.post', risk: 'critical', serverAuthorityRequired: true },
  { actionKey: 'production.post_batch', module: 'Production', label: 'Post production batch and consumption', requiredPermission: 'production.batch.post', risk: 'critical', serverAuthorityRequired: true },
  { actionKey: 'sales.post_pos', module: 'Sales', label: 'Post POS/day close and deductions', requiredPermission: 'sales.post', risk: 'critical', serverAuthorityRequired: true },
  { actionKey: 'access.assign_role', module: 'Access', label: 'Assign role or change permissions', requiredPermission: 'access.manage', risk: 'critical', serverAuthorityRequired: true },
  { actionKey: 'backup.restore_platform', module: 'Backup', label: 'Restore full platform backup', requiredPermission: 'access.manage', risk: 'critical', serverAuthorityRequired: true },
];

function permissionKeysFromCatalog(catalog: V383PermissionCatalogItem[] = []): Set<string> {
  return new Set(catalog.map((item) => item.key).filter(Boolean));
}

function rolePermissionKeys(roles: V383RoleLike[] = []): Set<string> {
  const out = new Set<string>();
  roles.forEach((role) => (role.permissions ?? []).forEach((permission) => out.add(permission)));
  return out;
}

function coverageForPermission(key: string, label: string, risk: V383RiskLevel, catalog: Set<string>, assigned: Set<string>, evidencePrefix: string): V383CoverageRow {
  const inCatalog = catalog.has(key);
  const inRole = assigned.has(key);
  const status: V383CoverageStatus = inCatalog && inRole ? 'covered' : inCatalog ? 'partial' : 'missing';
  return {
    key,
    label,
    requiredPermission: key,
    status,
    risk,
    evidence: `${evidencePrefix}: catalog=${inCatalog ? 'yes' : 'no'}, assignedToAnyRole=${inRole ? 'yes' : 'no'}`,
    action: status === 'covered'
      ? 'Keep this permission mapped in route/action/RPC tests.'
      : status === 'partial'
        ? 'Permission exists but is not assigned to any role; assign it intentionally or document why blocked.'
        : 'Add this permission to the catalog and map it to the correct production role.',
  };
}

function countStatus(rows: V383CoverageRow[], status: V383CoverageStatus) {
  return rows.filter((row) => row.status === status).length;
}

function activeUsers(users: V383UserLike[] = []) {
  return users.filter((user) => user.active !== false && user.status !== 'disabled');
}

export function buildV383RBACSnapshot(state: V383StateLike = {}, permissionCatalog: V383PermissionCatalogItem[] = []): V383RBACSnapshot {
  const roles = Array.isArray(state.roles) ? state.roles : [];
  const access = Array.isArray(state.userAccess) ? state.userAccess : [];
  const users = Array.isArray(state.userAccounts) ? state.userAccounts : [];
  const employees = Array.isArray(state.employees) ? state.employees : [];
  const catalog = permissionKeysFromCatalog(permissionCatalog);
  const assigned = rolePermissionKeys(roles);
  const routeCoverage = V383_ROUTE_REQUIREMENTS.map((route) => coverageForPermission(route.requiredPermission, route.label, route.risk, catalog, assigned, 'route'));
  const rpcCoverage = V383_RPC_REQUIREMENTS.map((rpc) => coverageForPermission(rpc.requiredPermission, rpc.rpcName, rpc.risk, catalog, assigned, 'rpc'));
  const dangerousActionCoverage = V383_DANGEROUS_ACTIONS.map((action) => coverageForPermission(action.requiredPermission, action.label, action.risk, catalog, assigned, 'dangerous-action'));

  const findings: V383CoverageRow[] = [
    ...routeCoverage.filter((row) => row.status !== 'covered'),
    ...rpcCoverage.filter((row) => row.status !== 'covered'),
    ...dangerousActionCoverage.filter((row) => row.status !== 'covered'),
  ];

  const criticalMissing = findings.filter((row) => row.status === 'missing' && row.risk === 'critical').length;
  const highMissing = findings.filter((row) => row.status === 'missing' && row.risk === 'high').length;
  const partialCount = findings.filter((row) => row.status === 'partial').length;
  const unscopedActiveUsers = activeUsers(users).filter((user) => {
    const employeeId = user.employeeId || user.id;
    return employeeId && !access.some((row) => row.employeeId === employeeId || row.userId === user.id);
  }).length;
  const activeEmployeeNoUser = employees.filter((employee) => employee.active !== false && !users.some((user) => user.employeeId === employee.id)).length;
  const totalRows = routeCoverage.length + rpcCoverage.length + dangerousActionCoverage.length;
  const coveredRows = countStatus(routeCoverage, 'covered') + countStatus(rpcCoverage, 'covered') + countStatus(dangerousActionCoverage, 'covered');
  const baseScore = Math.round((coveredRows / Math.max(1, totalRows)) * 100);
  const gateScore = Math.max(0, Math.min(100, baseScore - criticalMissing * 10 - highMissing * 5 - partialCount * 2 - unscopedActiveUsers * 8));

  let gateStatus: V383GateStatus = 'local-watch';
  if (criticalMissing > 0 || unscopedActiveUsers > 0) gateStatus = 'production-blocked';
  else if (highMissing > 0 || partialCount > 0) gateStatus = 'staging-blocked';
  else if (gateScore >= 90) gateStatus = 'production-ready';
  else if (gateScore >= 75) gateStatus = 'staging-ready';

  const nextAction = gateStatus === 'production-blocked'
    ? 'Fix critical permission gaps and unscoped active users before any production backend cutover.'
    : gateStatus === 'staging-blocked'
      ? 'Close partial/high-risk RBAC gaps before calling staging secure.'
      : gateStatus === 'production-ready'
        ? 'Run RLS smoke tests with real Supabase users, then freeze RBAC for UAT.'
        : gateStatus === 'staging-ready'
          ? 'Begin staging RBAC test matrix with owner, finance, inventory, branch, and read-only users.'
          : 'Local RBAC map is visible; do not use as production enforcement until backend/RLS tests are green.';

  return {
    version: 'v383 RBAC Production Hardening',
    generatedAt: new Date().toISOString(),
    gateStatus,
    gateScore,
    permissionCount: catalog.size,
    roleCount: roles.length,
    userCount: users.length,
    activeUserCount: activeUsers(users).length,
    scopedAssignmentCount: access.length,
    routeRequirements: V383_ROUTE_REQUIREMENTS,
    rpcRequirements: V383_RPC_REQUIREMENTS,
    dangerousActions: V383_DANGEROUS_ACTIONS,
    routeCoverage,
    rpcCoverage,
    dangerousActionCoverage,
    findings: [
      ...findings,
      ...(unscopedActiveUsers ? [{ key: 'active-users-without-scope', label: 'Active users without access scope', requiredPermission: 'access.manage', status: 'missing' as const, risk: 'critical' as const, evidence: `${unscopedActiveUsers} active user(s) have no access scope assignment.`, action: 'Assign branch/store/company scope before backend cutover.' }] : []),
      ...(activeEmployeeNoUser ? [{ key: 'active-employees-without-user', label: 'Active employees without user account', requiredPermission: 'access.user.manage', status: 'partial' as const, risk: 'medium' as const, evidence: `${activeEmployeeNoUser} active employee(s) do not have user accounts.`, action: 'Create users only for operators who need system access; document the rest.' }] : []),
    ],
    nextAction,
  };
}

export function v383RowsToCsv(rows: V383CoverageRow[]) {
  const header = ['key', 'label', 'requiredPermission', 'status', 'risk', 'evidence', 'action'];
  const escape = (value: unknown) => `"${String(value ?? '').replace(/"/g, '""')}"`;
  return [header.join(','), ...rows.map((row) => header.map((key) => escape((row as unknown as Record<string, unknown>)[key])).join(','))].join('\n');
}
