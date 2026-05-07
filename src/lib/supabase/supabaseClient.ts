import { createClient, type SupabaseClient } from "@supabase/supabase-js";

export interface SupabaseBrowserClientLike {
  from(table: string): any;
  rpc(functionName: string, args?: Record<string, unknown>): Promise<{ data: unknown; error: { message?: string } | null }>;
}

export interface SupabaseEnvironment {
  url?: string;
  anonKey?: string;
}

let cachedClient: SupabaseBrowserClientLike | null = null;

export function getSupabaseEnvironment(): SupabaseEnvironment {
  return {
    url: import.meta.env.VITE_SUPABASE_URL,
    anonKey: import.meta.env.VITE_SUPABASE_ANON_KEY,
  };
}

export function isSupabaseConfigured(): boolean {
  const env = getSupabaseEnvironment();
  return Boolean(env.url?.trim() && env.anonKey?.trim());
}

export function assertNoServiceRoleInFrontend(): string[] {
  const findings: string[] = [];

  if ("VITE_SUPABASE_SERVICE_ROLE_KEY" in import.meta.env) {
    findings.push("Service role key must never be exposed through VITE_ frontend variables.");
  }

  if ("VITE_SUPABASE_SERVICE_KEY" in import.meta.env) {
    findings.push("Service key must never be exposed through VITE_ frontend variables.");
  }

  return findings;
}

export function getSupabaseClient(): SupabaseBrowserClientLike | null {
  const unsafeFindings = assertNoServiceRoleInFrontend();

  if (unsafeFindings.length > 0) {
    console.error("Unsafe Supabase frontend environment", unsafeFindings);
    return null;
  }

  if (!isSupabaseConfigured()) {
    return null;
  }

  if (cachedClient) {
    return cachedClient;
  }

  const env = getSupabaseEnvironment();

  const client = createClient(env.url ?? "", env.anonKey ?? "", {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  }) as unknown as SupabaseBrowserClientLike;

  cachedClient = client;

  return cachedClient;
}

export function resetSupabaseClientForTests(): void {
  cachedClient = null;
}

export type RealSupabaseClient = SupabaseClient;
