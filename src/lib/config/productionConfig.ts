export type RuntimeMode = "local-demo" | "staging" | "production";

export interface ProductionConfig {
  appName: string;
  version: string;
  runtimeMode: RuntimeMode;
  requireAuth: boolean;
  requireBranchScope: boolean;
  requirePostingValidation: boolean;
  allowDemoData: boolean;
  allowDangerousActions: boolean;
}

function getEnvValue(key: string): string | undefined {
  const env = ((import.meta as unknown as { env?: Record<string, string | undefined> }).env ?? {}) as Record<string, string | undefined>;
  return env[key];
}

function parseBooleanEnv(value: string | undefined, fallback: boolean): boolean {
  if (value === undefined || value === null || value === "") return fallback;
  return ["1", "true", "yes", "on"].includes(String(value).trim().toLowerCase());
}

function normalizeRuntimeMode(value: string | undefined): RuntimeMode {
  const normalized = String(value || "local-demo").trim().toLowerCase();
  if (normalized === "production") return "production";
  if (normalized === "staging" || normalized === "supabase" || normalized === "backend") return "staging";
  return "local-demo";
}

const runtimeMode = normalizeRuntimeMode(getEnvValue("VITE_RUNTIME_MODE") || getEnvValue("VITE_BACKEND_MODE") || getEnvValue("VITE_APP_MODE"));

export const productionConfig: ProductionConfig = {
  appName: "Restaurant ERP",
  version: "v384-source-of-truth-gate",
  runtimeMode,
  requireAuth: runtimeMode === "production" ? true : parseBooleanEnv(getEnvValue("VITE_REQUIRE_AUTH"), false),
  requireBranchScope: runtimeMode === "production" ? true : parseBooleanEnv(getEnvValue("VITE_REQUIRE_BRANCH_SCOPE"), false),
  requirePostingValidation: true,
  allowDemoData: runtimeMode === "production" ? false : parseBooleanEnv(getEnvValue("VITE_ALLOW_DEMO_DATA"), true),
  allowDangerousActions: false,
};

export function isProductionMode(config: ProductionConfig = productionConfig): boolean {
  return config.runtimeMode === "production";
}

export function assertSafeProductionConfig(config: ProductionConfig = productionConfig): string[] {
  const findings: string[] = [];

  if (config.runtimeMode === "production" && !config.requireAuth) {
    findings.push("Production mode must require authentication.");
  }

  if (config.runtimeMode === "production" && !config.requireBranchScope) {
    findings.push("Production mode must enforce branch scope.");
  }

  if (config.runtimeMode === "production" && config.allowDemoData) {
    findings.push("Production mode must not allow demo data.");
  }

  if (config.runtimeMode === "production" && config.allowDangerousActions) {
    findings.push("Production mode must not allow dangerous actions.");
  }

  return findings;
}

export function assertProductionCanUseBackend(isBackendConfigured: boolean, config: ProductionConfig = productionConfig): string[] {
  const findings = assertSafeProductionConfig(config);

  if (config.runtimeMode === "production" && !isBackendConfigured) {
    findings.push("Production mode is blocked because Supabase is not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY, or switch VITE_RUNTIME_MODE back to staging/local-demo.");
  }

  return findings;
}
