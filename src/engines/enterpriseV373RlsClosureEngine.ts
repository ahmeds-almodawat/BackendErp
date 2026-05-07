export type V373RlsClosureStatus =
  | 'explicit-policy'
  | 'backend-rpc-only'
  | 'module-policy-test-required'
  | 'guardrail-policy-review'
  | 'unresolved';

export type V373RlsRisk = 'low' | 'medium' | 'high' | 'critical';

export interface V373RlsTableInput {
  table: string;
  enabledIn: string[];
  policyNames: string[];
  policyFiles: string[];
}

export interface V373RlsClosureRow {
  table: string;
  module: string;
  status: V373RlsClosureStatus;
  risk: V373RlsRisk;
  hasExplicitPolicy: boolean;
  policyCount: number;
  policyNames: string;
  enabledIn: string;
  accessModel: string;
  requiredTest: string;
  nextAction: string;
}

export interface V373RlsClosureSummary {
  version: string;
  generatedAt: string;
  totalTables: number;
  explicitPolicyTables: number;
  backendRpcOnlyTables: number;
  modulePolicyTestRequiredTables: number;
  guardrailPolicyReviewTables: number;
  unresolvedTables: number;
  criticalRiskTables: number;
  highRiskTables: number;
  rows: V373RlsClosureRow[];
  nextAction: string;
}

const financePattern = /^(finance_|journal|posting_|ap_|ar_|bank_|vat_|fiscal_|close_|reconciliation|asset|cash|ledger|supplier_payment|purchase_invoice|sales_pos|pos_|report_snapshot|report_|trial_balance|gl_|pl_|balance_sheet)/i;
const inventoryPattern = /^(inventory_|stock_|store_|item_|lot_|expiry_|transfer_|count_|movement_|production_|recipe_|waste|costing)/i;
const securityPattern = /^(app_role|app_permission|user_role|role_permission|auth_|approval_|access_|profiles|employees|users|branch_user|permission_|settings|system_|admin_)/i;
const auditPattern = /^(audit_|live_audit|app_error|error_|backup_|archive_|cutover_|readiness_|backend_|worker_|job_|dead_letter|checkpoint|artifact)/i;
const masterPattern = /^(branches|stores|suppliers|items|customers|cost_centers|chart_accounts|departments|categories|units|tax_|payment_|price_|menus|menu_)/i;

function moduleFor(table: string): string {
  if (financePattern.test(table)) return 'finance';
  if (inventoryPattern.test(table)) return 'inventory/production';
  if (securityPattern.test(table)) return 'security/access';
  if (auditPattern.test(table)) return 'audit/ops';
  if (masterPattern.test(table)) return 'master-data';
  return 'general';
}

function riskFor(table: string, hasExplicitPolicy: boolean): V373RlsRisk {
  if (hasExplicitPolicy) return 'low';
  if (/journal|posting|finance|ap_|ar_|bank|vat|fiscal|close|payment|stock|inventory|worker|job|backup|audit|auth|role|permission|approval/i.test(table)) return 'high';
  if (/users|profiles|employees|salary|payroll/i.test(table)) return 'critical';
  if (masterPattern.test(table)) return 'medium';
  return 'medium';
}

function accessModelFor(table: string, module: string, hasExplicitPolicy: boolean): string {
  if (hasExplicitPolicy) return 'Direct table access is allowed only through the detected table policy/policies.';
  if (module === 'finance') return 'Backend RPC only until finance role, branch, period, and posting policies are proven.';
  if (module === 'inventory/production') return 'Backend RPC only until store/branch scope and movement lifecycle policies are proven.';
  if (module === 'security/access') return 'Admin/owner RPC only; never expose broad direct table writes from the browser.';
  if (module === 'audit/ops') return 'Append/read through controlled backend services; audit records should be immutable to normal users.';
  if (module === 'master-data') return 'Read via scoped policies; writes through admin/setup permissions and branch/company scope.';
  return 'Document module owner and add explicit read/write policy tests before production use.';
}

