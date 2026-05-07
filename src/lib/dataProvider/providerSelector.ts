import { productionConfig, assertProductionCanUseBackend } from "../config/productionConfig";
import { createSupabaseDataProvider } from "./supabaseProvider";
import { localDataProvider } from "./localProvider";
import { getSupabaseClient, isSupabaseConfigured } from "../supabase/supabaseClient";
import type { EnterpriseDataProvider } from "./types";

export type ProviderSelectionMode = "local-demo" | "supabase" | "safe-fallback";

export interface ProviderSelection {
  mode: ProviderSelectionMode;
  provider: EnterpriseDataProvider;
  reason: string;
}

export function selectDataProvider(): ProviderSelection {
  const client = getSupabaseClient();
  const backendConfigured = isSupabaseConfigured();
  const productionFindings = assertProductionCanUseBackend(backendConfigured);

  if (productionConfig.runtimeMode === "production" && productionFindings.length > 0) {
    throw new Error(`Production backend gate blocked startup: ${productionFindings.join(" ")}`);
  }

  if (client && backendConfigured && productionConfig.runtimeMode !== "local-demo") {
    return {
      mode: "supabase",
      provider: createSupabaseDataProvider(client),
      reason: "Supabase configured and runtime mode allows backend data provider.",
    };
  }

  return {
    mode: "local-demo",
    provider: localDataProvider,
    reason:
      productionConfig.runtimeMode === "local-demo"
        ? "Local demo provider selected by explicit runtime mode."
        : "Local demo provider selected because staging backend is not configured. Production mode would block this fallback.",
  };
}
