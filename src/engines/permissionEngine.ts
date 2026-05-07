export type ScopeType = 'all' | 'branch' | 'store' | 'cost_center';
export type UserRoleScope = { permissionKeys: string[]; scopeType: ScopeType; scopeId: string };
export type ActionScope = { branchId?: string; storeId?: string; costCenterId?: string };

export function scopeAllows(userScope: UserRoleScope, actionScope?: ActionScope): boolean {
  if (userScope.scopeType === 'all' || userScope.scopeId === 'all') return true;
  if (userScope.scopeType === 'branch') return userScope.scopeId === actionScope?.branchId;
  if (userScope.scopeType === 'store') return userScope.scopeId === actionScope?.storeId;
  if (userScope.scopeType === 'cost_center') return userScope.scopeId === actionScope?.costCenterId;
  return false;
}

export function canDo(scopes: UserRoleScope[], permissionKey: string, actionScope?: ActionScope): boolean {
  return scopes.some((scope) => scope.permissionKeys.includes(permissionKey) && scopeAllows(scope, actionScope));
}
