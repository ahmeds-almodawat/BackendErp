export interface LivePosProductLine {
  productCode?: string;
  sku?: string;
  productName?: string;
  categoryCode?: string;
  quantity: number;
  grossSales: number;
  discountAmount: number;
  refundAmount: number;
  taxAmount: number;
  netSales: number;
}

export interface LivePosPaymentLine {
  paymentMethod: string;
  amount: number;
  reference?: string;
}

export interface LivePosImportBatch {
  batchNo: string;
  branchId?: string;
  businessDate: string;
  sourceSystem: "foodics" | "manual" | "other_pos";
  productLines: LivePosProductLine[];
  paymentLines: LivePosPaymentLine[];
}

export function summarizeLivePosImport(batch: LivePosImportBatch) {
  const grossSales = batch.productLines.reduce((sum, line) => sum + Number(line.grossSales || 0), 0);
  const discountAmount = batch.productLines.reduce((sum, line) => sum + Number(line.discountAmount || 0), 0);
  const refundAmount = batch.productLines.reduce((sum, line) => sum + Number(line.refundAmount || 0), 0);
  const taxAmount = batch.productLines.reduce((sum, line) => sum + Number(line.taxAmount || 0), 0);
  const netSales = batch.productLines.reduce((sum, line) => sum + Number(line.netSales || 0), 0);
  const paymentTotal = batch.paymentLines.reduce((sum, line) => sum + Number(line.amount || 0), 0);
  const paymentDifference = Number((netSales + taxAmount - paymentTotal).toFixed(4));

  return {
    grossSales: Number(grossSales.toFixed(4)),
    discountAmount: Number(discountAmount.toFixed(4)),
    refundAmount: Number(refundAmount.toFixed(4)),
    taxAmount: Number(taxAmount.toFixed(4)),
    netSales: Number(netSales.toFixed(4)),
    paymentTotal: Number(paymentTotal.toFixed(4)),
    paymentDifference,
    productLineCount: batch.productLines.length,
    paymentLineCount: batch.paymentLines.length,
  };
}

export function validateLivePosImport(batch: LivePosImportBatch) {
  const findings: Array<{ severity: "warning" | "critical"; message: string; action: string }> = [];

  if (!batch.batchNo) {
    findings.push({ severity: "critical", message: "POS batch number is required.", action: "Create a unique POS batch reference." });
  }

  if (!batch.businessDate) {
    findings.push({ severity: "critical", message: "Business date is required.", action: "Set the POS business date." });
  }

  if (!batch.branchId) {
    findings.push({ severity: "warning", message: "Branch is not selected.", action: "Map the POS batch to a branch before live posting." });
  }

  if (batch.productLines.length === 0) {
    findings.push({ severity: "critical", message: "POS import must have product lines.", action: "Import product/category sales lines." });
  }

  if (batch.paymentLines.length === 0) {
    findings.push({ severity: "critical", message: "POS import must have payment lines.", action: "Import POS payment lines." });
  }

  for (const line of batch.productLines) {
    if (!line.productCode && !line.sku && !line.productName) {
      findings.push({ severity: "critical", message: "Product line is missing product identity.", action: "Map each POS line to product code, SKU, or product name." });
    }

    if (line.quantity < 0) {
      findings.push({ severity: "critical", message: "Product quantity cannot be negative.", action: "Correct product quantity." });
    }

    if (line.grossSales < 0 || line.taxAmount < 0 || line.netSales < 0) {
      findings.push({ severity: "critical", message: "Sales, tax, and net sales cannot be negative.", action: "Correct POS amounts." });
    }
  }

  for (const payment of batch.paymentLines) {
    if (!payment.paymentMethod) {
      findings.push({ severity: "critical", message: "Payment method is required.", action: "Map every payment line to a payment method." });
    }

    if (payment.amount < 0) {
      findings.push({ severity: "critical", message: "Payment amount cannot be negative.", action: "Correct payment amount." });
    }
  }

  const totals = summarizeLivePosImport(batch);

  if (Math.abs(totals.paymentDifference) > 1) {
    findings.push({
      severity: "warning",
      message: `POS sales/payment difference detected: ${totals.paymentDifference}.`,
      action: "Review discounts, refunds, tax, and payment mapping before posting.",
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
