export type LedgerLine = {
  accountCode: string;
  debit: number;
  credit: number;
  branchId?: string;
  costCenterId?: string;
  memo?: string;
};

export type PostingResult = {
  ok: boolean;
  errors: string[];
  warnings: string[];
};

export function validateBalancedJournal(lines: LedgerLine[]): PostingResult {
  const debit = lines.reduce((sum, line) => sum + Number(line.debit || 0), 0);
  const credit = lines.reduce((sum, line) => sum + Number(line.credit || 0), 0);
  const errors: string[] = [];
  if (lines.length < 2) errors.push('Journal must contain at least two lines.');
  if (Math.abs(debit - credit) > 0.01) errors.push(`Journal is not balanced. Difference: ${(debit - credit).toFixed(2)}`);
  if (lines.some((line) => !line.accountCode)) errors.push('Every line must have an account code.');
  if (lines.some((line) => Number(line.debit || 0) < 0 || Number(line.credit || 0) < 0)) errors.push('Debit/credit amounts cannot be negative.');
  return { ok: errors.length === 0, errors, warnings: [] };
}

export function reverseLines(lines: LedgerLine[]): LedgerLine[] {
  return lines.map((line) => ({ ...line, debit: line.credit, credit: line.debit, memo: `Reverse: ${line.memo ?? ''}`.trim() }));
}
