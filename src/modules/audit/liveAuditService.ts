import type { SupabaseBrowserClientLike } from "../../lib/supabase/supabaseClient";

export type AuditActionRisk = "low" | "medium" | "high" | "critical";

export interface LiveAuditEventRequest {
  module: string;
  action: string;
  recordType?: string;
  recordId?: string;
  branchId?: string;
  risk: AuditActionRisk;
  before?: Record<string, unknown>;
  after?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
}

export const criticalAuditActions = [
  "post",
  "reverse",
  "approve",
  "import",
  "rollback",
  "change_permission",
  "change_setting",
  "close_period",
];

export function isCriticalAuditAction(action: string) {
  return criticalAuditActions.includes(action);
}

export function createLiveAuditService(client: SupabaseBrowserClientLike | null) {
  return {
    async logEvent(request: LiveAuditEventRequest) {
      if (!client) {
        return {
          ok: false,
          message: "Supabase client is not configured.",
          error: "MISSING_SUPABASE_CLIENT",
        };
      }

      const { data, error } = await client.rpc("live_audit_log_event", {
        audit_payload: {
          module: request.module,
          action: request.action,
          record_type: request.recordType ?? null,
          record_id: request.recordId ?? null,
          branch_id: request.branchId ?? null,
          risk: request.risk,
          before_snapshot: request.before ?? null,
          after_snapshot: request.after ?? null,
          metadata: request.metadata ?? {},
        },
      });

      return error
        ? { ok: false, message: "Audit event logging failed.", error: error.message }
        : { ok: true, message: "Audit event logged.", data };
    },
  };
}
