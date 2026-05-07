import type { SupabaseBrowserClientLike } from "../../lib/supabase/supabaseClient";

export type LiveErrorSeverity = "info" | "warning" | "error" | "critical";

export interface LiveErrorLogRequest {
  severity: LiveErrorSeverity;
  module: string;
  message: string;
  userMessage?: string;
  metadata?: Record<string, unknown>;
}

export function createSupportReference(date = new Date()) {
  return `SUP-${date.getFullYear()}-${date.getTime().toString(36).toUpperCase()}`;
}

export function createUserSafeSupportMessage(referenceId: string) {
  return `Action failed. Please contact support with reference ${referenceId}.`;
}

export function createLiveErrorLoggingService(client: SupabaseBrowserClientLike | null) {
  return {
    async logError(request: LiveErrorLogRequest) {
      const referenceId = createSupportReference();

      if (!client) {
        return {
          ok: false,
          message: "Supabase client is not configured.",
          referenceId,
          userMessage: createUserSafeSupportMessage(referenceId),
          error: "MISSING_SUPABASE_CLIENT",
        };
      }

      const { data, error } = await client.rpc("live_support_log_error", {
        error_payload: {
          reference_id: referenceId,
          severity: request.severity,
          module: request.module,
          message: request.message,
          user_message: request.userMessage ?? createUserSafeSupportMessage(referenceId),
          metadata: request.metadata ?? {},
        },
      });

      return error
        ? { ok: false, message: "Error logging failed.", referenceId, error: error.message }
        : { ok: true, message: "Error logged.", referenceId, data };
    },
  };
}
