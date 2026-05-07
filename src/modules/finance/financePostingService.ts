import type { SupabaseBrowserClientLike } from "../../lib/supabase/supabaseClient";

export interface FinancePostingServiceResult {
  ok: boolean;
  message: string;
  data?: unknown;
  error?: string;
}

export interface FinancePostingService {
  validatePostingBatch(batchId: string): Promise<FinancePostingServiceResult>;
  createPostingBatch(input: Record<string, unknown>): Promise<FinancePostingServiceResult>;
  postPostingBatch(batchId: string): Promise<FinancePostingServiceResult>;
  reversePostingBatch(batchId: string, reason: string): Promise<FinancePostingServiceResult>;
}

export function createFinancePostingService(client: SupabaseBrowserClientLike | null): FinancePostingService {
  return {
    async validatePostingBatch(batchId: string) {
      if (!client) {
        return {
          ok: false,
          message: "Supabase client is not configured.",
          error: "MISSING_SUPABASE_CLIENT",
        };
      }

      const { data, error } = await client.rpc("finance_validate_posting_batch", { batch_id: batchId });

      return error
        ? { ok: false, message: "Posting validation failed.", error: error.message }
        : { ok: true, message: "Posting validation completed.", data };
    },

    async createPostingBatch(input: Record<string, unknown>) {
      if (!client) {
        return {
          ok: false,
          message: "Supabase client is not configured.",
          error: "MISSING_SUPABASE_CLIENT",
        };
      }

      const { data, error } = await client.from("posting_batches").insert(input).select("*").single();

      return error
        ? { ok: false, message: "Posting batch creation failed.", error: error.message }
        : { ok: true, message: "Posting batch created.", data };
    },

    async postPostingBatch(batchId: string) {
      return {
        ok: false,
        message: `Posting batch ${batchId} requires a dedicated server RPC in the next cutover step.`,
        error: "POST_RPC_NOT_WIRED",
      };
    },

    async reversePostingBatch(batchId: string, reason: string) {
      return {
        ok: false,
        message: `Reversal for batch ${batchId} requires server-side reversal RPC. Reason captured: ${reason}`,
        error: "REVERSAL_RPC_NOT_WIRED",
      };
    },
  };
}
