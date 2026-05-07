import type { SupabaseBrowserClientLike } from "../../../lib/supabase/supabaseClient";
import type { OpeningBalanceBatch } from "./openingBalanceTypes";
import { validateOpeningBalanceBatch } from "./openingBalanceTypes";

export function createOpeningBalanceService(client: SupabaseBrowserClientLike | null) {
  return {
    validate(batch: OpeningBalanceBatch) {
      return validateOpeningBalanceBatch(batch);
    },

    async postOpeningBalance(batch: OpeningBalanceBatch) {
      const validation = validateOpeningBalanceBatch(batch);

      if (!validation.ok) {
        return {
          ok: false,
          message: "Opening balance validation failed.",
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

      const { data, error } = await client.rpc("live_finance_post_opening_balance", {
        batch_payload: {
          batch_no: batch.batchNo,
          fiscal_period_id: batch.fiscalPeriodId,
          branch_id: batch.branchId ?? null,
          opening_date: batch.openingDate,
        },
        lines_payload: batch.lines.map((line) => ({
          account_code: line.accountCode,
          branch_id: line.branchId ?? batch.branchId ?? null,
          debit: line.debit,
          credit: line.credit,
          memo: line.memo ?? null,
        })),
      });

      return error
        ? { ok: false, message: "Opening balance posting failed.", error: error.message }
        : { ok: true, message: "Opening balance posted.", data };
    },
  };
}
