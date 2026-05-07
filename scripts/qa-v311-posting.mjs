import assert from "node:assert/strict";

import {
  getPostingContract,
  listPostingContractTypes,
} from "../src/modules/finance/postingEngine/postingContracts.ts";
import {
  preparePostingReversal,
} from "../src/modules/finance/postingEngine/postingReversal.ts";
import {
  summarizePostingLines,
  validatePostingBatchForPost,
} from "../src/modules/finance/postingEngine/postingValidation.ts";

const openPeriod = {
  id: "period-2026-05",
  code: "2026-05",
  year: 2026,
  month: 5,
  startsAt: "2026-05-01",
  endsAt: "2026-05-31",
  status: "open",
};

const lockedPeriod = {
  ...openPeriod,
  id: "period-2026-04",
  code: "2026-04",
  month: 4,
  status: "locked",
};

function balancedBatch(overrides = {}) {
  return {
    id: "batch-1",
    batchNo: "JV-001",
    sourceType: "manual_journal",
    sourceDocumentId: "JV-001",
    sourceDocumentNo: "JV-001",
    sourceModule: "Finance",
    branchId: "branch-1",
    fiscalPeriodId: openPeriod.id,
    postingDate: "2026-05-05",
    status: "approved",
    direction: "normal",
    currencyCode: "SAR",
    description: "QA balanced journal",
    lines: [
      {
        id: "line-1",
        lineNo: 1,
        accountCode: "1010",
        description: "Cash",
        branchId: "branch-1",
        debit: 100,
        credit: 0,
      },
      {
        id: "line-2",
        lineNo: 2,
        accountCode: "4000",
        description: "Revenue",
        branchId: "branch-1",
        debit: 0,
        credit: 100,
      },
    ],
    ...overrides,
  };
}

function context(overrides = {}) {
  return {
    fiscalPeriod: openPeriod,
    sourceLocks: [
      {
        id: "lock-1",
        sourceType: "manual_journal",
        sourceDocumentId: "JV-001",
        branchId: "branch-1",
        batchId: "batch-1",
      },
    ],
    ...overrides,
  };
}

function assertFinding(summary, code, message) {
  assert.ok(
    summary.findings.some((finding) => finding.code === code),
    message ?? `expected finding ${code}`,
  );
}

function runPostingQa() {
  const contractTypes = listPostingContractTypes();
  assert.equal(contractTypes.length, 9, "v311 should expose nine posting contracts");
  assert.equal(getPostingContract("purchase_invoice")?.riskLevel, "critical", "purchase invoices should be critical risk");

  const validSummary = validatePostingBatchForPost(balancedBatch(), context());
  assert.equal(validSummary.ok, true, "balanced approved batch with source lock and open period should post");
  assert.equal(validSummary.criticalCount, 0, "valid posting should have no critical findings");
  assert.equal(validSummary.warningCount, 0, "valid posting should have no warnings");
  assert.deepEqual(
    summarizePostingLines(balancedBatch().lines),
    { debit: 100, credit: 100, imbalance: 0, lineCount: 2 },
    "posting totals should summarize debit, credit, imbalance, and line count",
  );

  const unbalancedSummary = validatePostingBatchForPost(
    balancedBatch({
      lines: [
        { accountCode: "1010", debit: 100, credit: 0 },
        { accountCode: "4000", debit: 0, credit: 90 },
      ],
    }),
    context(),
  );
  assert.equal(unbalancedSummary.ok, false, "unbalanced posting should fail");
  assertFinding(unbalancedSummary, "BATCH_NOT_BALANCED");

  const invalidLineSummary = validatePostingBatchForPost(
    balancedBatch({
      lines: [
        { accountCode: "1010", debit: 100, credit: 20 },
        { accountCode: "", debit: 0, credit: 120 },
      ],
    }),
    context(),
  );
  assertFinding(invalidLineSummary, "LINE_AMOUNT_INVALID", "line with debit and credit should be invalid");
  assertFinding(invalidLineSummary, "ACCOUNT_CODE_REQUIRED", "blank account code should be invalid");

  const duplicateSummary = validatePostingBatchForPost(
    balancedBatch(),
    context({
      duplicateCandidates: [
        {
          id: "other-batch",
          batchNo: "JV-001-OLD",
          sourceType: "manual_journal",
          sourceDocumentId: "JV-001",
          branchId: "branch-1",
          fiscalPeriodId: openPeriod.id,
          status: "posted",
          direction: "normal",
        },
      ],
    }),
  );
  assert.equal(duplicateSummary.ok, false, "duplicate source document should block posting");
  assertFinding(duplicateSummary, "DUPLICATE_SOURCE_DOCUMENT");

  const lockedPeriodSummary = validatePostingBatchForPost(
    balancedBatch({ fiscalPeriodId: lockedPeriod.id }),
    context({ fiscalPeriod: lockedPeriod }),
  );
  assert.equal(lockedPeriodSummary.ok, false, "locked fiscal period should block posting");
  assertFinding(lockedPeriodSummary, "PERIOD_BLOCKED");

  const immutableSummary = validatePostingBatchForPost(
    balancedBatch({ description: "Edited after post" }),
    context({ persistedBatch: balancedBatch({ status: "posted" }) }),
  );
  assert.equal(immutableSummary.ok, false, "posted persisted batches should be immutable");
  assertFinding(immutableSummary, "POSTED_BATCH_IMMUTABLE");

  const reversalPreview = preparePostingReversal(
    balancedBatch({ status: "posted" }),
    {
      reversalDate: "2026-05-06",
      reversedBy: "qa-user",
      reason: "wrong source",
      reference: "JV-001-REV",
    },
    { fiscalPeriod: openPeriod },
  );
  assert.equal(reversalPreview.batch.direction, "reversal", "reversal helper should create reversal direction");
  assert.equal(reversalPreview.batch.reversalOfBatchId, "batch-1", "reversal should reference original batch");
  assert.equal(reversalPreview.batch.lines[0].debit, 0, "first reversal line should mirror original credit");
  assert.equal(reversalPreview.batch.lines[0].credit, 100, "first reversal line should mirror original debit");
  assert.equal(reversalPreview.validation.ok, true, "valid reversal preview should pass validation");

  assert.throws(
    () => preparePostingReversal(balancedBatch({ status: "draft" }), {
      reversalDate: "2026-05-06",
      reversedBy: "qa-user",
      reason: "wrong source",
    }),
    /Only posted batches can be reversed/,
    "draft batches should not be reversible",
  );
}

runPostingQa();

console.log("v311 posting domain QA passed");
