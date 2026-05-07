import type { SupabaseBrowserClientLike } from "../../lib/supabase/supabaseClient";
import type { ProductionBatchBackendRecord, ProductionValidationFinding } from "./productionBackendTypes";

function required(value: unknown): boolean {
  return value !== undefined && value !== null && String(value).trim().length > 0;
}

function summarize(findings: ProductionValidationFinding[]) {
  const criticalCount = findings.filter((finding) => finding.severity === "critical").length;
  const warningCount = findings.filter((finding) => finding.severity === "warning").length;
  return { ok: criticalCount === 0, criticalCount, warningCount, findings };
}

export function validateProductionBatch(batch: Partial<ProductionBatchBackendRecord>) {
  const findings: ProductionValidationFinding[] = [];

  if (!required(batch.batch_no)) findings.push({ severity: "critical", field: "batch_no", message: "Production batch number is required.", action: "Create a unique production batch reference." });
  if (!required(batch.branch_id)) findings.push({ severity: "critical", field: "branch_id", message: "Branch is required.", action: "Map production to a branch." });
  if (!required(batch.source_store_id)) findings.push({ severity: "critical", field: "source_store_id", message: "Source store is required.", action: "Select ingredient source store." });
  if (!required(batch.destination_store_id)) findings.push({ severity: "critical", field: "destination_store_id", message: "Destination store is required.", action: "Select output destination store." });
  if (!required(batch.output_item_id)) findings.push({ severity: "critical", field: "output_item_id", message: "Output item is required.", action: "Select produced item." });
  if (!Number.isFinite(batch.actual_output_quantity) || Number(batch.actual_output_quantity) <= 0) findings.push({ severity: "critical", field: "actual_output_quantity", message: "Actual output quantity must be positive.", action: "Enter actual production yield." });

  const planned = Number(batch.planned_output_quantity ?? 0);
  const actual = Number(batch.actual_output_quantity ?? 0);

  if (planned > 0 && actual > 0) {
    const variancePercent = Math.abs((actual - planned) / planned) * 100;
    if (variancePercent > 10) {
      findings.push({
        severity: "warning",
        field: "actual_output_quantity",
        message: `Production yield variance is ${variancePercent.toFixed(1)}%.`,
        action: "Review wastage, recipe, and production output before posting.",
      });
    }
  }

  return summarize(findings);
}

export function createProductionBackendService(client: SupabaseBrowserClientLike | null) {
  return {
    async validateProductionBatch(batch: Partial<ProductionBatchBackendRecord>) {
      const validation = validateProductionBatch(batch);
      return { ok: validation.ok, message: validation.ok ? "Production batch validated." : "Production batch blocked.", data: validation };
    },

    async createProductionBatch(batch: Partial<ProductionBatchBackendRecord>) {
      const validation = validateProductionBatch(batch);
      if (!validation.ok) return { ok: false, message: "Validation failed.", error: "VALIDATION_FAILED", data: validation };
      if (!client) return { ok: false, message: "Supabase client is not configured.", error: "MISSING_SUPABASE_CLIENT" };

      const { data, error } = await client.from("production_batches").insert(batch).select("*").single();
      return error ? { ok: false, message: "Create production batch failed.", error: error.message } : { ok: true, message: "Production batch created.", data };
    },

    async postProductionBatch(batchId: string) {
      if (!client) return { ok: false, message: "Supabase client is not configured.", error: "MISSING_SUPABASE_CLIENT" };
      const { data, error } = await client.rpc("production_post_batch", { batch_id: batchId });
      return error ? { ok: false, message: "Post production batch failed.", error: error.message } : { ok: true, message: "Production batch posted.", data };
    },
  };
}
