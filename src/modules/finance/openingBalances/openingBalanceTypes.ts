export interface OpeningBalanceLine {
  accountCode: string;
  branchId?: string;
  debit: number;
  credit: number;
  memo?: string;
}

export interface OpeningBalanceBatch {
  batchNo: string;
  fiscalPeriodId: string;
  branchId?: string;
  openingDate: string;
  lines: OpeningBalanceLine[];
}

export function summarizeOpeningBalance(batch: OpeningBalanceBatch) {
  const debit = batch.lines.reduce((sum, line) => sum + Number(line.debit || 0), 0);
  const credit = batch.lines.reduce((sum, line) => sum + Number(line.credit || 0), 0);

  return {
    debit,
    credit,
    imbalance: Number((debit - credit).toFixed(4)),
    lineCount: batch.lines.length,
  };
}

export function validateOpeningBalanceBatch(batch: OpeningBalanceBatch) {
  const findings: Array<{ severity: "warning" | "critical"; message: string; action: string }> = [];

  if (!batch.batchNo) {
    findings.push({ severity: "critical", message: "Opening balance batch number is required.", action: "Create a unique opening batch number." });
  }

  if (!batch.fiscalPeriodId) {
    findings.push({ severity: "critical", message: "Fiscal period is required.", action: "Select opening fiscal period." });
  }

  if (!batch.openingDate) {
    findings.push({ severity: "critical", message: "Opening date is required.", action: "Set opening balance date." });
  }

  if (batch.lines.length < 2) {
    findings.push({ severity: "critical", message: "Opening balance must contain at least two lines.", action: "Add balanced debit and credit lines." });
  }

  for (const line of batch.lines) {
    if (!line.accountCode) {
      findings.push({ severity: "critical", message: "Opening balance line missing account code.", action: "Map every line to chart of accounts." });
    }
  }

  const totals = summarizeOpeningBalance(batch);

  if (Math.abs(totals.imbalance) > 0.01) {
    findings.push({ severity: "critical", message: "Opening balance is not balanced.", action: "Debit total must equal credit total." });
  }

  const criticalCount = findings.filter((finding) => finding.severity === "critical").length;

  return {
    ok: criticalCount === 0,
    criticalCount,
    warningCount: findings.filter((finding) => finding.severity === "warning").length,
    totals,
    findings,
  };
}
