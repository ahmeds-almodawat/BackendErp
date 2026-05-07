import type { SupabaseBrowserClientLike } from "../../../lib/supabase/supabaseClient";
import type { BankStatementLine } from "./bankReconciliationTypes";
import { summarizeBankReconciliation } from "./bankReconciliationTypes";

export function createBankReconciliationService(client: SupabaseBrowserClientLike | null) {
  return {
    summarizeLocal(lines: BankStatementLine[]) {
      return summarizeBankReconciliation(lines);
    },

    async importStatementLine(input: Record<string, unknown>) {
      if (!client) {
        return {
          ok: false,
          message: "Supabase client is not configured.",
          error: "MISSING_SUPABASE_CLIENT",
        };
      }

      const { data, error } = await client.from("bank_statement_lines").insert(input).select("*").single();

      return error
        ? { ok: false, message: "Statement line import failed.", error: error.message }
        : { ok: true, message: "Statement line imported.", data };
    },

    async reconcileStatementLine(statementLineId: string, journalLineId: string) {
      if (!client) {
        return {
          ok: false,
          message: "Supabase client is not configured.",
          error: "MISSING_SUPABASE_CLIENT",
        };
      }

      const { data, error } = await client.rpc("finance_reconcile_bank_statement_line", {
        statement_line_id: statementLineId,
        journal_line_id: journalLineId,
      });

      return error
        ? { ok: false, message: "Bank statement reconciliation failed.", error: error.message }
        : { ok: true, message: "Bank statement line reconciled.", data };
    },
  };
}
