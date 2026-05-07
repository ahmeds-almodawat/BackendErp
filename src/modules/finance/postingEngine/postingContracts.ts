import type {
  PostingDuplicateScope,
  PostingRiskLevel,
  PostingSourceType,
} from "./postingTypes";

type PostingDuplicateKeyPart =
  | "sourceType"
  | "sourceDocumentId"
  | "branchId"
  | "fiscalPeriodId";

export interface PostingDuplicateDesign {
  scope: PostingDuplicateScope;
  keyParts: PostingDuplicateKeyPart[];
  lockRpc: "finance_lock_posting_source";
  note: string;
}

export interface PostingContractDefinition {
  sourceType: PostingSourceType;
  title: string;
  sourceModule: string;
  description: string;
  expectedDebits: string[];
  expectedCredits: string[];
  requiredControls: string[];
  requiredHeaderFields: string[];
  optionalHeaderFields: string[];
  csvTemplates: string[];
  reversalStrategy: "mirror_lines";
  duplicateDesign: PostingDuplicateDesign;
  riskLevel: PostingRiskLevel;
}

const sharedTemplates = [
  "templates/v311/posting_batch_template.csv",
  "templates/v311/posting_batch_lines_template.csv",
];

const sharedDuplicateDesign = (
  scope: PostingDuplicateScope,
  note: string,
): PostingDuplicateDesign => ({
  scope,
  keyParts:
    scope === "branch_period"
      ? ["sourceType", "sourceDocumentId", "branchId", "fiscalPeriodId"]
      : ["sourceType", "sourceDocumentId", "branchId"],
  lockRpc: "finance_lock_posting_source",
  note,
});

