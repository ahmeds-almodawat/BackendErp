import type {
  FinanceJournalEntryBackendRecord,
  FinanceJournalLineBackendRecord,
  FinanceValidationFinding,
  FinanceValidationSummary,
} from "./financeBackendTypes";

const BALANCE_TOLERANCE = 0.01;

function required(value: unknown): boolean {
  return value !== undefined && value !== null && String(value).trim().length > 0;
}

function summarize(findings: FinanceValidationFinding[]): FinanceValidationSummary {
  const criticalCount = findings.filter((finding) => finding.severity === "critical").length;
  const warningCount = findings.filter((finding) => finding.severity === "warning").length;

  return {
    ok: criticalCount === 0,
    criticalCount,
    warningCount,
    findings,
  };
}

export function summarizeJournalLines(lines: Partial<FinanceJournalLineBackendRecord>[]) {
  const debit = lines.reduce((sum, line) => sum + Number(line.debit ?? 0), 0);
  const credit = lines.reduce((sum, line) => sum + Number(line.credit ?? 0), 0);

  return {
    debit,
    credit,
    imbalance: Number((debit - credit).toFixed(4)),
    lineCount: lines.length,
  };
}

export function validateJournalEntry(
  journal: Partial<FinanceJournalEntryBackendRecord>,
  lines: Partial<FinanceJournalLineBackendRecord>[],
): FinanceValidationSummary {
  const findings: FinanceValidationFinding[] = [];

  if (!required(journal.journal_no)) {
    findings.push({
      severity: "critical",
      field: "journal_no",
      message: "Journal number is required.",
      action: "Create a unique journal reference before posting.",
    });
  }

  if (!required(journal.journal_date)) {
    findings.push({
      severity: "critical",
      field: "journal_date",
      message: "Journal date is required.",
      action: "Set journal date.",
    });
  }

  if (!required(journal.source_type)) {
    findings.push({
      severity: "critical",
      field: "source_type",
      message: "Journal source type is required.",
      action: "Set manual, purchase, sales, inventory, production, bank, or tax source.",
    });
  }

  if (!required(journal.description)) {
    findings.push({
      severity: "warning",
      field: "description",
      message: "Journal description is recommended.",
      action: "Add a clear description for audit readability.",
    });
  }

  if (lines.length < 2) {
    findings.push({
      severity: "critical",
      field: "lines",
      message: "Journal must contain at least two lines.",
      action: "Add debit and credit lines.",
    });
  }

  lines.forEach((line, index) => {
    if (!required(line.account_code)) {
      findings.push({
        severity: "critical",
        field: `lines.${index}.account_code`,
        message: "Every journal line must have account code.",
        action: "Map line to a valid chart account.",
      });
    }

    const debit = Number(line.debit ?? 0);
    const credit = Number(line.credit ?? 0);

    if (debit < 0 || credit < 0) {
      findings.push({
        severity: "critical",
        field: `lines.${index}.amount`,
        message: "Journal debit/credit cannot be negative.",
        action: "Correct line amount.",
      });
    }

    if (debit > 0 && credit > 0) {
      findings.push({
        severity: "critical",
        field: `lines.${index}.amount`,
        message: "Journal line cannot have both debit and credit.",
        action: "Split into separate debit/credit lines.",
      });
    }

    if (debit === 0 && credit === 0) {
      findings.push({
        severity: "critical",
        field: `lines.${index}.amount`,
        message: "Journal line must have debit or credit amount.",
        action: "Enter line amount or remove line.",
      });
    }
  });

  const totals = summarizeJournalLines(lines);

  if (Math.abs(totals.imbalance) > BALANCE_TOLERANCE) {
    findings.push({
      severity: "critical",
      field: "lines",
      message: `Journal is not balanced. Debit ${totals.debit.toFixed(2)} vs credit ${totals.credit.toFixed(2)}.`,
      action: "Balance the journal before posting.",
    });
  }

  if (journal.status === "posted" || journal.status === "reversed") {
    findings.push({
      severity: "warning",
      field: "status",
      message: "Posted/reversed journals should be immutable.",
      action: "Use reversal journal instead of editing official journals.",
    });
  }

  return summarize(findings);
}
