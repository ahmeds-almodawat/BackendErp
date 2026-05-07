export type NavigationRiskLevel = "low" | "medium" | "high" | "critical";

export interface PermissionAwareNavigationItem {
  key: string;
  label: string;
  route: string;
  requiredPermission?: string;
  requiredAnyPermission?: string[];
  module: string;
  riskLevel: NavigationRiskLevel;
  showInSidebar: boolean;
}

export const permissionAwareNavigationItems: PermissionAwareNavigationItem[] = [
  { key: "dashboard", label: "Dashboard", route: "/dashboard", requiredPermission: "reports.view", module: "dashboard", riskLevel: "medium", showInSidebar: true },
  { key: "smart_analysis", label: "Smart Analysis", route: "/smart-analysis", requiredPermission: "reports.view", module: "analytics", riskLevel: "medium", showInSidebar: true },
  { key: "setup", label: "Setup", route: "/setup", requiredPermission: "setup.manage", module: "setup", riskLevel: "high", showInSidebar: true },
  { key: "inventory", label: "Inventory", route: "/inventory", requiredAnyPermission: ["inventory.view", "inventory.adjust"], module: "inventory", riskLevel: "high", showInSidebar: true },
  { key: "purchasing", label: "Purchasing", route: "/purchasing", requiredAnyPermission: ["purchasing.create", "purchasing.approve"], module: "purchasing", riskLevel: "high", showInSidebar: true },
  { key: "sales", label: "Sales/POS", route: "/sales", requiredPermission: "sales.import", module: "sales", riskLevel: "high", showInSidebar: true },
  { key: "production", label: "Production", route: "/production", requiredAnyPermission: ["production.create", "production.post"], module: "production", riskLevel: "high", showInSidebar: true },
  { key: "finance", label: "Finance", route: "/finance", requiredAnyPermission: ["finance.view", "finance.post"], module: "finance", riskLevel: "critical", showInSidebar: true },
  { key: "imports", label: "Imports", route: "/imports", requiredAnyPermission: ["imports.create", "imports.approve"], module: "imports", riskLevel: "critical", showInSidebar: true },
  { key: "admin", label: "Admin", route: "/admin", requiredPermission: "users.manage", module: "access", riskLevel: "critical", showInSidebar: true },
];

export function filterNavigationByPermissions(userPermissionKeys: string[], isAuthenticated: boolean) {
  if (!isAuthenticated) {
    return [];
  }

  return permissionAwareNavigationItems.filter((item) => {
    if (!item.showInSidebar) return false;

    if (item.requiredPermission) {
      return userPermissionKeys.includes(item.requiredPermission);
    }

    if (item.requiredAnyPermission?.length) {
      return item.requiredAnyPermission.some((permission) => userPermissionKeys.includes(permission));
    }

    return true;
  });
}

export function summarizeNavigationCoverage(items: PermissionAwareNavigationItem[] = permissionAwareNavigationItems) {
  return {
    itemCount: items.length,
    criticalCount: items.filter((item) => item.riskLevel === "critical").length,
    protectedCount: items.filter((item) => item.requiredPermission || item.requiredAnyPermission?.length).length,
  };
}
