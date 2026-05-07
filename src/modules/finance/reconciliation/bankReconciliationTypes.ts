export interface BankAccount {
  id: string;
  accountCode: string;
  bankName: string;
  iban?: string;
  currency: string;
  status: "active" | "inactive" | "archived";
}

export interface BankStatementLine {
  id: string;
  bankAccountId: string;
  statementDate: string;
  description: string;
  amount: number;
  matchedJournalLineId?: string;
  status: "unmatched" | "matched" | "adjustment_needed" | "ignored";
}

export interface BankReconciliationSummary {
  totalStatementAmount: number;
  matchedAmount: number;
  unmatchedAmount: number;
  adjustmentNeededCount: number;
  status: "trusted" | "warning" | "critical" | "incomplete";
}

export function summarizeBankReconciliation(lines: BankStatementLine[]): BankReconciliationSummary {
  const totalStatementAmount = lines.reduce((sum, line) => sum + line.amount, 0);
  const matchedAmount = lines.filter((line) => line.status === "matched").reduce((sum, line) => sum + line.amount, 0);
  const unmatchedAmount = lines.filter((line) => line.status === "unmatched").reduce((sum, line) => sum + line.amount, 0);
  const adjustmentNeededCount = lines.filter((line) => line.status === "adjustment_needed").length;

  return {
    totalStatementAmount,
    matchedAmount,
    unmatchedAmount,
    adjustmentNeededCount,
    status: adjustmentNeededCount > 0 ? "warning" : Math.abs(unmatchedAmount) > 0 ? "warning" : "trusted",
  };
}
