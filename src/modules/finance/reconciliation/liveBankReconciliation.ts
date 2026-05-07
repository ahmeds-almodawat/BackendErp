export interface LiveBankStatementLine {
  bankAccountId?: string;
  accountCode?: string;
  statementDate: string;
  description: string;
  amount: number;
  reference?: string;
}

export interface LiveBankStatementImport {
  importNo: string;
  bankAccountId?: string;
  accountCode?: string;
  periodStart: string;
  periodEnd: string;
  lines: LiveBankStatementLine[];
}

export interface LiveBankReconciliationMatch {
  statementLineId: string;
  journalLineId: string;
  matchedAmount: number;
  notes?: string;
}

export function summarizeLiveBankStatementImport(statement: LiveBankStatementImport) {
  const totalAmount = statement.lines.reduce((sum, line) => sum + Number(line.amount || 0), 0);

  return {
    lineCount: statement.lines.length,
    totalAmount: Number(totalAmount.toFixed(4)),
  };
}

export function validateLiveBankStatementImport(statement: LiveBankStatementImport) {
  const findings: Array<{ severity: "warning" | "critical"; message: string; action: string }> = [];

  if (!statement.importNo) {
    findings.push({ severity: "critical", message: "Bank statement import number is required.", action: "Create a unique import number." });
  }

  if (!statement.bankAccountId && !statement.accountCode) {
    findings.push({ severity: "critical", message: "Bank account is required.", action: "Select a bank account or account code." });
  }

  if (!statement.periodStart || !statement.periodEnd) {
    findings.push({ severity: "critical", message: "Statement period is required.", action: "Set period start and end dates." });
  }

  if (statement.periodStart && statement.periodEnd && new Date(statement.periodStart) > new Date(statement.periodEnd)) {
    findings.push({ severity: "critical", message: "Statement period start is after end date.", action: "Correct the statement period." });
  }

  if (statement.lines.length === 0) {
    findings.push({ severity: "critical", message: "Bank statement must have at least one line.", action: "Add or import bank statement lines." });
  }

  for (const line of statement.lines) {
    if (!line.statementDate) {
      findings.push({ severity: "critical", message: "Statement line date is required.", action: "Set the transaction date for every line." });
    }

    if (!line.description) {
      findings.push({ severity: "warning", message: "Statement line description is recommended.", action: "Keep bank descriptions for reconciliation audit." });
    }

    if (!Number.isFinite(line.amount)) {
      findings.push({ severity: "critical", message: "Statement line amount must be numeric.", action: "Correct the bank amount." });
    }
  }

  const criticalCount = findings.filter((finding) => finding.severity === "critical").length;

  return {
    ok: criticalCount === 0,
    criticalCount,
    warningCount: findings.filter((finding) => finding.severity === "warning").length,
    totals: summarizeLiveBankStatementImport(statement),
    findings,
  };
}

export function validateLiveBankReconciliationMatch(match: LiveBankReconciliationMatch) {
  const findings: Array<{ severity: "warning" | "critical"; message: string; action: string }> = [];

  if (!match.statementLineId) {
    findings.push({ severity: "critical", message: "Statement line is required.", action: "Select the bank statement line." });
  }

  if (!match.journalLineId) {
    findings.push({ severity: "critical", message: "Journal line is required.", action: "Select the matching GL/bank ledger line." });
  }

  if (!Number.isFinite(match.matchedAmount) || match.matchedAmount === 0) {
    findings.push({ severity: "critical", message: "Matched amount must be non-zero.", action: "Enter a valid matched amount." });
  }

  const criticalCount = findings.filter((finding) => finding.severity === "critical").length;

  return {
    ok: criticalCount === 0,
    criticalCount,
    warningCount: findings.filter((finding) => finding.severity === "warning").length,
    findings,
  };
}
