export type BackendMode = 'local_trial' | 'supabase_pilot' | 'production';
export type BackendModeStatus = { mode: BackendMode; label: string; canPostLocally: boolean; canSyncSetup: boolean; requiresServerPosting: boolean };

export function getBackendModeStatus(mode: BackendMode = 'local_trial'): BackendModeStatus {
  if (mode === 'production') return { mode, label: 'Production Supabase mode', canPostLocally: false, canSyncSetup: true, requiresServerPosting: true };
  if (mode === 'supabase_pilot') return { mode, label: 'Supabase pilot mode', canPostLocally: true, canSyncSetup: true, requiresServerPosting: false };
  return { mode, label: 'Local trial mode', canPostLocally: true, canSyncSetup: false, requiresServerPosting: false };
}

export function isSupabaseConfigured(): boolean {
  return Boolean(import.meta.env.VITE_SUPABASE_URL && import.meta.env.VITE_SUPABASE_ANON_KEY);
}
