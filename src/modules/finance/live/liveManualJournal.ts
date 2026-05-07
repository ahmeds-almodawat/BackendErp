export interface LiveManualJournalLine {
  accountCode: string;
  branchId?: string;
  debit: number;
  credit: number;
  memo?: string;
}

export interface LiveManualJournalRequest {
  journalNo: string;
  journalDate: string;
  branchId?: string;
  fiscalPeriodId?: string;
  description: string;
  lines: LiveManualJournalLine[];
}

export function summarizeLiveJournalLines(lines: LiveManualJournalLine[]) {
  const debit = lines.reduce((sum, line) => sum + Number(line.debit || 0), 0);
  const credit = lines.reduce((sum, line) => sum + Number(line.credit || 0), 0);

  return {
    debit,
    credit,
    imbalance: Number((debit - credit).toFixed(4)),
    lineCount: lines.length,
  };
}

export function validateLiveManualJournal(request: LiveManualJournalRequest) {
  const findings: Array<{ severity: "warning" | "critical"; message: string; action: string }> = [];

  if (!request.journalNo) {
    findings.push({ severity: "critical", message: "Journal number is required.", action: "Create a unique journal number." });
  }

  if (!request.journalDate) {
    findings.push({ severity: "critical", message: "Journal date is required.", action: "Set journal date." });
  }

  if (!request.description) {
    findings.push({ severity: "warning", message: "Journal description is recommended.", action: "Add a clear audit description." });
  }

  if (request.lines.length < 2) {
    findings.push({ severity: "critical", message: "Journal must have at least two lines.", action: "Add debit and credit lines." });
  }

  for (const line of request.lines) {
    if (!line.accountCode) {
      findings.push({ severity: "critical", message: "Every line must have account code.", action: "Map every line to chart of accounts." });
    }

    if (line.debit < 0 || line.credit < 0) {
      findings.push({ severity: "critical", message: "Debit/credit cannot be negative.", action: "Correct line amount." });
    }

    if (line.debit > 0 && line.credit > 0) {
      findings.push({ severity: "critical", message: "Line cannot have both debit and credit.", action: "Split the line." });
    }
  }

  const totals = summarizeLiveJournalLines(request.lines);

  if (Math.abs(totals.imbalance) > 0.01) {
    findings.push({
      severity: "critical",
      message: "Journal is not balanced.",
      action: "Debit total must equal credit total before posting.",
    });
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
