import type { SupabaseBrowserClientLike } from "../../lib/supabase/supabaseClient";
import type { PurchaseInvoiceBackendRecord, SupplierPaymentBackendRecord, PurchasingValidationFinding } from "./purchasingBackendTypes";

function required(value: unknown): boolean {
  return value !== undefined && value !== null && String(value).trim().length > 0;
}

function summarize(findings: PurchasingValidationFinding[]) {
  const criticalCount = findings.filter((finding) => finding.severity === "critical").length;
  const warningCount = findings.filter((finding) => finding.severity === "warning").length;

  return {
    ok: criticalCount === 0,
    criticalCount,
    warningCount,
    findings,
  };
}

export function validatePurchaseInvoice(invoice: Partial<PurchaseInvoiceBackendRecord>) {
  const findings: PurchasingValidationFinding[] = [];

  if (!required(invoice.invoice_no)) findings.push({ severity: "critical", field: "invoice_no", message: "Purchase invoice number is required.", action: "Enter supplier invoice number." });
  if (!required(invoice.supplier_id)) findings.push({ severity: "critical", field: "supplier_id", message: "Supplier is required.", action: "Select a valid supplier." });
  if (!required(invoice.branch_id)) findings.push({ severity: "critical", field: "branch_id", message: "Branch is required.", action: "Resolve invoice to branch." });
  if (!required(invoice.invoice_date)) findings.push({ severity: "critical", field: "invoice_date", message: "Invoice date is required.", action: "Enter invoice date." });
  if (!Number.isFinite(invoice.total_amount) || Number(invoice.total_amount) <= 0) findings.push({ severity: "critical", field: "total_amount", message: "Purchase invoice total must be positive.", action: "Correct invoice totals." });

  return summarize(findings);
}

export function validateSupplierPayment(payment: Partial<SupplierPaymentBackendRecord>) {
  const findings: PurchasingValidationFinding[] = [];

  if (!required(payment.payment_no)) findings.push({ severity: "critical", field: "payment_no", message: "Payment number is required.", action: "Create a unique payment reference." });
  if (!required(payment.supplier_id)) findings.push({ severity: "critical", field: "supplier_id", message: "Supplier is required.", action: "Select supplier." });
  if (!required(payment.branch_id)) findings.push({ severity: "critical", field: "branch_id", message: "Branch is required.", action: "Resolve payment to branch." });
  if (!required(payment.account_code)) findings.push({ severity: "critical", field: "account_code", message: "Payment account is required.", action: "Select cash/bank account." });
  if (!Number.isFinite(payment.amount) || Number(payment.amount) <= 0) findings.push({ severity: "critical", field: "amount", message: "Payment amount must be positive.", action: "Correct payment amount." });

  return summarize(findings);
}

export function createPurchasingBackendService(client: SupabaseBrowserClientLike | null) {
  return {
    async validateInvoice(invoice: Partial<PurchaseInvoiceBackendRecord>) {
      const validation = validatePurchaseInvoice(invoice);
      return { ok: validation.ok, message: validation.ok ? "Purchase invoice validated." : "Purchase invoice blocked.", data: validation };
    },

    async createInvoice(invoice: Partial<PurchaseInvoiceBackendRecord>) {
      const validation = validatePurchaseInvoice(invoice);
      if (!validation.ok) return { ok: false, message: "Validation failed.", error: "VALIDATION_FAILED", data: validation };
      if (!client) return { ok: false, message: "Supabase client is not configured.", error: "MISSING_SUPABASE_CLIENT" };

      const { data, error } = await client.from("purchase_invoices").insert(invoice).select("*").single();
      return error ? { ok: false, message: "Create purchase invoice failed.", error: error.message } : { ok: true, message: "Purchase invoice created.", data };
    },

    async postInvoice(invoiceId: string) {
      if (!client) return { ok: false, message: "Supabase client is not configured.", error: "MISSING_SUPABASE_CLIENT" };
      const { data, error } = await client.rpc("purchasing_post_purchase_invoice", { invoice_id: invoiceId });
      return error ? { ok: false, message: "Post purchase invoice failed.", error: error.message } : { ok: true, message: "Purchase invoice posted.", data };
    },

    async validatePayment(payment: Partial<SupplierPaymentBackendRecord>) {
      const validation = validateSupplierPayment(payment);
      return { ok: validation.ok, message: validation.ok ? "Supplier payment validated." : "Supplier payment blocked.", data: validation };
    },

    async postSupplierPayment(paymentId: string) {
      if (!client) return { ok: false, message: "Supabase client is not configured.", error: "MISSING_SUPABASE_CLIENT" };
      const { data, error } = await client.rpc("purchasing_post_supplier_payment", { payment_id: paymentId });
      return error ? { ok: false, message: "Post supplier payment failed.", error: error.message } : { ok: true, message: "Supplier payment posted.", data };
    },
  };
}
