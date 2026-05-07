import type { SupabaseBrowserClientLike } from "../../../lib/supabase/supabaseClient";
import type {
  FinanceJournalEntryBackendRecord,
  FinanceJournalLineBackendRecord,
} from "./financeBackendTypes";
import { validateJournalEntry } from "./financeJournalValidation";

export interface FinanceJournalBackendResult<T = unknown> {
  ok: boolean;
  message: string;
  data?: T;
  error?: string;
}

export function createFinanceJournalBackendService(client: SupabaseBrowserClientLike | null) {
  return {
    async validateJournal(
      journal: Partial<FinanceJournalEntryBackendRecord>,
      lines: Partial<FinanceJournalLineBackendRecord>[],
    ): Promise<FinanceJournalBackendResult> {
      const validation = validateJournalEntry(journal, lines);

      return {
        ok: validation.ok,
        message: validation.ok ? "Journal validated." : "Journal has blocking findings.",
        data: validation,
      };
    },

    async createJournal(
      journal: Partial<FinanceJournalEntryBackendRecord>,
      lines: Partial<FinanceJournalLineBackendRecord>[],
    ): Promise<FinanceJournalBackendResult> {
      const validation = validateJournalEntry(journal, lines);

      if (!validation.ok) {
        return {
          ok: false,
          message: "Journal validation failed.",
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

      const { data, error } = await client.rpc("finance_create_journal_with_lines", {
        journal_payload: journal,
        lines_payload: lines,
      });

      return error
        ? { ok: false, message: "Journal creation failed.", error: error.message }
        : { ok: true, message: "Journal created.", data };
    },

    async postJournal(journalId: string): Promise<FinanceJournalBackendResult> {
      if (!client) {
        return {
          ok: false,
          message: "Supabase client is not configured.",
          error: "MISSING_SUPABASE_CLIENT",
        };
      }

      const { data, error } = await client.rpc("finance_post_journal", { journal_id: journalId });

      return error
        ? { ok: false, message: "Journal posting failed.", error: error.message }
        : { ok: true, message: "Journal posted.", data };
    },

    async reverseJournal(journalId: string, reason: string): Promise<FinanceJournalBackendResult> {
      if (!client) {
        return {
          ok: false,
          message: "Supabase client is not configured.",
          error: "MISSING_SUPABASE_CLIENT",
        };
      }

      const { data, error } = await client.rpc("finance_reverse_journal", {
        journal_id: journalId,
        reversal_reason: reason,
      });

      return error
        ? { ok: false, message: "Journal reversal failed.", error: error.message }
        : { ok: true, message: "Journal reversed.", data };
    },
  };
}
