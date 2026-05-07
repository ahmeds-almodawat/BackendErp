export type BackendMode = 'local' | 'supabase-pilot' | 'production';

export type BackendBridgeStatus = {
  mode: BackendMode;
  configured: boolean;
  supabaseUrl?: string;
  reason: string;
};

export function getBackendBridgeStatus(): BackendBridgeStatus {
  const supabaseUrl = import.meta.env?.VITE_SUPABASE_URL as string | undefined;
  const anonKey = import.meta.env?.VITE_SUPABASE_ANON_KEY as string | undefined;
  if (!supabaseUrl || !anonKey) {
    return { mode: 'local', configured: false, reason: 'Supabase environment variables are not configured; safe local mode is active.' };
  }
  return { mode: 'supabase-pilot', configured: true, supabaseUrl, reason: 'Supabase environment variables detected; pilot calls can be enabled.' };
}

export async function callBackendFunction<TPayload, TResult = unknown>(functionName: string, payload: TPayload): Promise<TResult> {
  const supabaseUrl = import.meta.env?.VITE_SUPABASE_URL as string | undefined;
  const anonKey = import.meta.env?.VITE_SUPABASE_ANON_KEY as string | undefined;
  if (!supabaseUrl || !anonKey) throw new Error('Supabase environment is not configured.');
  const response = await fetch(`${supabaseUrl.replace(/\/$/, '')}/functions/v1/${functionName}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${anonKey}`, apikey: anonKey },
    body: JSON.stringify(payload),
  });
  if (!response.ok) throw new Error(`${functionName} failed: ${response.status} ${await response.text()}`);
  return await response.json() as TResult;
}

export function buildSetupPayload(state: any) {
  return {
    generated_at: new Date().toISOString(),
    company: { name_en: 'Restaurant Group', name_ar: 'مجموعة المطاعم', currency: 'SAR', vat_rate: 15 },
    branches: Array.isArray(state?.branches) ? state.branches : [],
    stores: Array.isArray(state?.stores) ? state.stores : [],
    suppliers: Array.isArray(state?.suppliers) ? state.suppliers : [],
    items: Array.isArray(state?.items) ? state.items : [],
    cost_centers: Array.isArray(state?.costCenters) ? state.costCenters : [],
    accounts: Array.isArray(state?.accounts) ? state.accounts : [],
    roles: Array.isArray(state?.roles) ? state.roles : [],
    permissions: Array.isArray(state?.permissions) ? state.permissions : [],
  };
}
