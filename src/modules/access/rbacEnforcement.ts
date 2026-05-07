import { permissionRegistry } from "./permissionRegistry";

export interface RoutePermissionRule {
  routeKey: string;
  label: string;
  requiredPermission?: string;
  requiredAnyPermission?: string[];
  requiresAuth: boolean;
  riskLevel: "low" | "medium" | "high" | "critical";
}

export const enterpriseRoutePermissionRules: RoutePermissionRule[] = [
  { routeKey: "dashboard", label: "Dashboard", requiresAuth: true, requiredPermission: "reports.view", riskLevel: "medium" },
  { routeKey: "smart-analysis", label: "Smart Analysis", requiresAuth: true, requiredPermission: "reports.view", riskLevel: "medium" },
  { routeKey: "setup", label: "Setup", requiresAuth: true, requiredPermission: "setup.manage", riskLevel: "high" },
  { routeKey: "finance", label: "Finance", requiresAuth: true, requiredAnyPermission: ["finance.view", "finance.post"], riskLevel: "critical" },
  { routeKey: "inventory", label: "Inventory", requiresAuth: true, requiredAnyPermission: ["inventory.view", "inventory.adjust"], riskLevel: "high" },
  { routeKey: "purchasing", label: "Purchasing", requiresAuth: true, requiredAnyPermission: ["purchasing.create", "purchasing.approve"], riskLevel: "high" },
  { routeKey: "sales", label: "Sales/POS", requiresAuth: true, requiredPermission: "sales.import", riskLevel: "high" },
  { routeKey: "imports", label: "Imports", requiresAuth: true, requiredAnyPermission: ["imports.create", "imports.approve"], riskLevel: "critical" },
  { routeKey: "settings", label: "Settings", requiresAuth: true, requiredPermission: "settings.manage", riskLevel: "critical" },
];

export interface PermissionEvaluationInput {
  userPermissionKeys: string[];
  routeKey: string;
  isAuthenticated: boolean;
}

export interface PermissionEvaluationResult {
  allowed: boolean;
  reason: string;
  missingPermissions: string[];
}

export function evaluateRoutePermission(input: PermissionEvaluationInput): PermissionEvaluationResult {
  const rule = enterpriseRoutePermissionRules.find((candidate) => candidate.routeKey === input.routeKey);

  if (!rule) {
    return {
      allowed: true,
      reason: "No route rule defined; default allow for legacy compatibility.",
      missingPermissions: [],
    };
  }

  if (rule.requiresAuth && !input.isAuthenticated) {
    return {
      allowed: false,
      reason: "Authentication is required.",
      missingPermissions: [],
    };
  }

  if (rule.requiredPermission && !input.userPermissionKeys.includes(rule.requiredPermission)) {
    return {
      allowed: false,
      reason: `Missing required permission: ${rule.requiredPermission}`,
      missingPermissions: [rule.requiredPermission],
    };
  }

  if (rule.requiredAnyPermission?.length) {
    const hasAny = rule.requiredAnyPermission.some((permission) => input.userPermissionKeys.includes(permission));

    if (!hasAny) {
      return {
        allowed: false,
        reason: `Missing one of required permissions: ${rule.requiredAnyPermission.join(", ")}`,
        missingPermissions: rule.requiredAnyPermission,
      };
    }
  }

  return {
    allowed: true,
    reason: "Route permission allowed.",
    missingPermissions: [],
  };
}

export function listCriticalPermissionKeys(): string[] {
  return permissionRegistry
    .filter((permission) => permission.riskLevel === "critical")
    .map((permission) => permission.key);
}