function requiredTestFor(table: string, module: string, hasExplicitPolicy: boolean): string {
  if (hasExplicitPolicy) return 'Policy smoke: allowed role can read/write expected rows; unauthorized role is denied.';
  if (module === 'finance') return 'Finance RLS/RPC test: branch user denied other branch; closed period blocks posting; unauthorized role cannot post/reverse/export.';
  if (module === 'inventory/production') return 'Inventory RLS/RPC test: storekeeper can access assigned store only; movements require posting permission; stock count lifecycle is enforced.';
  if (module === 'security/access') return 'Access test: non-admin denied; last owner cannot be removed; permission assignment is audited.';
  if (module === 'audit/ops') return 'Audit/ops test: normal users cannot update/delete audit or job evidence; auditor can read only permitted scope.';
  if (module === 'master-data') return 'Master data test: read scope by branch/company; create/update requires setup permission; archived rows are handled consistently.';
  return 'Module policy test must be written before production enablement.';
}

export function classifyV373RlsTable(input: V373RlsTableInput): V373RlsClosureRow {
  const table = input.table;
  const hasExplicitPolicy = input.policyNames.length > 0;
  const module = moduleFor(table);
  const risk = riskFor(table, hasExplicitPolicy);
  let status: V373RlsClosureStatus;

  if (hasExplicitPolicy) status = 'explicit-policy';
  else if (module === 'finance' || module === 'inventory/production' || module === 'security/access' || module === 'audit/ops') status = 'backend-rpc-only';
  else if (module === 'master-data') status = 'module-policy-test-required';
  else status = 'guardrail-policy-review';

  return {
    table,
    module,
    status,
    risk,
    hasExplicitPolicy,
    policyCount: input.policyNames.length,
    policyNames: input.policyNames.length ? input.policyNames.join(', ') : 'none detected',
    enabledIn: input.enabledIn.join(', '),
    accessModel: accessModelFor(table, module, hasExplicitPolicy),
    requiredTest: requiredTestFor(table, module, hasExplicitPolicy),
    nextAction: hasExplicitPolicy
      ? 'Keep explicit policy covered by automated RLS smoke tests.'
      : status === 'backend-rpc-only'
        ? 'Confirm no browser direct writes and add RPC permission/scope tests for this table.'
        : status === 'module-policy-test-required'
          ? 'Add explicit branch/company read/write policies or document a module-level policy test.'
          : 'Review table owner, add explicit policy or mark backend-only with test evidence.',
  };
}

export function buildV373RlsClosureSummary(inputs: V373RlsTableInput[]): V373RlsClosureSummary {
  const rows = inputs.map(classifyV373RlsTable).sort((a, b) => {
    const riskRank: Record<V373RlsRisk, number> = { critical: 4, high: 3, medium: 2, low: 1 };
    return riskRank[b.risk] - riskRank[a.risk] || a.module.localeCompare(b.module) || a.table.localeCompare(b.table);
  });

  const statusCount = (status: V373RlsClosureStatus) => rows.filter((row) => row.status === status).length;
  const riskCount = (risk: V373RlsRisk) => rows.filter((row) => row.risk === risk).length;

  return {
    version: 'v373 RLS Closure',
    generatedAt: new Date().toISOString(),
    totalTables: rows.length,
    explicitPolicyTables: statusCount('explicit-policy'),
    backendRpcOnlyTables: statusCount('backend-rpc-only'),
    modulePolicyTestRequiredTables: statusCount('module-policy-test-required'),
    guardrailPolicyReviewTables: statusCount('guardrail-policy-review'),
    unresolvedTables: statusCount('unresolved'),
    criticalRiskTables: riskCount('critical'),
    highRiskTables: riskCount('high'),
    rows,
    nextAction: riskCount('critical') || riskCount('high')
      ? 'Start module RLS proof with critical/high-risk finance, inventory, security, audit, and HR/profile tables.'
      : 'Proceed to v374 job runtime schema after adding policy smoke tests.',
  };
}

export function v373RowsToMarkdown(rows: V373RlsClosureRow[]): string {
  const header = [
    '| Table | Module | Status | Risk | Policies | Access model | Required test | Next action |',
    '|---|---|---|---|---:|---|---|---|',
  ];
  const body = rows.map((row) => [
    row.table,
    row.module,
    row.status,
    row.risk,
    String(row.policyCount),
    row.accessModel,
    row.requiredTest,
    row.nextAction,
  ].map((value) => String(value).replaceAll('|', '\\|')).join(' | '));

  return [...header, ...body.map((line) => `| ${line} |`)].join('\n');
}
