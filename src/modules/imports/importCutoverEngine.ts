import type { ImportMappingProfile } from "./importMappingProfiles";
import type { ImportStagingFile } from "./importStagingTypes";

export type ImportCutoverStatus =
  | "draft"
  | "ready"
  | "posted"
  | "failed"
  | "cancelled";

export type ImportCutoverRollbackStatus = "none" | "requested" | "applied" | "rejected";

export interface ImportCutoverBatch {
  id: string;
  stagingFileId: string;
  mappingProfileId: string;
  branchId: string;
  businessDate: string;
  fileHash: string;
  sourceType: string;
  status: ImportCutoverStatus;
  rollbackStatus: ImportCutoverRollbackStatus;
  rowCount: number;
  criticalRowCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface ImportCutoverBatchRow {
  id: string;
  cutoverBatchId: string;
  stagingRowId: string;
  rowNumber: number;
  status: "pending" | "posted" | "skipped" | "error";
  message?: string;
}

export interface ImportCutoverReadinessSummary {
  ok: boolean;
  message: string;
  findings: string[];
  criticalCount: number;
  warningCount: number;
}

/** Duplicate detection key: hash + source type + branch + business date (align with import_file_hash_locks). */
export function buildImportDuplicateKey(parts: {
  fileHash: string;
  sourceType: string;
  branchId: string;
  businessDate: string;
}): string {
  return `${parts.fileHash}|${parts.sourceType}|${parts.branchId}|${parts.businessDate}`;
}

export function validateImportCutoverReadiness(input: {
  file: ImportStagingFile;
  mappingProfile: ImportMappingProfile | null | undefined;
  criticalRowErrors: number;
  warningRowErrors?: number;
  fileHash?: string;
  branchId?: string;
  businessDate?: string;
}): ImportCutoverReadinessSummary {
  const findings: string[] = [];
  let criticalCount = 0;
  let warningCount = 0;

  if (!input.mappingProfile) {
    findings.push("Mapping profile is required before validation or cutover.");
    criticalCount += 1;
  }

  if (input.criticalRowErrors > 0) {
    findings.push(
      `Rows with critical validation errors cannot be cut over (${input.criticalRowErrors} row(s)).`,
    );
    criticalCount += 1;
  }

  if (input.warningRowErrors && input.warningRowErrors > 0) {
    findings.push(`${input.warningRowErrors} row(s) have warnings; review before posting.`);
    warningCount += 1;
  }

  if (input.file.status === "posted") {
    findings.push("Posted imports cannot be edited.");
    criticalCount += 1;
  } else if (input.file.status !== "approved") {
    findings.push("Approved imports can be posted/cut over; current file is not approved.");
    criticalCount += 1;
  }

  if (!input.fileHash?.trim() || !input.branchId?.trim() || !input.businessDate?.trim()) {
    findings.push(
      "Duplicate import detection requires file hash, source type, branch id, and business date (hash lock design).",
    );
    warningCount += 1;
  }

  const ok = criticalCount === 0;

  return {
    ok,
    message: ok ? "Ready for cutover preview." : "Cutover blocked until findings are resolved.",
    findings,
    criticalCount,
    warningCount,
  };
}

export interface ImportCutoverPreview {
  batch: Omit<ImportCutoverBatch, "id" | "createdAt" | "updatedAt">;
  sampleRows: ImportCutoverBatchRow[];
}

export function createImportCutoverPreview(input: {
  stagingFileId: string;
  profile: ImportMappingProfile;
  branchId: string;
  businessDate: string;
  fileHash: string;
  sourceType: string;
  rowCount: number;
  criticalRowCount: number;
}): ImportCutoverPreview {
  const batch: Omit<ImportCutoverBatch, "id" | "createdAt" | "updatedAt"> = {
    stagingFileId: input.stagingFileId,
    mappingProfileId: input.profile.id,
    branchId: input.branchId,
    businessDate: input.businessDate,
    fileHash: input.fileHash,
    sourceType: input.sourceType,
    status: "draft",
    rollbackStatus: "none",
    rowCount: input.rowCount,
    criticalRowCount: input.criticalRowCount,
  };

  return {
    batch,
    sampleRows: [],
  };
}
