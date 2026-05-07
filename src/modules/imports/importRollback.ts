import type { ImportCutoverBatch } from "./importCutoverEngine";
import type { ImportStageStatus } from "./importStagingTypes";

export interface ImportRollbackRequest {
  rollbackRequestId?: string;
  cutoverBatchId: string;
  reason: string;
  requestedBy?: string;
  requestedAt?: string;
}

export interface ImportRollbackResult {
  ok: boolean;
  message: string;
  cutoverBatchId: string;
  rollbackRequestId?: string;
}

export function validateRollbackRequest(
  batch: ImportCutoverBatch | null | undefined,
  reason: string,
  options?: { stagingFileStatus?: ImportStageStatus },
): ImportRollbackResult {
  if (!batch) {
    return { ok: false, message: "Cutover batch not found.", cutoverBatchId: "" };
  }
  if (!reason?.trim()) {
    return { ok: false, message: "Rollback must include a reason.", cutoverBatchId: batch.id };
  }

  const st = options?.stagingFileStatus;
  if (st === "rolled_back" || st === "cancelled") {
    return {
      ok: false,
      message: "Cancelled or rolled_back staging imports cannot be rolled back again.",
      cutoverBatchId: batch.id,
    };
  }

  if (batch.status === "cancelled") {
    return {
      ok: false,
      message: "Cancelled cutover batches cannot be rolled back.",
      cutoverBatchId: batch.id,
    };
  }

  if (batch.status !== "posted") {
    return {
      ok: false,
      message: "Only posted cutover batches can request rollback.",
      cutoverBatchId: batch.id,
    };
  }

  if (batch.rollbackStatus === "applied") {
    return {
      ok: false,
      message: "Rollback was already applied; use correction/reversal records, not silent delete.",
      cutoverBatchId: batch.id,
    };
  }

  if (batch.rollbackStatus === "requested") {
    return {
      ok: false,
      message: "A rollback is already in progress for this cutover batch.",
      cutoverBatchId: batch.id,
    };
  }

  return {
    ok: true,
    message:
      "Rollback request is valid. Backend should create correction/reversal postings, not delete posted rows silently.",
    cutoverBatchId: batch.id,
  };
}

export function createRollbackRequest(
  batch: ImportCutoverBatch,
  reason: string,
  requestedBy?: string,
  options?: { stagingFileStatus?: ImportStageStatus },
): ImportRollbackRequest & { validation: ImportRollbackResult } {
  const validation = validateRollbackRequest(batch, reason, options);
  const requestedAt = new Date().toISOString();
  const rollbackRequestId = validation.ok ? crypto.randomUUID() : undefined;
  return {
    rollbackRequestId,
    cutoverBatchId: batch.id,
    reason: reason.trim(),
    requestedBy,
    requestedAt,
    validation: validation.ok
      ? { ...validation, rollbackRequestId }
      : validation,
  };
}
