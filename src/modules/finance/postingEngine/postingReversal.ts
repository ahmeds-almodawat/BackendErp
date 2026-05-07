import { validatePostingBatch } from "./postingValidation";
import type {
  PostingBatch,
  PostingBatchLine,
  PostingReversalPreview,
  PostingReversalRecord,
  PostingReversalRequest,
  PostingValidationContext,
} from "./postingTypes";

function cloneReversalLine(line: PostingBatchLine, index: number): PostingBatchLine {
  return {
    ...line,
    id: crypto.randomUUID(),
    lineNo: index + 1,
    debit: Number(line.credit ?? 0),
    credit: Number(line.debit ?? 0),
    metadata: {
      ...(line.metadata ?? {}),
      reversedFromLineId: line.id,
    },
  };
}

export function createPostingReversalRecord(
  originalBatchId: string,
  reversalBatchId: string,
  request: PostingReversalRequest,
): PostingReversalRecord {
  return {
    originalBatchId,
    reversalBatchId,
    reversalDate: request.reversalDate,
    reversedBy: request.reversedBy,
    reason: request.reason,
    notes: request.notes,
    createdAt: new Date().toISOString(),
  };
}

export function buildPostingReversalBatch(
  originalBatch: PostingBatch,
  request: PostingReversalRequest,
): PostingBatch {
  if (originalBatch.status !== "posted") {
    throw new Error("Only posted batches can be reversed.");
  }

  if (originalBatch.direction === "reversal") {
    throw new Error("Reversal batches cannot be reversed again from the v311 foundation helper.");
  }

  const reversalBatchId = crypto.randomUUID();
  const batchNo = request.reference?.trim() || `${originalBatch.batchNo}-REV`;

  return {
    id: reversalBatchId,
    batchNo,
    sourceType: originalBatch.sourceType,
    sourceDocumentId: originalBatch.sourceDocumentId,
    sourceDocumentNo: originalBatch.sourceDocumentNo,
    sourceModule: originalBatch.sourceModule,
    branchId: originalBatch.branchId,
    fiscalPeriodId: originalBatch.fiscalPeriodId,
    postingDate: request.reversalDate,
    status: "draft",
    direction: "reversal",
    reversalOfBatchId: originalBatch.id,
    currencyCode: originalBatch.currencyCode,
    description:
      request.notes?.trim() ||
      `Reversal of ${originalBatch.batchNo}: ${request.reason}`,
    lines: originalBatch.lines.map((line, index) => cloneReversalLine(line, index)),
    metadata: {
      ...(originalBatch.metadata ?? {}),
      reversalReason: request.reason,
      reversedBy: request.reversedBy,
      reversedFromBatchId: originalBatch.id,
      reversedFromBatchNo: originalBatch.batchNo,
    },
  };
}

export function preparePostingReversal(
  originalBatch: PostingBatch,
  request: PostingReversalRequest,
  context: Omit<PostingValidationContext, "persistedBatch" | "intent"> = {},
): PostingReversalPreview {
  const batch = buildPostingReversalBatch(originalBatch, request);
  const reversal = createPostingReversalRecord(originalBatch.id, batch.id, request);
  const validation = validatePostingBatch(batch, {
    ...context,
    intent: "reverse",
  });

  return {
    batch,
    reversal,
    validation,
  };
}
