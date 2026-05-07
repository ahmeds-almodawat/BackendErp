export type PermissionRiskLevel = "low" | "medium" | "high" | "critical";

export interface PermissionDefinition {
  key: string;
  module: string;
  label: string;
  description: string;
  riskLevel: PermissionRiskLevel;
  productionRequired?: boolean;
}

export const permissionRegistry: PermissionDefinition[] = [
  {
    key: "users.manage",
    module: "access",
    label: "Manage users",
    description: "Create, update, deactivate, and assign users.",
    riskLevel: "critical",
    productionRequired: true,
  },
  {
    key: "roles.manage",
    module: "access",
    label: "Manage roles",
    description: "Create roles and assign permissions.",
    riskLevel: "critical",
    productionRequired: true,
  },
  {
    key: "branches.manage",
    module: "branches",
    label: "Manage branches",
    description: "Create and maintain branches and branch assignments.",
    riskLevel: "high",
    productionRequired: true,
  },
  {
    key: "setup.manage",
    module: "setup",
    label: "Manage setup",
    description: "Maintain master data such as items, categories, accounts, suppliers, and stores.",
    riskLevel: "high",
    productionRequired: true,
  },
  {
    key: "finance.view",
    module: "finance",
    label: "View finance",
    description: "View finance records and finance reports.",
    riskLevel: "high",
    productionRequired: true,
  },
  {
    key: "finance.post",
    module: "finance",
    label: "Post finance transactions",
    description: "Post journals, invoices, payments, openings, reconciliations, and adjustments.",
    riskLevel: "critical",
    productionRequired: true,
  },
  {
    key: "finance.reverse",
    module: "finance",
    label: "Reverse posted finance transactions",
    description: "Reverse official posted accounting batches.",
    riskLevel: "critical",
    productionRequired: true,
  },
  {
    key: "inventory.view",
    module: "inventory",
    label: "View inventory",
    description: "View stock, movements, costing, and valuation reports.",
    riskLevel: "medium",
    productionRequired: true,
  },
  {
    key: "inventory.adjust",
    module: "inventory",
    label: "Adjust inventory",
    description: "Create stock adjustments, counts, wastage, and movement corrections.",
    riskLevel: "critical",
    productionRequired: true,
  },
  {
    key: "purchasing.create",
    module: "purchasing",
    label: "Create purchasing records",
    description: "Create suppliers, purchase invoices, and purchase documents.",
    riskLevel: "high",
    productionRequired: true,
  },
  {
    key: "purchasing.approve",
    module: "purchasing",
    label: "Approve purchasing",
    description: "Approve purchase invoices and purchasing workflows.",
    riskLevel: "critical",
    productionRequired: true,
  },
  {
    key: "sales.import",
    module: "sales",
    label: "Import sales/POS reports",
    description: "Import POS/Foodics reports into staging.",
    riskLevel: "high",
    productionRequired: true,
  },
  {
    key: "reports.view",
    module: "analytics",
    label: "View reports",
    description: "View Smart Analysis, report packs, KPIs, and management dashboards.",
    riskLevel: "medium",
    productionRequired: true,
  },
  {
    key: "reports.export",
    module: "analytics",
    label: "Export reports",
    description: "Export CSV/XLSX/PDF reporting outputs.",
    riskLevel: "medium",
    productionRequired: true,
  },
  {
    key: "imports.create",
    module: "imports",
    label: "Create imports",
    description: "Upload and stage CSV/XLSX/PDF import files.",
    riskLevel: "high",
    productionRequired: true,
  },
  {
    key: "imports.approve",
    module: "imports",
    label: "Approve imports",
    description: "Approve import batches before they affect official records.",
    riskLevel: "critical",
    productionRequired: true,
  },
  {
    key: "settings.manage",
    module: "setup",
    label: "Manage settings",
    description: "Change production, branding, finance, and system settings.",
    riskLevel: "critical",
    productionRequired: true,
  },
];

export function getPermission(key: string): PermissionDefinition | undefined {
  return permissionRegistry.find((permission) => permission.key === key);
}

export function getPermissionsByModule(module: string): PermissionDefinition[] {
  return permissionRegistry.filter((permission) => permission.module === module);
}

export function getCriticalPermissions(): PermissionDefinition[] {
  return permissionRegistry.filter((permission) => permission.riskLevel === "critical");
}
