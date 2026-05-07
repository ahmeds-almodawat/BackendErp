import type { SupabaseBrowserClientLike } from "../../../lib/supabase/supabaseClient";
import type { GlReportRequest } from "./glLiveReportTypes";
import { validateGlReportRequest } from "./glLiveReportTypes";

export function createGlLiveReportService(client: SupabaseBrowserClientLike | null) {
  return {
    validate(request: GlReportRequest) {
      return validateGlReportRequest(request);
    },

    async runReport(request: GlReportRequest) {
      const validation = validateGlReportRequest(request);

      if (!validation.ok) {
        return {
          ok: false,
          message: "GL report request validation failed.",
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

      const { data, error } = await client.rpc("live_finance_run_gl_report", {
        report_type: request.reportType,
        period_start: request.periodStart,
        period_end: request.periodEnd,
        branch_id: request.branchId ?? null,
      });

      return error
        ? { ok: false, message: "GL report failed.", error: error.message }
        : { ok: true, message: "GL report generated.", data };
    },
  };
}
