import type { SupabaseBrowserClientLike } from "../../../lib/supabase/supabaseClient";
import type { LiveSupplierPayment } from "./liveSupplierPayment";
import { validateLiveSupplierPayment } from "./liveSupplierPayment";

export function createLiveSupplierPaymentService(client: SupabaseBrowserClientLike | null) {
  return {
    validate(payment: LiveSupplierPayment) {
      return validateLiveSupplierPayment(payment);
    },

    async postPayment(payment: LiveSupplierPayment) {
      const validation = validateLiveSupplierPayment(payment);

      if (!validation.ok) {
        return {
          ok: false,
          message: "Supplier payment validation failed.",
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

      const { data, error } = await client.rpc("live_purchasing_post_supplier_payment", {
        payment_payload: {
          payment_no: payment.paymentNo,
          supplier_id: payment.supplierId ?? null,
          branch_id: payment.branchId ?? null,
          payment_date: payment.paymentDate,
          amount: payment.amount,
          method: payment.method,
          account_code: payment.accountCode,
          memo: payment.memo ?? null,
        },
      });

      return error
        ? { ok: false, message: "Supplier payment posting failed.", error: error.message }
        : { ok: true, message: "Supplier payment posted.", data };
    },
  };
}
