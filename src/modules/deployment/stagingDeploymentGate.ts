export type DeploymentGateStatus = "not_checked" | "ready" | "warning" | "blocked";

export interface StagingDeploymentCheck {
  key: string;
  label: string;
  status: DeploymentGateStatus;
  required: boolean;
  owner: "developer" | "admin" | "finance" | "operations";
}

export const stagingDeploymentChecks: StagingDeploymentCheck[] = [
  { key: "build_passes", label: "Build passes", status: "not_checked", required: true, owner: "developer" },
  { key: "qa_all_passes", label: "QA all passes", status: "not_checked", required: true, owner: "developer" },
  { key: "migrations_applied_staging", label: "Migrations applied to staging", status: "not_checked", required: true, owner: "developer" },
  { key: "rls_tests_pass", label: "RLS tests pass", status: "not_checked", required: true, owner: "developer" },
  { key: "backup_restore_tested", label: "Backup and restore tested", status: "not_checked", required: true, owner: "admin" },
  { key: "uat_data_loaded", label: "UAT data loaded", status: "not_checked", required: true, owner: "operations" },
];

export function summarizeStagingDeployment(checks: StagingDeploymentCheck[] = stagingDeploymentChecks) {
  const blocked = checks.filter((check) => check.required && check.status === "blocked").length;
  const notChecked = checks.filter((check) => check.required && check.status === "not_checked").length;
  const ready = checks.filter((check) => check.status === "ready").length;

  return {
    status: blocked > 0 ? "blocked" : notChecked > 0 ? "warning" : "ready",
    blocked,
    notChecked,
    ready,
    checkCount: checks.length,
  };
}
