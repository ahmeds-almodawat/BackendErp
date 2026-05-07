import assert from "node:assert/strict";

import {
  approveImport,
  canApproveImport,
  rejectImport,
} from "../src/modules/imports/importApproval.ts";
import {
  buildImportDuplicateKey,
  createImportCutoverPreview,
  validateImportCutoverReadiness,
} from "../src/modules/imports/importCutoverEngine.ts";
import {
  getDefaultMappingProfile,
  listDefaultMappingProfiles,
} from "../src/modules/imports/importMappingProfiles.ts";
import {
  validateRollbackRequest,
} from "../src/modules/imports/importRollback.ts";
import {
  buildInventoryValuationReport,
} from "../src/modules/analytics/reportingTruth/inventoryReports.ts";
import {
  buildTrialBalanceReport,
} from "../src/modules/analytics/reportingTruth/financeReports.ts";
import {
  summarizeReportingTruth,
} from "../src/modules/analytics/reportingTruth/reportingTruthEngine.ts";

const period = { start: "2026-05-01", end: "2026-05-31", label: "May 2026" };

function stagingFile(overrides = {}) {
  return {
    id: "file-1",
    sourceType: "items",
    fileName: "items.csv",
    status: "validated",
    uploadedBy: "qa",
    uploadedAt: "2026-05-05T00:00:00.000Z",
    totalRows: 10,
    validRows: 10,
    errorRows: 0,
    ...overrides,
  };
}

function cutoverBatch(overrides = {}) {
  return {
    id: "batch-1",
    stagingFileId: "file-1",
    mappingProfileId: "mp-items-v1",
    branchId: "branch-1",
    businessDate: "2026-05-05",
    fileHash: "sha256-demo",
    sourceType: "items",
    status: "posted",
    rollbackStatus: "none",
    rowCount: 10,
    criticalRowCount: 0,
    createdAt: "2026-05-05T00:00:00.000Z",
    updatedAt: "2026-05-05T00:00:00.000Z",
    ...overrides,
  };
}

function runImportQa() {
  const profiles = listDefaultMappingProfiles();
  assert.equal(profiles.length, 7, "v312 should expose seven default mapping profiles");
  assert.ok(getDefaultMappingProfile("items"), "items mapping profile should exist");
  assert.ok(
    profiles.every((profile) =>
      profile.requiredFields.every((field) =>
        profile.fieldMappings.some((mapping) => mapping.targetField === field && mapping.required),
      ),
    ),
    "every required field should have a required mapping",
  );

  const validFile = stagingFile();
  assert.equal(canApproveImport(validFile), true, "validated imports with no errors should be approvable");
  assert.equal(canApproveImport(stagingFile({ errorRows: 1 })), false, "imports with errors should not approve");

  const approved = approveImport(validFile, "qa-user", "2026-05-05T01:00:00.000Z");
  assert.equal(approved.ok, true, "valid import approval should pass");
  assert.equal(approved.status, "approved", "approval should transition to approved");

  const rejected = rejectImport(stagingFile({ status: "has_errors", errorRows: 2 }), "qa-user", "2026-05-05T01:00:00.000Z");
  assert.equal(rejected.ok, true, "review-stage import should be rejectable");
  assert.equal(rejected.status, "cancelled", "reject should transition to cancelled");

  const profile = getDefaultMappingProfile("items");
  const readiness = validateImportCutoverReadiness({
    file: stagingFile({ status: "approved" }),
    mappingProfile: profile,
    criticalRowErrors: 0,
    warningRowErrors: 1,
    fileHash: "sha256-demo",
    branchId: "branch-1",
    businessDate: "2026-05-05",
  });
  assert.equal(readiness.ok, true, "approved imports with no critical errors should be ready");
  assert.equal(readiness.warningCount, 1, "warnings should be counted without blocking cutover");

  const blockedReadiness = validateImportCutoverReadiness({
    file: stagingFile({ status: "validated" }),
    mappingProfile: profile,
    criticalRowErrors: 1,
  });
  assert.equal(blockedReadiness.ok, false, "unapproved imports with critical errors should block cutover");
  assert.ok(blockedReadiness.criticalCount >= 2, "blocked cutover should expose critical findings");

  const duplicateKey = buildImportDuplicateKey({
    fileHash: "sha256-demo",
    sourceType: "items",
    branchId: "branch-1",
    businessDate: "2026-05-05",
  });
  assert.equal(duplicateKey, "sha256-demo|items|branch-1|2026-05-05", "duplicate key should be deterministic");

  const preview = createImportCutoverPreview({
    stagingFileId: "file-1",
    profile,
    branchId: "branch-1",
    businessDate: "2026-05-05",
    fileHash: "sha256-demo",
    sourceType: "items",
    rowCount: 10,
    criticalRowCount: 0,
  });
  assert.equal(preview.batch.status, "draft", "cutover preview should start as draft");

  assert.equal(validateRollbackRequest(cutoverBatch(), "wrong upload").ok, true, "posted batches can request rollback");
  assert.equal(
    validateRollbackRequest(cutoverBatch({ status: "draft" }), "wrong upload").ok,
    false,
    "draft batches cannot request rollback",
  );
  assert.equal(
    validateRollbackRequest(cutoverBatch(), "").ok,
    false,
    "rollback requests require a reason",
  );
  assert.equal(
    validateRollbackRequest(cutoverBatch({ rollbackStatus: "applied" }), "wrong upload").ok,
    false,
    "applied rollbacks cannot be requested again",
  );
}

function runReportingQa() {
  const balancedTrialBalance = buildTrialBalanceReport({
    period,
    data: { trialBalance: { debitTotal: 100, creditTotal: 100, accountCount: 4 } },
  });
  assert.equal(balancedTrialBalance.status, "trusted", "balanced trial balance should be trusted");
  assert.equal(balancedTrialBalance.findings.length, 0, "balanced trial balance should have no findings");

  const unbalancedTrialBalance = buildTrialBalanceReport({
    period,
    data: { trialBalance: { debitTotal: 100, creditTotal: 90, accountCount: 4 } },
  });
  assert.equal(unbalancedTrialBalance.status, "critical", "unbalanced trial balance should be critical");

  const cleanInventory = buildInventoryValuationReport({
    period,
    data: { valuation: { totalValue: 1000, missingCostSkus: 0, negativeStockSkus: 0 } },
  });
  assert.equal(cleanInventory.status, "trusted", "clean inventory valuation should be trusted");

  const riskyInventory = buildInventoryValuationReport({
    period,
    data: { valuation: { totalValue: 1000, missingCostSkus: 1, negativeStockSkus: 1 } },
  });
  assert.equal(riskyInventory.status, "critical", "negative stock should make inventory valuation critical");

  const summary = summarizeReportingTruth([
    balancedTrialBalance,
    cleanInventory,
    riskyInventory,
  ]);
  assert.equal(summary.criticalCount, 1, "summary should count critical findings");
  assert.equal(summary.status, "critical", "summary should become critical when any report is critical");
  assert.ok(summary.truthScore < 100, "summary score should be penalized by findings");
}

runImportQa();
runReportingQa();

console.log("v312/v313 domain QA passed");
