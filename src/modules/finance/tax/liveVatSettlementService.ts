import type { SupabaseBrowserClientLike } from "../../../lib/supabase/supabaseClient";
import type { LiveVatAdjustment, LiveVatSettlementRequest } from "./liveVatSettlement";
import { validateLiveVatAdjustment, validateLiveVatSettlement } from "./liveVatSettlement";

export function createLiveVatSettlementService(client: SupabaseBrowserClientLike | null) {
  return {
    validateSettlement(request: LiveVatSettlementRequest) {
      return validateLiveVatSettlement(request);
    },

    validateAdjustment(adjustment: LiveVatAdjustment) {
      return validateLiveVatAdjustment(adjustment);
    },

    async createSettlement(request: LiveVatSettlementRequest) {
      const validation = validateLiveVatSettlement(request);

      if (!validation.ok) {
        return {
          ok: false,
          message: "VAT settlement validation failed.",
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

      const { data, error } = await client.rpc("live_vat_create_settlement", {
        settlement_payload: {
          settlement_no: request.settlementNo,
          period_start: request.periodStart,
          period_end: request.periodEnd,
          branch_id: request.branchId ?? null,
          reviewed_by_note: request.reviewedBy ?? null,
        },
      });

      return error
        ? { ok: false, message: "VAT settlement creation failed.", error: error.message }
        : { ok: true, message: "VAT settlement created.", data };
    },

    async postAdjustment(adjustment: LiveVatAdjustment) {
      const validation = validateLiveVatAdjustment(adjustment);

      if (!validation.ok) {
        return {
          ok: false,
          message: "VAT adjustment validation failed.",
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

      const { data, error } = await client.rpc("live_vat_post_adjustment", {
        adjustment_payload: {
          source_id: adjustment.sourceId ?? null,
          direction: adjustment.direction,
          taxable_amount: adjustment.taxableAmount,
          vat_amount: adjustment.vatAmount,
          reason: adjustment.reason,
        },
      });

      return error
        ? { ok: false, message: "VAT adjustment posting failed.", error: error.message }
        : { ok: true, message: "VAT adjustment posted.", data };
    },
  };
}
