export type BranchStatus = "active" | "inactive" | "archived";

export interface BranchDefinition {
  id: string;
  code: string;
  nameEn: string;
  nameAr: string;
  status: BranchStatus;
  isHeadOffice?: boolean;
}

export interface BranchAssignment {
  userId: string;
  branchId: string;
  canView: boolean;
  canCreate: boolean;
  canApprove: boolean;
  canPost: boolean;
}

export function canAccessBranch(assignments: BranchAssignment[], userId: string, branchId: string): boolean {
  return assignments.some((assignment) => {
    return assignment.userId === userId && assignment.branchId === branchId && assignment.canView;
  });
}

export function getUserBranchIds(assignments: BranchAssignment[], userId: string): string[] {
  return assignments
    .filter((assignment) => assignment.userId === userId && assignment.canView)
    .map((assignment) => assignment.branchId);
}