const contractMap: Record<PostingSourceType, PostingContractDefinition> = {
  manual_journal: {
    sourceType: "manual_journal",
    title: "Manual Journal",
    sourceModule: "Finance",
    description:
      "Controlled general-ledger batch for manual accounting entries that still obey branch, period, and immutability rules.",
    expectedDebits: ["Configured debit ledger account"],
    expectedCredits: ["Configured credit ledger account"],
    requiredControls: [
      "balanced_lines",
      "approval_required",
      "period_open",
      "branch_scope_resolved",
    ],
    requiredHeaderFields: [
      "batchNo",
      "sourceDocumentId",
      "branchId",
      "fiscalPeriodId",
      "postingDate",
    ],
    optionalHeaderFields: ["description", "currencyCode", "sourceDocumentNo"],
    csvTemplates: sharedTemplates,
    reversalStrategy: "mirror_lines",
    duplicateDesign: sharedDuplicateDesign(
      "branch_period",
      "Manual journals should lock the user-facing journal reference per branch and period before approval/posting.",
    ),
    riskLevel: "high",
  },
  opening_balance: {
    sourceType: "opening_balance",
    title: "Opening Balance",
    sourceModule: "Finance",
    description:
      "Opening balance batch for cutover or first-use scenarios, intended to be locked after posting and reversed only through explicit reversal batches.",
    expectedDebits: ["Opening assets and expenses"],
    expectedCredits: ["Opening liabilities, equity, and revenue"],
    requiredControls: [
      "balanced_lines",
      "single_cutover_reference",
      "period_open",
      "locked_after_posting",
    ],
    requiredHeaderFields: [
      "batchNo",
      "sourceDocumentId",
      "branchId",
      "fiscalPeriodId",
      "postingDate",
      "description",
    ],
    optionalHeaderFields: ["currencyCode", "sourceDocumentNo"],
    csvTemplates: sharedTemplates,
    reversalStrategy: "mirror_lines",
    duplicateDesign: sharedDuplicateDesign(
      "branch_period",
      "Opening balance sources should be unique by cutover reference so the same opening file cannot post twice.",
    ),
    riskLevel: "critical",
  },
  purchase_invoice: {
    sourceType: "purchase_invoice",
    title: "Purchase Invoice",
    sourceModule: "Purchasing",
    description:
      "Accounts payable and inventory/expense batch generated from approved supplier invoices or matched GRN flows.",
    expectedDebits: ["Inventory or expense", "VAT input where applicable"],
    expectedCredits: ["Accounts payable or cash"],
    requiredControls: [
      "supplier_document_unique",
      "three_way_match_or_override",
      "period_open",
      "branch_scope_resolved",
    ],
    requiredHeaderFields: [
      "batchNo",
      "sourceDocumentId",
      "sourceDocumentNo",
      "branchId",
      "fiscalPeriodId",
      "postingDate",
    ],
    optionalHeaderFields: ["description", "currencyCode"],
    csvTemplates: sharedTemplates,
    reversalStrategy: "mirror_lines",
    duplicateDesign: sharedDuplicateDesign(
      "branch",
      "Supplier invoice references should be locked by source type, invoice id, and branch as soon as the invoice enters posting.",
    ),
    riskLevel: "critical",
  },
  supplier_payment: {
    sourceType: "supplier_payment",
    title: "Supplier Payment",
    sourceModule: "Purchasing / AP",
    description:
      "Cash or bank settlement batch against open supplier balances with traceability back to the payment voucher.",
    expectedDebits: ["Accounts payable"],
    expectedCredits: ["Cash or bank"],
    requiredControls: [
      "open_balance_available",
      "payment_method_valid",
      "bank_account_resolved",
      "period_open",
    ],
    requiredHeaderFields: [
      "batchNo",
      "sourceDocumentId",
      "branchId",
      "fiscalPeriodId",
      "postingDate",
    ],
    optionalHeaderFields: ["description", "currencyCode", "sourceDocumentNo"],
    csvTemplates: sharedTemplates,
    reversalStrategy: "mirror_lines",
    duplicateDesign: sharedDuplicateDesign(
      "branch",
      "Payment vouchers should be locked per branch before they can affect AP and cash balances.",
    ),
    riskLevel: "high",
  },
  sales_pos_batch: {
    sourceType: "sales_pos_batch",
    title: "Sales POS Batch",
    sourceModule: "Sales / POS",
    description:
      "Daily or shift-level POS settlement batch covering sales, VAT, tenders, and the downstream finance handoff.",
    expectedDebits: ["Cash, bank, clearing, or receivables"],
    expectedCredits: ["Sales revenue", "VAT output"],
    requiredControls: [
      "batch_closed",
      "payment_split_balanced",
      "branch_scope_resolved",
      "period_open",
    ],
    requiredHeaderFields: [
      "batchNo",
      "sourceDocumentId",
      "branchId",
      "fiscalPeriodId",
      "postingDate",
    ],
    optionalHeaderFields: ["description", "currencyCode", "sourceDocumentNo"],
    csvTemplates: sharedTemplates,
    reversalStrategy: "mirror_lines",
    duplicateDesign: sharedDuplicateDesign(
      "branch",
      "POS settlement batches should be locked at the source batch id to stop duplicate settlement imports.",
    ),
    riskLevel: "critical",
  },
  inventory_adjustment: {
    sourceType: "inventory_adjustment",
    title: "Inventory Adjustment",
    sourceModule: "Inventory",
    description:
      "Posting batch for approved stock adjustments, count variances, write-offs, or other controlled inventory corrections.",
    expectedDebits: ["Inventory gain, variance, or expense"],
    expectedCredits: ["Inventory or variance"],
    requiredControls: [
      "approval_required",
      "reason_required",
      "cost_basis_resolved",
      "period_open",
    ],
    requiredHeaderFields: [
      "batchNo",
      "sourceDocumentId",
      "branchId",
      "fiscalPeriodId",
      "postingDate",
    ],
    optionalHeaderFields: ["description", "currencyCode", "sourceDocumentNo"],
    csvTemplates: sharedTemplates,
    reversalStrategy: "mirror_lines",
    duplicateDesign: sharedDuplicateDesign(
      "branch",
      "Inventory adjustment documents should lock their approval reference before posting to avoid duplicate variances.",
    ),
    riskLevel: "high",
  },
  production_batch: {
    sourceType: "production_batch",
    title: "Production Batch",
    sourceModule: "Production",
    description:
      "WIP or finished-goods posting batch generated from approved production output with raw-material consumption traceability.",
    expectedDebits: ["Semi-finished or finished goods inventory"],
    expectedCredits: ["Raw material inventory"],
    requiredControls: [
      "recipe_version_locked",
      "output_qty_confirmed",
      "wastage_captured",
      "period_open",
    ],
    requiredHeaderFields: [
      "batchNo",
      "sourceDocumentId",
      "branchId",
      "fiscalPeriodId",
      "postingDate",
    ],
    optionalHeaderFields: ["description", "currencyCode", "sourceDocumentNo"],
    csvTemplates: sharedTemplates,
    reversalStrategy: "mirror_lines",
    duplicateDesign: sharedDuplicateDesign(
      "branch",
      "Production batch ids should be locked per branch before consumption and GL updates are finalized.",
    ),
    riskLevel: "high",
  },
  depreciation_run: {
    sourceType: "depreciation_run",
    title: "Depreciation Run",
    sourceModule: "Fixed Assets",
    description:
      "Scheduled or controlled depreciation run that produces expense and accumulated depreciation entries by period.",
    expectedDebits: ["Depreciation expense"],
    expectedCredits: ["Accumulated depreciation"],
    requiredControls: [
      "asset_population_ready",
      "single_run_per_period",
      "period_open",
      "approval_required",
    ],
    requiredHeaderFields: [
      "batchNo",
      "sourceDocumentId",
      "branchId",
      "fiscalPeriodId",
      "postingDate",
    ],
    optionalHeaderFields: ["description", "currencyCode", "sourceDocumentNo"],
    csvTemplates: sharedTemplates,
    reversalStrategy: "mirror_lines",
    duplicateDesign: sharedDuplicateDesign(
      "branch_period",
      "Depreciation runs should lock the run id per branch and period so the same run cannot be generated twice.",
    ),
    riskLevel: "medium",
  },
  bank_reconciliation: {
    sourceType: "bank_reconciliation",
    title: "Bank Reconciliation",
    sourceModule: "Banking",
    description:
      "Adjustment or clearing batch arising from bank reconciliation differences that have been reviewed and approved.",
    expectedDebits: ["Bank or clearing"],
    expectedCredits: ["Bank or clearing"],
    requiredControls: [
      "statement_line_linked",
      "difference_explained",
      "approval_required",
      "period_open",
    ],
    requiredHeaderFields: [
      "batchNo",
      "sourceDocumentId",
      "branchId",
      "fiscalPeriodId",
      "postingDate",
    ],
    optionalHeaderFields: ["description", "currencyCode", "sourceDocumentNo"],
    csvTemplates: [
      ...sharedTemplates,
      "templates/v311/posting_reversal_template.csv",
    ],
    reversalStrategy: "mirror_lines",
    duplicateDesign: sharedDuplicateDesign(
      "branch_period",
      "Reconciliation adjustments should lock the statement difference id per branch and period before they reach the ledger.",
    ),
    riskLevel: "high",
  },
};

export const POSTING_CONTRACTS: PostingContractDefinition[] = Object.values(
  contractMap,
);

export function getPostingContract(
  sourceType?: PostingSourceType | null,
): PostingContractDefinition | undefined {
  return sourceType ? contractMap[sourceType] : undefined;
}

export function listPostingContractTypes(): PostingSourceType[] {
  return POSTING_CONTRACTS.map((contract) => contract.sourceType);
}
