import type { SupabaseBrowserClientLike } from "../../../lib/supabase/supabaseClient";
import type { LivePeriodCloseRequest } from "./livePeriodClose";
import { validateLivePeriodClose } from "./livePeriodClose";

export function createLivePeriodCloseService(client: SupabaseBrowserClientLike | null) {
  return {
    validate(request: LivePeriodCloseRequest) {
      return validateLivePeriodClose(request);
    },

    async requestClose(request: LivePeriodCloseRequest) {
      const validation = validateLivePeriodClose(request);

      if (!validation.ok) {
        return {
          ok: false,
          message: "Period close validation failed.",
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

      const { data, error } = await client.rpc("live_finance_request_period_close", {
        close_payload: {
          close_no: request.closeNo,
          fiscal_period_id: request.fiscalPeriodId,
          branch_id: request.branchId ?? null,
          requested_by_note: request.requestedBy ?? null,
          backup_confirmed: request.backupConfirmed,
          trial_balance_balanced: request.trialBalanceBalanced,
          inventory_reconciled: request.inventoryReconciled,
          ap_reconciled: request.apReconciled,
          ar_reconciled: request.arReconciled,
          bank_reconciled: request.bankReconciled,
          vat_reviewed: request.vatReviewed,
        },
      });

      return error
        ? { ok: false, message: "Period close request failed.", error: error.message }
        : { ok: true, message: "Period close requested.", data };
    },
  };
}
