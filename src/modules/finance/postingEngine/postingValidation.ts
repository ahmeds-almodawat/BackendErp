import { assertCanPostToPeriod } from "../fiscalPeriods";
import { isPostingImmutable } from "../postingStatus";
import { getPostingContract } from "./postingContracts";
import type {
  PostingBatchInput,
  PostingBatchLineInput,
  PostingDuplicateCandidate,
  PostingSourceLock,
  PostingValidationContext,
  PostingValidationFinding,
  PostingValidationSummary,
  PostingValidationTotals,
} from "./postingTypes";

const BALANCE_TOLERANCE = 0.01;

function asLines(lines: PostingBatchInput["lines"]): PostingBatchLineInput[] {
  return Array.isArray(lines) ? lines : [];
}

function amount(value: number | undefined): number {
  return Number(value ?? 0);
}

function text(value: string | undefined): string {
  return value?.trim() ?? "";
}

function isMissing(value: string | undefined): boolean {
  return text(value).length === 0;
}

function addFinding(
  findings: PostingValidationFinding[],
  finding: PostingValidationFinding,
): void {
  findings.push(finding);
}

function summarizeLines(lines: PostingBatchLineInput[]): PostingValidationTotals {
  const debit = lines.reduce((sum, line) => sum + amount(line.debit), 0);
  const credit = lines.reduce((sum, line) => sum + amount(line.credit), 0);

  return {
    debit,
    credit,
    imbalance: debit - credit,
    lineCount: lines.length,
  };
}

function isPostingIntent(context: PostingValidationContext, batch: PostingBatchInput): boolean {
  return (
    context.intent === "post" ||
    context.intent === "reverse" ||
    batch.status === "approved" ||
    batch.status === "posted"
  );
}

function isReversal(batch: PostingBatchInput, context: PostingValidationContext): boolean {
  return batch.direction === "reversal" || context.intent === "reverse";
}

function findDuplicateSourceDocument(
  batch: PostingBatchInput,
  duplicates: PostingDuplicateCandidate[],
): PostingDuplicateCandidate[] {
  if (!batch.sourceType || isMissing(batch.sourceDocumentId) || isMissing(batch.branchId)) {
    return [];
  }

  return duplicates.filter((candidate) => {
    if (candidate.id === batch.id) return false;
    if ((candidate.direction ?? "normal") === "reversal") return false;
    if (candidate.status === "cancelled" || candidate.status === "voided") return false;

    return (
      candidate.sourceType === batch.sourceType &&
      candidate.sourceDocumentId === text(batch.sourceDocumentId) &&
      candidate.branchId === text(batch.branchId)
    );
  });
}

function hasSourceLock(
  batch: PostingBatchInput,
  sourceLocks: PostingSourceLock[],
): boolean {
  if (!batch.sourceType || isMissing(batch.sourceDocumentId) || isMissing(batch.branchId)) {
    return false;
  }

  return sourceLocks.some((lock) => {
    return (
      lock.sourceType === batch.sourceType &&
      lock.sourceDocumentId === text(batch.sourceDocumentId) &&
      lock.branchId === text(batch.branchId) &&
      (!lock.batchId || lock.batchId === batch.id)
    );
  });
}

export function summarizePostingLines(
  lines: PostingBatchInput["lines"],
): PostingValidationTotals {
  return summarizeLines(asLines(lines));
}

