import type { Session, User } from "@supabase/supabase-js";
import { getSupabaseClient } from "../../lib/supabase/supabaseClient";

export interface EnterpriseAuthUser {
  id: string;
  email?: string;
  displayName?: string;
  rawUser: User;
}

export interface EnterpriseAuthSession {
  user: EnterpriseAuthUser | null;
  accessToken?: string;
  expiresAt?: number;
  rawSession: Session | null;
}

export function mapSupabaseSession(session: Session | null): EnterpriseAuthSession {
  const user = session?.user ?? null;

  return {
    user: user
      ? {
          id: user.id,
          email: user.email,
          displayName:
            (user.user_metadata?.name as string | undefined) ??
            (user.user_metadata?.display_name as string | undefined) ??
            user.email,
          rawUser: user,
        }
      : null,
    accessToken: session?.access_token,
    expiresAt: session?.expires_at,
    rawSession: session,
  };
}

export async function getCurrentEnterpriseSession(): Promise<EnterpriseAuthSession> {
  const client = getSupabaseClient() as any;

  if (!client?.auth?.getSession) {
    return mapSupabaseSession(null);
  }

  const { data, error } = await client.auth.getSession();

  if (error) {
    console.error("Failed to get Supabase session", error);
    return mapSupabaseSession(null);
  }

  return mapSupabaseSession(data?.session ?? null);
}

export async function signOutEnterpriseUser(): Promise<{ ok: boolean; error?: string }> {
  const client = getSupabaseClient() as any;

  if (!client?.auth?.signOut) {
    return {
      ok: false,
      error: "Supabase auth client is not configured.",
    };
  }

  const { error } = await client.auth.signOut();

  return error ? { ok: false, error: error.message } : { ok: true };
}
