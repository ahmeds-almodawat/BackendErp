import { assertNoServiceRoleInFrontend, isSupabaseConfigured } from "./supabaseClient";

export type SupabaseHealthStatus = "configured" | "missing_env" | "unsafe" | "unknown";

export interface SupabaseHealthResult {
  ok: boolean;
  status: SupabaseHealthStatus;
  message: string;
  findings: string[];
}

export function checkSupabaseEnvironment(): SupabaseHealthResult {
  const findings = [...assertNoServiceRoleInFrontend()];

  if (!isSupabaseConfigured()) {
    findings.push("Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY.");
  }

  if (findings.some((finding) => finding.includes("Service role"))) {
    return {
      ok: false,
      status: "unsafe",
      message: "Supabase frontend environment is unsafe.",
      findings,
    };
  }

  if (findings.length > 0) {
    return {
      ok: false,
      status: "missing_env",
      message: "Supabase is not configured. Local demo mode will be used.",
      findings,
    };
  }

  return {
    ok: true,
    status: "configured",
    message: "Supabase environment variables are configured.",
    findings: [],
  };
}

export async function checkSupabaseConnection(): Promise<SupabaseHealthResult> {
  const env = checkSupabaseEnvironment();

  if (!env.ok) {
    return env;
  }

  return {
    ok: true,
    status: "configured",
    message: "Supabase appears configured. Runtime connection should be verified after wiring the real client.",
    findings: [],
  };
}
