import type { ImportStagingFile } from "./importStagingTypes";

export type ImportApprovalDecision = "approve" | "reject";

export interface ImportApprovalRequest {
  fileId: string;
  decision: ImportApprovalDecision;
  approvedBy?: string;
  notes?: string;
}

export interface ImportApprovalResult {
  ok: boolean;
  message: string;
  fileId: string;
  status?: ImportStagingFile["status"];
  approvedBy?: string;
  approvedAt?: string;
}

/** Returns true when the file may transition to approved (subject to permission checks server-side). */
export function canApproveImport(
  file: ImportStagingFile,
  options?: { criticalValidationErrorCount?: number },
): boolean {
  const critical = options?.criticalValidationErrorCount ?? 0;
  if (critical > 0) return false;
  if (file.status !== "validated") return false;
  if (file.errorRows > 0) return false;
  return true;
}

function assertNotImmutable(file: ImportStagingFile): string | null {
  if (file.status === "approved" || file.status === "posted") {
    return "Approved or posted imports cannot be edited.";
  }
  if (file.status === "rolled_back" || file.status === "cancelled") {
    return "Rolled back or cancelled imports cannot be approved.";
  }
  return null;
}

/**
 * Pure approval transition (no I/O). Caller merges into persisted record.
 * Requires validated status, zero blocking rows, no critical validation errors, approver identity and timestamp.
 */
export function approveImport(
  file: ImportStagingFile,
  approvedBy: string,
  approvedAt: string,
  options?: { criticalValidationErrorCount?: number },
): ImportApprovalResult {
  const immutable = assertNotImmutable(file);
  if (immutable) {
    return { ok: false, message: immutable, fileId: file.id };
  }
  if (!canApproveImport(file, options)) {
    return {
      ok: false,
      message: "Only validated imports without errors or critical validation findings can be approved.",
      fileId: file.id,
    };
  }
  if (!approvedBy?.trim()) {
    return { ok: false, message: "approval requires approvedBy", fileId: file.id };
  }
  if (!approvedAt?.trim()) {
    return { ok: false, message: "approval requires approvedAt", fileId: file.id };
  }
  return {
    ok: true,
    message: "Import approved for cutover.",
    fileId: file.id,
    status: "approved",
    approvedBy: approvedBy.trim(),
    approvedAt: approvedAt.trim(),
  };
}

export function rejectImport(
  file: ImportStagingFile,
  approvedBy: string,
  approvedAt: string,
  _notes?: string,
): ImportApprovalResult {
  const immutable = assertNotImmutable(file);
  if (immutable) {
    return { ok: false, message: immutable, fileId: file.id };
  }
  if (file.status !== "validated" && file.status !== "has_errors" && file.status !== "mapped") {
    return {
      ok: false,
      message: "Reject is only allowed while the import is still being reviewed (mapped / validated / has_errors).",
      fileId: file.id,
    };
  }
  if (!approvedBy?.trim() || !approvedAt?.trim()) {
    return { ok: false, message: "reject requires approvedBy and approvedAt", fileId: file.id };
  }
  return {
    ok: true,
    message: "Import rejected.",
    fileId: file.id,
    status: "cancelled",
    approvedBy: approvedBy.trim(),
    approvedAt: approvedAt.trim(),
  };
}
