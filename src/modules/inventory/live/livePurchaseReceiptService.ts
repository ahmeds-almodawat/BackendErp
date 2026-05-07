import type { SupabaseBrowserClientLike } from "../../../lib/supabase/supabaseClient";
import type { LivePurchaseReceipt } from "./livePurchaseReceipt";
import { validateLivePurchaseReceipt } from "./livePurchaseReceipt";

export function createLivePurchaseReceiptService(client: SupabaseBrowserClientLike | null) {
  return {
    validate(receipt: LivePurchaseReceipt) {
      return validateLivePurchaseReceipt(receipt);
    },

    async postReceipt(receipt: LivePurchaseReceipt) {
      const validation = validateLivePurchaseReceipt(receipt);

      if (!validation.ok) {
        return {
          ok: false,
          message: "Purchase receipt validation failed.",
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

      const { data, error } = await client.rpc("live_inventory_post_purchase_receipt", {
        receipt_payload: {
          receipt_no: receipt.receiptNo,
          supplier_id: receipt.supplierId ?? null,
          branch_id: receipt.branchId ?? null,
          store_id: receipt.storeId ?? null,
          receipt_date: receipt.receiptDate,
          purchase_invoice_id: receipt.purchaseInvoiceId ?? null,
        },
        lines_payload: receipt.lines.map((line) => ({
          sku: line.sku,
          item_id: line.itemId ?? null,
          quantity: line.quantity,
          unit_cost: line.unitCost,
          lot_no: line.lotNo ?? null,
          expiry_date: line.expiryDate ?? null,
        })),
      });

      return error
        ? { ok: false, message: "Purchase receipt posting failed.", error: error.message }
        : { ok: true, message: "Purchase receipt posted.", data };
    },
  };
}
