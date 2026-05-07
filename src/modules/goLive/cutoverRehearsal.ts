export type CutoverRehearsalStatus = "planned" | "running" | "passed" | "failed" | "blocked";

export interface CutoverRehearsalStep {
  key: string;
  title: string;
  module: string;
  expectedMinutes: number;
  status: CutoverRehearsalStatus;
  required: boolean;
}

export const cutoverRehearsalSteps: CutoverRehearsalStep[] = [
  { key: "backup_restore", title: "Backup and restore test", module: "ops", expectedMinutes: 60, status: "planned", required: true },
  { key: "apply_migrations", title: "Apply migrations to staging", module: "database", expectedMinutes: 30, status: "planned", required: true },
  { key: "load_seed_data", title: "Load UAT seed data", module: "uat", expectedMinutes: 45, status: "planned", required: true },
  { key: "post_opening_balances", title: "Post opening balances", module: "finance", expectedMinutes: 30, status: "planned", required: true },
  { key: "post_opening_stock", title: "Post opening stock", module: "inventory", expectedMinutes: 45, status: "planned", required: true },
  { key: "run_uat_scenarios", title: "Run UAT scenarios", module: "uat", expectedMinutes: 180, status: "planned", required: true },
  { key: "close_first_period", title: "Close test period", module: "finance", expectedMinutes: 60, status: "planned", required: true },
];

export function summarizeCutoverRehearsal(steps: CutoverRehearsalStep[] = cutoverRehearsalSteps) {
  const failed = steps.filter((step) => step.status === "failed").length;
  const blocked = steps.filter((step) => step.status === "blocked").length;
  const passed = steps.filter((step) => step.status === "passed").length;
  const planned = steps.filter((step) => step.status === "planned").length;
  const expectedMinutes = steps.reduce((sum, step) => sum + step.expectedMinutes, 0);

  return {
    status: failed > 0 || blocked > 0 ? "blocked" : planned > 0 ? "warning" : "ready",
    failed,
    blocked,
    passed,
    planned,
    expectedMinutes,
    total: steps.length,
  };
}
