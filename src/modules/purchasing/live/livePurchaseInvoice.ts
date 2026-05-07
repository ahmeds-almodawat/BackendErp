export interface LivePurchaseInvoiceLine {
  sku?: string;
  itemId?: string;
  accountCode?: string;
  quantity: number;
  unitCost: number;
  discountAmount: number;
  taxAmount: number;
}

export interface LivePurchaseInvoice {
  invoiceNo: string;
  supplierId?: string;
  branchId?: string;
  storeId?: string;
  invoiceDate: string;
  dueDate?: string;
  lines: LivePurchaseInvoiceLine[];
}

export function summarizeLivePurchaseInvoice(invoice: LivePurchaseInvoice) {
  const subtotal = invoice.lines.reduce((sum, line) => sum + Number(line.quantity || 0) * Number(line.unitCost || 0), 0);
  const discount = invoice.lines.reduce((sum, line) => sum + Number(line.discountAmount || 0), 0);
  const tax = invoice.lines.reduce((sum, line) => sum + Number(line.taxAmount || 0), 0);
  const total = subtotal - discount + tax;

  return {
    subtotal: Number(subtotal.toFixed(4)),
    discount: Number(discount.toFixed(4)),
    tax: Number(tax.toFixed(4)),
    total: Number(total.toFixed(4)),
    lineCount: invoice.lines.length,
  };
}

export function validateLivePurchaseInvoice(invoice: LivePurchaseInvoice) {
  const findings: Array<{ severity: "warning" | "critical"; message: string; action: string }> = [];

  if (!invoice.invoiceNo) {
    findings.push({ severity: "critical", message: "Purchase invoice number is required.", action: "Enter supplier invoice number." });
  }

  if (!invoice.supplierId) {
    findings.push({ severity: "critical", message: "Supplier is required.", action: "Select supplier." });
  }

  if (!invoice.branchId) {
    findings.push({ severity: "critical", message: "Branch is required.", action: "Map invoice to branch." });
  }

  if (!invoice.invoiceDate) {
    findings.push({ severity: "critical", message: "Invoice date is required.", action: "Set invoice date." });
  }

  if (invoice.lines.length === 0) {
    findings.push({ severity: "critical", message: "Purchase invoice must have at least one line.", action: "Add invoice lines." });
  }

  for (const line of invoice.lines) {
    if (!line.sku && !line.itemId && !line.accountCode) {
      findings.push({ severity: "critical", message: "Invoice line must map to item or account.", action: "Map every line." });
    }

    if (line.quantity <= 0) {
      findings.push({ severity: "critical", message: "Invoice quantity must be positive.", action: "Correct quantity." });
    }

    if (line.unitCost < 0) {
      findings.push({ severity: "critical", message: "Unit cost cannot be negative.", action: "Correct cost." });
    }
  }

  const totals = summarizeLivePurchaseInvoice(invoice);

  if (totals.total <= 0) {
    findings.push({ severity: "critical", message: "Purchase invoice total must be positive.", action: "Correct invoice totals." });
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
