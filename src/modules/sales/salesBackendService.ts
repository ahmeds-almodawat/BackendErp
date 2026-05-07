import type { SupabaseBrowserClientLike } from "../../lib/supabase/supabaseClient";
import type { SalesPosBatchBackendRecord, SalesValidationFinding } from "./salesBackendTypes";

function required(value: unknown): boolean {
  return value !== undefined && value !== null && String(value).trim().length > 0;
}

function summarize(findings: SalesValidationFinding[]) {
  const criticalCount = findings.filter((finding) => finding.severity === "critical").length;
  const warningCount = findings.filter((finding) => finding.severity === "warning").length;
  return { ok: criticalCount === 0, criticalCount, warningCount, findings };
}

export function validateSalesPosBatch(batch: Partial<SalesPosBatchBackendRecord>) {
  const findings: SalesValidationFinding[] = [];

  if (!required(batch.batch_no)) findings.push({ severity: "critical", field: "batch_no", message: "Sales batch number is required.", action: "Create a unique POS batch reference." });
  if (!required(batch.branch_id)) findings.push({ severity: "critical", field: "branch_id", message: "Branch is required.", action: "Map POS batch to a branch." });
  if (!required(batch.business_date)) findings.push({ severity: "critical", field: "business_date", message: "Business date is required.", action: "Set the POS business date." });
  if (!Number.isFinite(batch.total_sales) || Number(batch.total_sales) < 0) findings.push({ severity: "critical", field: "total_sales", message: "Sales total cannot be negative.", action: "Correct sales total." });
  if (!Number.isFinite(batch.total_payments) || Number(batch.total_payments) < 0) findings.push({ severity: "critical", field: "total_payments", message: "Payment total cannot be negative.", action: "Correct payment total." });

  const netSales = Number(batch.total_sales ?? 0) + Number(batch.total_tax ?? 0) - Number(batch.total_discount ?? 0) - Number(batch.total_refunds ?? 0);
  const paymentDiff = Number((netSales - Number(batch.total_payments ?? 0)).toFixed(2));

  if (Math.abs(paymentDiff) > 1) {
    findings.push({
      severity: "warning",
      field: "total_payments",
      message: `Sales/payment difference detected: ${paymentDiff}.`,
      action: "Review POS payments, refunds, discounts, and tax mapping before posting.",
    });
  }

  return summarize(findings);
}

export function createSalesBackendService(client: SupabaseBrowserClientLike | null) {
  return {
    async validateSalesBatch(batch: Partial<SalesPosBatchBackendRecord>) {
      const validation = validateSalesPosBatch(batch);
      return { ok: validation.ok, message: validation.ok ? "Sales batch validated." : "Sales batch blocked.", data: validation };
    },

    async createSalesBatch(batch: Partial<SalesPosBatchBackendRecord>) {
      const validation = validateSalesPosBatch(batch);
      if (!validation.ok) return { ok: false, message: "Validation failed.", error: "VALIDATION_FAILED", data: validation };
      if (!client) return { ok: false, message: "Supabase client is not configured.", error: "MISSING_SUPABASE_CLIENT" };

      const { data, error } = await client.from("sales_pos_batches").insert(batch).select("*").single();
      return error ? { ok: false, message: "Create POS batch failed.", error: error.message } : { ok: true, message: "POS batch created.", data };
    },

    async postSalesBatch(batchId: string) {
      if (!client) return { ok: false, message: "Supabase client is not configured.", error: "MISSING_SUPABASE_CLIENT" };
      const { data, error } = await client.rpc("sales_post_pos_batch", { batch_id: batchId });
      return error ? { ok: false, message: "Post POS batch failed.", error: error.message } : { ok: true, message: "POS batch posted.", data };
    },

    async reconcileSalesBatch(batchId: string) {
      if (!client) return { ok: false, message: "Supabase client is not configured.", error: "MISSING_SUPABASE_CLIENT" };
      const { data, error } = await client.rpc("sales_reconcile_pos_batch", { batch_id: batchId });
      return error ? { ok: false, message: "POS reconciliation failed.", error: error.message } : { ok: true, message: "POS batch reconciled.", data };
    },
  };
}
