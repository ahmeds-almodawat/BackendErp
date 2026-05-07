import { getSupabaseClient, isSupabaseConfigured, assertNoServiceRoleInFrontend } from "./supabaseClient";
import { productionConfig, assertProductionCanUseBackend } from "../config/productionConfig";

export type BackendHealthStatus = "ready" | "warning" | "blocked" | "not_configured";

export interface BackendHealthFinding {
  severity: "info" | "warning" | "critical";
  message: string;
  action: string;
}

export interface BackendHealthSummary {
  ok: boolean;
  status: BackendHealthStatus;
  message: string;
  findings: BackendHealthFinding[];
  checkedAt: string;
}

export function checkBackendEnvironmentGate(): BackendHealthSummary {
  const findings: BackendHealthFinding[] = [];

  for (const finding of assertNoServiceRoleInFrontend()) {
    findings.push({
      severity: "critical",
      message: finding,
      action: "Remove service role/service key from frontend environment variables.",
    });
  }

  if (!isSupabaseConfigured()) {
    findings.push({
      severity: productionConfig.runtimeMode === "production" ? "critical" : "warning",
      message: "Supabase frontend URL or anon key is missing.",
      action: "Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to .env.local for backend mode.",
    });
  }

  for (const finding of assertProductionCanUseBackend(isSupabaseConfigured())) {
    findings.push({
      severity: "critical",
      message: finding,
      action: "Fix production configuration before using real users or financial posting.",
    });
  }

  const criticalCount = findings.filter((finding) => finding.severity === "critical").length;
  const warningCount = findings.filter((finding) => finding.severity === "warning").length;

  return {
    ok: criticalCount === 0 && isSupabaseConfigured(),
    status: criticalCount > 0 ? "blocked" : warningCount > 0 ? "not_configured" : "ready",
    message:
      criticalCount > 0
        ? "Backend environment is unsafe."
        : warningCount > 0
          ? productionConfig.runtimeMode === "production"
            ? "Backend environment is not fully configured and production startup is blocked."
            : "Backend environment is not fully configured; local-demo fallback remains available outside production."
          : "Backend environment is configured.",
    findings,
    checkedAt: new Date().toISOString(),
  };
}

export async function checkBackendConnectionGate(): Promise<BackendHealthSummary> {
  const environment = checkBackendEnvironmentGate();

  if (!environment.ok) {
    return environment;
  }

  const client = getSupabaseClient();

  if (!client) {
    return {
      ok: false,
      status: "blocked",
      message: "Supabase client could not be created.",
      findings: [
        {
          severity: "critical",
          message: "Client creation failed even though environment appears configured.",
          action: "Verify VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.",
        },
      ],
      checkedAt: new Date().toISOString(),
    };
  }

  try {
    const { error } = await client.rpc("ops_get_production_readiness_summary", {});

    if (error) {
      return {
        ok: false,
        status: "warning",
        message: "Supabase connected, but backend readiness RPC is unavailable or blocked.",
        findings: [
          {
            severity: "warning",
            message: error.message ?? "Backend readiness RPC failed.",
            action: "Apply migrations and verify RLS/function grants on staging.",
          },
        ],
        checkedAt: new Date().toISOString(),
      };
    }

    return {
      ok: true,
      status: "ready",
      message: "Supabase connection and readiness RPC responded.",
      findings: [],
      checkedAt: new Date().toISOString(),
    };
  } catch (error) {
    return {
      ok: false,
      status: "warning",
      message: "Supabase connection check failed.",
      findings: [
        {
          severity: "warning",
          message: error instanceof Error ? error.message : "Unknown connection error.",
          action: "Verify network, Supabase URL, anon key, and migration status.",
        },
      ],
      checkedAt: new Date().toISOString(),
    };
  }
}
