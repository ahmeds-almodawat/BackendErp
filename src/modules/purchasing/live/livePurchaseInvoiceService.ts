import type { SupabaseBrowserClientLike } from "../../../lib/supabase/supabaseClient";
import type { LivePurchaseInvoice } from "./livePurchaseInvoice";
import { validateLivePurchaseInvoice } from "./livePurchaseInvoice";

export function createLivePurchaseInvoiceService(client: SupabaseBrowserClientLike | null) {
  return {
    validate(invoice: LivePurchaseInvoice) {
      return validateLivePurchaseInvoice(invoice);
    },

    async postInvoice(invoice: LivePurchaseInvoice) {
      const validation = validateLivePurchaseInvoice(invoice);

      if (!validation.ok) {
        return {
          ok: false,
          message: "Purchase invoice validation failed.",
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

      const { data, error } = await client.rpc("live_purchasing_post_purchase_invoice", {
        invoice_payload: {
          invoice_no: invoice.invoiceNo,
          supplier_id: invoice.supplierId ?? null,
          branch_id: invoice.branchId ?? null,
          store_id: invoice.storeId ?? null,
          invoice_date: invoice.invoiceDate,
          due_date: invoice.dueDate ?? null,
        },
        lines_payload: invoice.lines.map((line) => ({
          sku: line.sku ?? null,
          item_id: line.itemId ?? null,
          account_code: line.accountCode ?? null,
          quantity: line.quantity,
          unit_cost: line.unitCost,
          discount_amount: line.discountAmount,
          tax_amount: line.taxAmount,
        })),
      });

      return error
        ? { ok: false, message: "Purchase invoice posting failed.", error: error.message }
        : { ok: true, message: "Purchase invoice posted.", data };
    },
  };
}
