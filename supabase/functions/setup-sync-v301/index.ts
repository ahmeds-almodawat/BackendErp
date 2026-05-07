import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  try {
    const body = await req.json();
    const dryRun = body?.dryRun !== false;
    const payload = body?.payload || {};
    const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
    const serviceRole = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
    const counts = Object.fromEntries(Object.entries(payload).filter(([, value]) => Array.isArray(value)).map(([key, value]) => [key, (value as unknown[]).length]));
    const validation = [];
    if (!payload?.company?.code) validation.push({ severity: 'critical', area: 'company', finding: 'Missing company code' });
    if (!Array.isArray(payload?.branches) || !payload.branches.length) validation.push({ severity: 'critical', area: 'branches', finding: 'No branches provided' });
    if (!Array.isArray(payload?.stores) || !payload.stores.length) validation.push({ severity: 'critical', area: 'stores', finding: 'No stores provided' });
    if (!Array.isArray(payload?.items) || !payload.items.length) validation.push({ severity: 'critical', area: 'items', finding: 'No items provided' });

    if (!supabaseUrl || !serviceRole) {
      return new Response(JSON.stringify({ ok: false,
      productionAllowed: false,
      devOnly: true, mode: 'edge-dry-run-no-service-role', dryRun, counts, validation }), { headers: { ...corsHeaders, 'content-type': 'application/json' } });
    }

    const supabase = createClient(supabaseUrl, serviceRole);
    const { data, error } = await supabase.from('setup_sync_batches').insert({ company_code: payload.company?.code || 'UNKNOWN', dry_run: dryRun, status: dryRun ? 'dry_run_recorded' : 'received_for_processing', payload, validation, row_counts: counts }).select('id,status,created_at').single();
    if (error) throw error;
    return new Response(JSON.stringify({ ok: false,
      productionAllowed: false,
      devOnly: true, mode: dryRun ? 'dry-run-recorded' : 'received', batch: data, counts, validation }), { headers: { ...corsHeaders, 'content-type': 'application/json' } });
  } catch (error) {
    return new Response(JSON.stringify({ ok: false, error: String(error?.message || error) }), { status: 400, headers: { ...corsHeaders, 'content-type': 'application/json' } });
  }
});
