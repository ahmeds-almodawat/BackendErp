import type { SupabaseBrowserClientLike } from "../../../lib/supabase/supabaseClient";
import type { LivePosImportBatch } from "./livePosImport";
import { validateLivePosImport } from "./livePosImport";

export function createLivePosImportService(client: SupabaseBrowserClientLike | null) {
  return {
    validate(batch: LivePosImportBatch) {
      return validateLivePosImport(batch);
    },

    async registerImport(batch: LivePosImportBatch) {
      const validation = validateLivePosImport(batch);

      if (!validation.ok) {
        return {
          ok: false,
          message: "POS import validation failed.",
          data: validation,
          error: "VALIDATION_FAILED",
        };
      }

      if (!client) {
        return {
          ok: false,
          message: "Supabase client is not configured.",
          error: "MISSING_SUPABASE_CLIENT",
        };
      }

      const { data, error } = await client.rpc("live_sales_register_pos_import", {
        batch_payload: {
          batch_no: batch.batchNo,
          branch_id: batch.branchId ?? null,
          business_date: batch.businessDate,
          source_system: batch.sourceSystem,
        },
        product_lines_payload: batch.productLines.map((line) => ({
          product_code: line.productCode ?? null,
          sku: line.sku ?? null,
          product_name: line.productName ?? null,
          category_code: line.categoryCode ?? null,
          quantity: line.quantity,
          gross_sales: line.grossSales,
          discount_amount: line.discountAmount,
          refund_amount: line.refundAmount,
          tax_amount: line.taxAmount,
          net_sales: line.netSales,
        })),
        payment_lines_payload: batch.paymentLines.map((line) => ({
          payment_method: line.paymentMethod,
          amount: line.amount,
          reference: line.reference ?? null,
        })),
      });

      return error
        ? { ok: false, message: "POS import registration failed.", error: error.message }
        : { ok: true, message: "POS import registered.", data };
    },
  };
}
