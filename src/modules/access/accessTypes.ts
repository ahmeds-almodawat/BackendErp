export interface EnterpriseUser {
  id: string;
  email: string;
  displayName: string;
  isActive: boolean;
  roleKeys: string[];
  branchIds: string[];
  permissions: string[];
}

export interface RoleDefinition {
  key: string;
  name: string;
  description: string;
  permissionKeys: string[];
  isSystemRole: boolean;
}

export interface PermissionCheckInput {
  user: EnterpriseUser | null;
  permissionKey: string;
  branchId?: string;
}

export interface PermissionCheckResult {
  allowed: boolean;
  reason?: string;
}

export function checkPermission(input: PermissionCheckInput): PermissionCheckResult {
  const { user, permissionKey, branchId } = input;

  if (!user) {
    return {
      allowed: false,
      reason: "User is not signed in.",
    };
  }

  if (!user.isActive) {
    return {
      allowed: false,
      reason: "User is inactive.",
    };
  }

  if (!user.permissions.includes(permissionKey)) {
    return {
      allowed: false,
      reason: `Missing permission: ${permissionKey}`,
    };
  }

  if (branchId && user.branchIds.length > 0 && !user.branchIds.includes(branchId)) {
    return {
      allowed: false,
      reason: "User is not assigned to this branch.",
    };
  }

  return {
    allowed: true,
  };
}
