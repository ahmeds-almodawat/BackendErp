export type RlsDryRunExpected = "allow" | "deny";
export type RlsDryRunStatus = "not_run" | "passed" | "failed" | "blocked";

export interface RlsDryRunCase {
  key: string;
  module: string;
  actorRole: "admin" | "finance" | "inventory" | "branch_manager" | "report_viewer" | "normal_user";
  action: "select" | "insert" | "update" | "delete" | "rpc";
  resource: string;
  expected: RlsDryRunExpected;
  status: RlsDryRunStatus;
  critical: boolean;
}

export const rlsDryRunCases: RlsDryRunCase[] = [
  { key: "normal_user_cannot_post_journal", module: "finance", actorRole: "normal_user", action: "rpc", resource: "finance_post_journal", expected: "deny", status: "not_run", critical: true },
  { key: "finance_can_create_journal", module: "finance", actorRole: "finance", action: "insert", resource: "finance_journal_entries_backend", expected: "allow", status: "not_run", critical: true },
  { key: "report_viewer_read_only_finance", module: "finance", actorRole: "report_viewer", action: "update", resource: "finance_journal_entries_backend", expected: "deny", status: "not_run", critical: true },
  { key: "inventory_can_adjust_stock", module: "inventory", actorRole: "inventory", action: "insert", resource: "inventory_adjustment_requests", expected: "allow", status: "not_run", critical: true },
  { key: "normal_user_cannot_approve_import", module: "imports", actorRole: "normal_user", action: "rpc", resource: "import_approve_staging_file", expected: "deny", status: "not_run", critical: true },
  { key: "admin_can_manage_settings", module: "setup", actorRole: "admin", action: "update", resource: "app_settings", expected: "allow", status: "not_run", critical: true },
];

export function summarizeRlsDryRun(cases: RlsDryRunCase[] = rlsDryRunCases) {
  const failed = cases.filter((item) => item.status === "failed").length;
  const blocked = cases.filter((item) => item.status === "blocked").length;
  const notRun = cases.filter((item) => item.status === "not_run").length;
  const passed = cases.filter((item) => item.status === "passed").length;

  return {
    status: failed > 0 || blocked > 0 ? "blocked" : notRun > 0 ? "warning" : "ready",
    failed,
    blocked,
    notRun,
    passed,
    total: cases.length,
  };
}
