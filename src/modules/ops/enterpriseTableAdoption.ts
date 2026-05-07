export type EnterpriseTableAdoptionStatus = "not_started" | "planned" | "in_progress" | "done" | "blocked";

export interface EnterpriseTableAdoptionTask {
  key: string;
  screen: string;
  module: string;
  estimatedRows: number;
  needsServerPagination: boolean;
  needsExport: boolean;
  status: EnterpriseTableAdoptionStatus;
}

export const enterpriseTableAdoptionTasks: EnterpriseTableAdoptionTask[] = [
  { key: "items_table", screen: "Items", module: "setup", estimatedRows: 5000, needsServerPagination: true, needsExport: true, status: "planned" },
  { key: "suppliers_table", screen: "Suppliers", module: "setup", estimatedRows: 1000, needsServerPagination: true, needsExport: true, status: "planned" },
  { key: "inventory_movements", screen: "Inventory Movements", module: "inventory", estimatedRows: 100000, needsServerPagination: true, needsExport: true, status: "planned" },
  { key: "purchase_invoices", screen: "Purchase Invoices", module: "purchasing", estimatedRows: 50000, needsServerPagination: true, needsExport: true, status: "planned" },
  { key: "sales_batches", screen: "Sales/POS Batches", module: "sales", estimatedRows: 50000, needsServerPagination: true, needsExport: true, status: "planned" },
  { key: "journal_entries", screen: "Journal Entries", module: "finance", estimatedRows: 100000, needsServerPagination: true, needsExport: true, status: "planned" },
];

export function summarizeEnterpriseTableAdoption(tasks: EnterpriseTableAdoptionTask[] = enterpriseTableAdoptionTasks) {
  const serverPaginationRequired = tasks.filter((task) => task.needsServerPagination).length;
  const exportRequired = tasks.filter((task) => task.needsExport).length;
  const done = tasks.filter((task) => task.status === "done").length;

  return {
    taskCount: tasks.length,
    serverPaginationRequired,
    exportRequired,
    done,
    status: done === tasks.length ? "ready" : "planned",
  };
}
