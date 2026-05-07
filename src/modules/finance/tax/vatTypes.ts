export type VatTransactionSource =
  | "purchase_invoice"
  | "sales_pos_batch"
  | "manual_adjustment"
  | "vat_settlement";

export interface VatTransaction {
  id: string;
  sourceType: VatTransactionSource;
  sourceId: string;
  branchId?: string;
  taxDate: string;
  taxableAmount: number;
  vatAmount: number;
  direction: "input" | "output";
  status: "draft" | "posted" | "settled" | "cancelled";
}

export interface VatSummary {
  inputVat: number;
  outputVat: number;
  netVatPayable: number;
  transactionCount: number;
  status: "trusted" | "warning" | "critical" | "incomplete";
  findings: string[];
}

export function buildVatSummary(transactions: VatTransaction[]): VatSummary {
  const inputVat = transactions
    .filter((transaction) => transaction.direction === "input" && transaction.status === "posted")
    .reduce((sum, transaction) => sum + transaction.vatAmount, 0);

  const outputVat = transactions
    .filter((transaction) => transaction.direction === "output" && transaction.status === "posted")
    .reduce((sum, transaction) => sum + transaction.vatAmount, 0);

  const findings: string[] = [];

  const negativeVat = transactions.filter((transaction) => transaction.vatAmount < 0).length;

  if (negativeVat > 0) {
    findings.push(`${negativeVat} VAT transaction(s) have negative VAT amount.`);
  }

  const missingSource = transactions.filter((transaction) => !transaction.sourceId || !transaction.sourceType).length;

  if (missingSource > 0) {
    findings.push(`${missingSource} VAT transaction(s) are missing source document links.`);
  }

  return {
    inputVat,
    outputVat,
    netVatPayable: outputVat - inputVat,
    transactionCount: transactions.length,
    status: findings.length > 0 ? "warning" : "trusted",
    findings,
  };
}
