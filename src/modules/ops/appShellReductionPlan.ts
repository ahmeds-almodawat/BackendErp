export type AppShellRefactorRisk = "low" | "medium" | "high" | "critical";
export type AppShellRefactorStatus = "planned" | "in_progress" | "done" | "blocked";

export interface AppShellRefactorTask {
  key: string;
  title: string;
  targetFolder: string;
  risk: AppShellRefactorRisk;
  status: AppShellRefactorStatus;
  reason: string;
}

export const appShellReductionTasks: AppShellRefactorTask[] = [
  {
    key: "move_dashboard_state",
    title: "Move dashboard local state into dashboard module",
    targetFolder: "src/modules/dashboard",
    risk: "medium",
    status: "planned",
    reason: "AppShell should own layout/routing only, not dashboard data logic.",
  },
  {
    key: "move_setup_state",
    title: "Move setup state into setup module",
    targetFolder: "src/modules/setup",
    risk: "medium",
    status: "planned",
    reason: "Master data cutover services should own setup behavior.",
  },
  {
    key: "move_finance_state",
    title: "Move finance state into finance module",
    targetFolder: "src/modules/finance",
    risk: "high",
    status: "planned",
    reason: "Finance screens must use GL/posting services instead of global shell state.",
  },
  {
    key: "move_inventory_state",
    title: "Move inventory state into inventory module",
    targetFolder: "src/modules/inventory",
    risk: "high",
    status: "planned",
    reason: "Inventory must use stock ledger services for live mode.",
  },
  {
    key: "move_import_state",
    title: "Move import state into imports module",
    targetFolder: "src/modules/imports",
    risk: "medium",
    status: "planned",
    reason: "Import validation/cutover should remain isolated from AppShell.",
  },
];

export function summarizeAppShellReduction(tasks: AppShellRefactorTask[] = appShellReductionTasks) {
  const done = tasks.filter((task) => task.status === "done").length;
  const blocked = tasks.filter((task) => task.status === "blocked").length;
  const highRisk = tasks.filter((task) => task.risk === "high" || task.risk === "critical").length;

  return {
    taskCount: tasks.length,
    done,
    blocked,
    highRisk,
    status: blocked > 0 ? "blocked" : done === tasks.length ? "ready" : "planned",
  };
}