export function validatePostingBatch(
  batch: PostingBatchInput,
  context: PostingValidationContext = {},
): PostingValidationSummary {
  const findings: PostingValidationFinding[] = [];
  const lines = asLines(batch.lines);
  const totals = summarizeLines(lines);
  const contract = getPostingContract(batch.sourceType);
  const postingIntent = isPostingIntent(context, batch);
  const reversal = isReversal(batch, context);

  if (!batch.sourceType) {
    addFinding(findings, {
      severity: "critical",
      code: "SOURCE_TYPE_REQUIRED",
      field: "sourceType",
      message: "Posting batch must have a source type.",
      action: "Set one of the supported posting contracts before validation or posting.",
    });
  }

  if (isMissing(batch.branchId)) {
    addFinding(findings, {
      severity: "critical",
      code: "BRANCH_REQUIRED",
      field: "branchId",
      message: "Posting batch must have a branch id.",
      action: "Resolve the transaction to a branch before posting.",
    });
  }

  if (isMissing(batch.fiscalPeriodId)) {
    addFinding(findings, {
      severity: "critical",
      code: "FISCAL_PERIOD_REQUIRED",
      field: "fiscalPeriodId",
      message: "Posting batch must have a fiscal period id.",
      action: "Map the posting date to an open fiscal period before posting.",
    });
  }

  if (lines.length === 0) {
    addFinding(findings, {
      severity: "critical",
      code: "LINES_REQUIRED",
      field: "lines",
      message: "Posting batch must include at least one debit line and one credit line.",
      action: "Add balanced ledger lines before posting.",
    });
  }

  const invalidLineCount = lines.filter((line) => {
    const debit = amount(line.debit);
    const credit = amount(line.credit);
    return debit < 0 || credit < 0 || (debit === 0 && credit === 0) || (debit > 0 && credit > 0);
  }).length;

  if (invalidLineCount > 0) {
    addFinding(findings, {
      severity: "critical",
      code: "LINE_AMOUNT_INVALID",
      field: "lines",
      message: `${invalidLineCount} posting line(s) use invalid amounts. Each line must carry one positive debit or one positive credit.`,
      action: "Correct the line amounts before posting.",
      metadata: { invalidLineCount },
    });
  }

  const missingAccountCount = lines.filter((line) => isMissing(line.accountCode)).length;
  if (missingAccountCount > 0) {
    addFinding(findings, {
      severity: "critical",
      code: "ACCOUNT_CODE_REQUIRED",
      field: "lines.accountCode",
      message: `${missingAccountCount} posting line(s) are missing an account code.`,
      action: "Assign every posting line to a valid ledger account.",
      metadata: { missingAccountCount },
    });
  }

  if (Math.abs(totals.imbalance) > BALANCE_TOLERANCE) {
    addFinding(findings, {
      severity: "critical",
      code: "BATCH_NOT_BALANCED",
      field: "lines",
      message: `Debit ${totals.debit.toFixed(2)} does not equal credit ${totals.credit.toFixed(2)}.`,
      action: "Balance the posting batch before approval or posting.",
      metadata: { imbalance: Number(totals.imbalance.toFixed(4)) },
    });
  }

  if (context.persistedBatch && isPostingImmutable(context.persistedBatch.status) && !reversal) {
    addFinding(findings, {
      severity: "critical",
      code: "POSTED_BATCH_IMMUTABLE",
      field: "status",
      message: `Posted batches are immutable once the persisted status is ${context.persistedBatch.status}.`,
      action: "Create a reversal batch instead of editing the original posting.",
      metadata: { persistedStatus: context.persistedBatch.status },
    });
  }

  if (postingIntent) {
    const periodFindings = assertCanPostToPeriod(context.fiscalPeriod);
    periodFindings.forEach((message) => {
      addFinding(findings, {
        severity: "critical",
        code: "PERIOD_BLOCKED",
        field: "fiscalPeriodId",
        message,
        action: "Post only into an open fiscal period.",
      });
    });
  }

  if (reversal) {
    if (isMissing(batch.reversalOfBatchId)) {
      addFinding(findings, {
        severity: "critical",
        code: "REVERSAL_REFERENCE_REQUIRED",
        field: "reversalOfBatchId",
        message: "Reversal posting must reference the original posting batch.",
        action: "Store the original batch id before generating or posting a reversal.",
      });
    }

    if (batch.id && batch.reversalOfBatchId === batch.id) {
      addFinding(findings, {
        severity: "critical",
        code: "REVERSAL_SELF_REFERENCE",
        field: "reversalOfBatchId",
        message: "Reversal posting cannot reference itself as the original batch.",
        action: "Reference the original posted batch instead.",
      });
    }
  }

  if (!reversal) {
    const duplicateCandidates = findDuplicateSourceDocument(
      batch,
      context.duplicateCandidates ?? [],
    );

    if (duplicateCandidates.length > 0) {
      addFinding(findings, {
        severity: "critical",
        code: "DUPLICATE_SOURCE_DOCUMENT",
        field: "sourceDocumentId",
        message: `Duplicate source document detected for ${text(batch.sourceDocumentId)} in branch ${text(batch.branchId)}.`,
        action: "Block posting and review existing batch locks or prior postings.",
        metadata: {
          duplicateBatchIds: duplicateCandidates.map((candidate) => candidate.id),
          duplicateBatchRefs: duplicateCandidates.map((candidate) => candidate.batchNo),
        },
      });
    } else if (batch.sourceType) {
      if (isMissing(batch.sourceDocumentId)) {
        addFinding(findings, {
          severity: "warning",
          code: "SOURCE_DOCUMENT_ID_RECOMMENDED",
          field: "sourceDocumentId",
          message:
            "Duplicate source document prevention is designed through source document locking, but this batch has no source document id.",
          action: "Populate the source document id before moving beyond draft.",
        });
      } else if (!hasSourceLock(batch, context.sourceLocks ?? [])) {
        addFinding(findings, {
          severity: "warning",
          code: "SOURCE_LOCK_RECOMMENDED",
          field: "sourceDocumentId",
          message:
            "Duplicate source document prevention is designed, but no matching posting source lock was supplied to validation.",
          action: "Call finance_lock_posting_source before final posting or persist the lock result in the posting workflow.",
        });
      }
    }
  }

  if (contract) {
    const missingRequiredHeaderFields = contract.requiredHeaderFields.filter((field) => {
      switch (field) {
        case "batchNo":
          return isMissing(batch.batchNo);
        case "sourceDocumentId":
          return isMissing(batch.sourceDocumentId);
        case "sourceDocumentNo":
          return isMissing(batch.sourceDocumentNo);
        case "branchId":
          return isMissing(batch.branchId);
        case "fiscalPeriodId":
          return isMissing(batch.fiscalPeriodId);
        case "postingDate":
          return isMissing(batch.postingDate);
        case "description":
          return isMissing(batch.description);
        default:
          return false;
      }
    });

    if (missingRequiredHeaderFields.length > 0) {
      addFinding(findings, {
        severity: "warning",
        code: "CONTRACT_HEADER_GAPS",
        field: "header",
        message: `Contract ${contract.sourceType} is missing ${missingRequiredHeaderFields.join(", ")}.`,
        action: "Complete the contract header fields before approval or posting.",
        metadata: { missingRequiredHeaderFields },
      });
    }
  }

  const criticalCount = findings.filter((finding) => finding.severity === "critical").length;
  const warningCount = findings.filter((finding) => finding.severity === "warning").length;

  return {
    ok: criticalCount === 0,
    criticalCount,
    warningCount,
    findings,
    totals,
  };
}

export function validatePostingBatchForPost(
  batch: PostingBatchInput,
  context: Omit<PostingValidationContext, "intent"> = {},
): PostingValidationSummary {
  return validatePostingBatch(batch, { ...context, intent: "post" });
}
