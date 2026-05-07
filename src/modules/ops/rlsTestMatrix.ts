export interface RlsTestCase {
  key: string;
  module: string;
  actorRole: "admin" | "finance" | "inventory" | "branch_manager" | "report_viewer" | "normal_user";
  action: "select" | "insert" | "update" | "delete" | "rpc";
  resource: string;
  expected: "allow" | "deny";
  reason: string;
  critical: boolean;
}

export const enterpriseRlsTestMatrix: RlsTestCase[] = [
  {
    key: "normal_user_cannot_post_finance",
    module: "finance",
    actorRole: "normal_user",
    action: "rpc",
    resource: "finance_post_journal",
    expected: "deny",
    reason: "Only finance/posting roles should post journals.",
    critical: true,
  },
  {
    key: "report_viewer_cannot_modify_finance",
    module: "finance",
    actorRole: "report_viewer",
    action: "update",
    resource: "finance_journal_entries_backend",
    expected: "deny",
    reason: "Report viewers are read-only.",
    critical: true,
  },
  {
    key: "inventory_manager_can_adjust_inventory",
    module: "inventory",
    actorRole: "inventory",
    action: "insert",
    resource: "inventory_adjustment_requests",
    expected: "allow",
    reason: "Inventory manager should create adjustment requests.",
    critical: true,
  },
  {
    key: "normal_user_cannot_see_other_branch_stock",
    module: "inventory",
    actorRole: "normal_user",
    action: "select",
    resource: "inventory_stock_balances",
    expected: "deny",
    reason: "Branch scope must prevent cross-branch data exposure.",
    critical: true,
  },
  {
    key: "admin_can_manage_settings",
    module: "setup",
    actorRole: "admin",
    action: "update",
    resource: "app_settings",
    expected: "allow",
    reason: "Admin should manage system settings.",
    critical: true,
  },
  {
    key: "normal_user_cannot_approve_imports",
    module: "imports",
    actorRole: "normal_user",
    action: "rpc",
    resource: "import_approve_staging_file",
    expected: "deny",
    reason: "Import approval must be restricted.",
    critical: true,
  },
];

export function summarizeRlsTestMatrix() {
  return {
    testCount: enterpriseRlsTestMatrix.length,
    criticalCount: enterpriseRlsTestMatrix.filter((test) => test.critical).length,
    allowCases: enterpriseRlsTestMatrix.filter((test) => test.expected === "allow").length,
    denyCases: enterpriseRlsTestMatrix.filter((test) => test.expected === "deny").length,
  };
}
