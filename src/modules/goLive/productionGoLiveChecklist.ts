export type GoLiveChecklistStatus = "not_checked" | "ready" | "warning" | "blocked";

export interface GoLiveChecklistItem {
  key: string;
  section: string;
  label: string;
  status: GoLiveChecklistStatus;
  required: boolean;
}

export const productionGoLiveChecklist: GoLiveChecklistItem[] = [
  { key: "production_backup", section: "Backup", label: "Production backup plan approved", status: "not_checked", required: true },
  { key: "restore_test", section: "Backup", label: "Restore tested on staging", status: "not_checked", required: true },
  { key: "admin_users", section: "Access", label: "Admin users confirmed", status: "not_checked", required: true },
  { key: "roles_assigned", section: "Access", label: "Roles and branch assignments confirmed", status: "not_checked", required: true },
  { key: "opening_balances", section: "Finance", label: "Opening balances posted and reconciled", status: "not_checked", required: true },
  { key: "opening_stock", section: "Inventory", label: "Opening stock posted and reconciled", status: "not_checked", required: true },
  { key: "first_period_open", section: "Finance", label: "First fiscal period opened", status: "not_checked", required: true },
  { key: "support_process", section: "Support", label: "Support escalation process ready", status: "not_checked", required: true },
];

export function summarizeGoLiveChecklist(items: GoLiveChecklistItem[] = productionGoLiveChecklist) {
  const blocked = items.filter((item) => item.required && item.status === "blocked").length;
  const notChecked = items.filter((item) => item.required && item.status === "not_checked").length;
  const ready = items.filter((item) => item.status === "ready").length;

  return {
    status: blocked > 0 ? "blocked" : notChecked > 0 ? "warning" : "ready",
    blocked,
    notChecked,
    ready,
    itemCount: items.length,
  };
}
