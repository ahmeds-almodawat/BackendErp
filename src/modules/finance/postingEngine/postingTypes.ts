import type { BranchDefinition } from "../../branches/branchScope";
import type { FiscalPeriod } from "../fiscalPeriods";
import type { PostingStatus } from "../postingStatus";

export type PostingSourceType =
  | "manual_journal"
  | "opening_balance"
  | "purchase_invoice"
  | "supplier_payment"
  | "sales_pos_batch"
  | "inventory_adjustment"
  | "production_batch"
  | "depreciation_run"
  | "bank_reconciliation";

export type PostingDirection = "normal" | "reversal";
export type PostingRiskLevel = "low" | "medium" | "high" | "critical";
export type PostingFindingSeverity = "ok" | "warning" | "critical";
export type PostingDuplicateScope = "global" | "branch" | "branch_period";
export type PostingValidationIntent = "save" | "validate" | "post" | "reverse";

export interface PostingBatchLineInput {
  id?: string;
  lineNo?: number;
  accountCode?: string;
  description?: string;
  branchId?: string;
  costCenterId?: string;
  debit?: number;
  credit?: number;
  sourceLineId?: string;
  metadata?: Record<string, unknown>;
}

export interface PostingBatchLine extends PostingBatchLineInput {
  id: string;
  lineNo: number;
  accountCode: string;
  debit: number;
  credit: number;
}

export interface PostingBatchInput {
  id?: string;
  batchNo?: string;
  sourceType?: PostingSourceType;
  sourceDocumentId?: string;
  sourceDocumentNo?: string;
  sourceModule?: string;
  branchId?: string;
  fiscalPeriodId?: string;
  postingDate?: string;
  status?: PostingStatus;
  direction?: PostingDirection;
  reversalOfBatchId?: string;
  currencyCode?: string;
  description?: string;
  lines?: PostingBatchLineInput[];
  metadata?: Record<string, unknown>;
}

export interface PostingBatch
  extends Omit<
    PostingBatchInput,
    | "batchNo"
    | "sourceType"
    | "sourceDocumentId"
    | "branchId"
    | "fiscalPeriodId"
    | "postingDate"
    | "status"
    | "direction"
    | "lines"
  > {
  id: string;
  batchNo: string;
  sourceType: PostingSourceType;
  sourceDocumentId: string;
  branchId: string;
  fiscalPeriodId: string;
  postingDate: string;
  status: PostingStatus;
  direction: PostingDirection;
  lines: PostingBatchLine[];
}

export interface PostingSourceLock {
  id?: string;
  sourceType: PostingSourceType;
  sourceDocumentId: string;
  branchId: string;
  batchId?: string;
  lockedAt?: string;
  lockedBy?: string;
}

export interface PostingDuplicateCandidate {
  id: string;
  batchNo: string;
  sourceType: PostingSourceType;
  sourceDocumentId: string;
  branchId: string;
  fiscalPeriodId?: string;
  status: PostingStatus;
  direction?: PostingDirection;
}

export interface PostingValidationFinding {
  severity: PostingFindingSeverity;
  code: string;
  message: string;
  field?: string;
  action?: string;
  metadata?: Record<string, unknown>;
}

export interface PostingValidationTotals {
  debit: number;
  credit: number;
  imbalance: number;
  lineCount: number;
}

export interface PostingValidationSummary {
  ok: boolean;
  criticalCount: number;
  warningCount: number;
  findings: PostingValidationFinding[];
  totals: PostingValidationTotals;
}

export interface PostingValidationContext {
  intent?: PostingValidationIntent;
  branch?: BranchDefinition | null;
  fiscalPeriod?: FiscalPeriod | null;
  persistedBatch?: PostingBatch | null;
  duplicateCandidates?: PostingDuplicateCandidate[];
  sourceLocks?: PostingSourceLock[];
}

export interface PostingReversalRequest {
  reversalDate: string;
  reversedBy: string;
  reason: string;
  notes?: string;
  reference?: string;
}

export interface PostingReversalRecord {
  originalBatchId: string;
  reversalBatchId: string;
  reversalDate: string;
  reversedBy: string;
  reason: string;
  notes?: string;
  createdAt: string;
}

export interface PostingReversalPreview {
  batch: PostingBatch;
  reversal: PostingReversalRecord;
  validation: PostingValidationSummary;
}
