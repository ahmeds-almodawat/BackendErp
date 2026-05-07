import assert from "node:assert/strict";
import {
  validateJournalEntry,
  summarizeJournalLines,
} from "../src/modules/finance/backend/financeJournalValidation.ts";
import {
  buildAgingSummary,
} from "../src/modules/finance/backend/subledgerAging.ts";
import {
  buildVatSummary,
} from "../src/modules/finance/tax/vatTypes.ts";
import {
  summarizeBankReconciliation,
} from "../src/modules/finance/reconciliation/bankReconciliationTypes.ts";
import {
  summarizeFinanceClose,
} from "../src/modules/finance/close/financeCloseTypes.ts";
import {
  buildFinanceManagementTruthPack,
} from "../src/modules/finance/management/financeManagementTruthPack.ts";

const journal = {
  journal_no: "JRN-001",
  journal_date: "2026-01-01",
  source_type: "manual_journal",
  description: "QA journal",
  status: "draft",
};

const balancedLines = [
  { account_code: "1010", debit: 100, credit: 0 },
  { account_code: "4000", debit: 0, credit: 100 },
];

const unbalancedLines = [
  { account_code: "1010", debit: 100, credit: 0 },
  { account_code: "4000", debit: 0, credit: 90 },
];

assert.equal(validateJournalEntry(journal, balancedLines).ok, true, "balanced journal should pass");
assert.equal(validateJournalEntry(journal, unbalancedLines).ok, false, "unbalanced journal should fail");
assert.equal(summarizeJournalLines(balancedLines).imbalance, 0, "balanced lines should have zero imbalance");

const aging = buildAgingSummary([
  {
    id: "ap-1",
    subledgerType: "ap",
    partyId: "supplier-1",
    partyName: "Supplier",
    documentNo: "PINV-001",
    documentDate: "2026-01-01",
    dueDate: "2026-01-31",
    debit: 0,
    credit: 100,
    balance: 100,
    status: "open",
  },
], "2026-03-15");

assert.equal(aging.length, 1, "aging should group party");
assert.equal(aging[0].totalBalance, 100, "aging should keep balance");

const vat = buildVatSummary([
  { id: "v1", sourceType: "sales_pos_batch", sourceId: "s1", taxDate: "2026-01-01", taxableAmount: 1000, vatAmount: 150, direction: "output", status: "posted" },
  { id: "v2", sourceType: "purchase_invoice", sourceId: "p1", taxDate: "2026-01-01", taxableAmount: 500, vatAmount: 75, direction: "input", status: "posted" },
]);

assert.equal(vat.netVatPayable, 75, "VAT payable should be output minus input");

const bank = summarizeBankReconciliation([
  { id: "b1", bankAccountId: "bank-1", statementDate: "2026-01-01", description: "deposit", amount: 100, status: "matched" },
  { id: "b2", bankAccountId: "bank-1", statementDate: "2026-01-02", description: "fee", amount: -10, status: "unmatched" },
]);

assert.equal(bank.status, "warning", "unmatched bank line should warn");

const close = summarizeFinanceClose([
  { key: "tb", label: "Trial Balance", status: "ready", required: true },
]);

assert.equal(close.status, "ready", "ready close check should pass");

const pack = buildFinanceManagementTruthPack({
  periodStart: "2026-01-01",
  periodEnd: "2026-01-31",
  revenue: 1000,
});

assert.equal(pack.status, "trusted", "clean management pack should be trusted");

console.log("v323-v328 finance enterprise domain QA passed");
