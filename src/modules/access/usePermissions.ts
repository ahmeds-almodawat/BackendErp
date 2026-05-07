import { checkPermission, type EnterpriseUser, type PermissionCheckResult } from "./accessTypes";

export interface UsePermissionsResult {
  can: (permissionKey: string, branchId?: string) => boolean;
  explain: (permissionKey: string, branchId?: string) => PermissionCheckResult;
}

export function createPermissionHelpers(user: EnterpriseUser | null): UsePermissionsResult {
  return {
    can(permissionKey: string, branchId?: string): boolean {
      return checkPermission({ user, permissionKey, branchId }).allowed;
    },

    explain(permissionKey: string, branchId?: string): PermissionCheckResult {
      return checkPermission({ user, permissionKey, branchId });
    },
  };
}
