import type { ReactNode } from "react";
import { checkPermission, type EnterpriseUser } from "../modules/access/accessTypes";

export interface PermissionGateProps {
  user: EnterpriseUser | null;
  permission: string;
  branchId?: string;
  fallback?: ReactNode;
  children: ReactNode;
}

export function PermissionGate(props: PermissionGateProps) {
  const { user, permission, branchId, fallback = null, children } = props;
  const result = checkPermission({ user, permissionKey: permission, branchId });

  if (!result.allowed) {
    return <>{fallback}</>;
  }

  return <>{children}</>;
}
