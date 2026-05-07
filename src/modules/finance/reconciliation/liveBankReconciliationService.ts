import type { SupabaseBrowserClientLike } from "../../../lib/supabase/supabaseClient";
import type { LiveBankReconciliationMatch, LiveBankStatementImport } from "./liveBankReconciliation";
import { validateLiveBankReconciliationMatch, validateLiveBankStatementImport } from "./liveBankReconciliation";

export function createLiveBankReconciliationService(client: SupabaseBrowserClientLike | null) {
  return {
    validateStatementImport(statement: LiveBankStatementImport) {
      return validateLiveBankStatementImport(statement);
    },

    validateMatch(match: LiveBankReconciliationMatch) {
      return validateLiveBankReconciliationMatch(match);
    },

    async importStatement(statement: LiveBankStatementImport) {
      const validation = validateLiveBankStatementImport(statement);

      if (!validation.ok) {
        return {
          ok: false,
          message: "Bank statement import validation failed.",
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

      const { data, error } = await client.rpc("live_bank_import_statement", {
        statement_payload: {
          import_no: statement.importNo,
          bank_account_id: statement.bankAccountId ?? null,
          account_code: statement.accountCode ?? null,
          period_start: statement.periodStart,
          period_end: statement.periodEnd,
        },
        lines_payload: statement.lines.map((line) => ({
          bank_account_id: line.bankAccountId ?? statement.bankAccountId ?? null,
          account_code: line.accountCode ?? statement.accountCode ?? null,
          statement_date: line.statementDate,
          description: line.description,
          amount: line.amount,
          reference: line.reference ?? null,
        })),
      });

      return error
        ? { ok: false, message: "Bank statement import failed.", error: error.message }
        : { ok: true, message: "Bank statement imported.", data };
    },

    async matchStatementLine(match: LiveBankReconciliationMatch) {
      const validation = validateLiveBankReconciliationMatch(match);

      if (!validation.ok) {
        return {
          ok: false,
          message: "Bank reconciliation match validation failed.",
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

      const { data, error } = await client.rpc("live_bank_match_statement_line", {
        statement_line_id: match.statementLineId,
        journal_line_id: match.journalLineId,
        matched_amount: match.matchedAmount,
        notes: match.notes ?? null,
      });

      return error
        ? { ok: false, message: "Bank reconciliation match failed.", error: error.message }
        : { ok: true, message: "Bank statement line matched.", data };
    },

    async createReconciliationRun(bankAccountId: string, periodStart: string, periodEnd: string) {
      if (!client) {
        return {
          ok: false,
          message: "Supabase client is not configured.",
          error: "MISSING_SUPABASE_CLIENT",
        };
      }

      const { data, error } = await client.rpc("live_bank_create_reconciliation_run", {
        bank_account_id: bankAccountId,
        period_start: periodStart,
        period_end: periodEnd,
      });

      return error
        ? { ok: false, message: "Bank reconciliation run failed.", error: error.message }
        : { ok: true, message: "Bank reconciliation run created.", data };
    },
  };
}
