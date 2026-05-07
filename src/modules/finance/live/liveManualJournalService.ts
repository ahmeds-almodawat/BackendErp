import type { SupabaseBrowserClientLike } from "../../../lib/supabase/supabaseClient";
import type { LiveManualJournalRequest } from "./liveManualJournal";
import { validateLiveManualJournal } from "./liveManualJournal";

export function createLiveManualJournalService(client: SupabaseBrowserClientLike | null) {
  return {
    validate(request: LiveManualJournalRequest) {
      return validateLiveManualJournal(request);
    },

    async createAndPost(request: LiveManualJournalRequest) {
      const validation = validateLiveManualJournal(request);

      if (!validation.ok) {
        return {
          ok: false,
          message: "Manual journal validation failed.",
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

      const { data, error } = await client.rpc("live_finance_create_and_post_manual_journal", {
        journal_payload: {
          journal_no: request.journalNo,
          journal_date: request.journalDate,
          branch_id: request.branchId ?? null,
          fiscal_period_id: request.fiscalPeriodId ?? null,
          description: request.description,
        },
        lines_payload: request.lines.map((line) => ({
          account_code: line.accountCode,
          branch_id: line.branchId ?? request.branchId ?? null,
          debit: line.debit,
          credit: line.credit,
          memo: line.memo ?? null,
        })),
      });

      return error
        ? { ok: false, message: "Live manual journal posting failed.", error: error.message }
        : { ok: true, message: "Live manual journal posted.", data };
    },
  };
}
