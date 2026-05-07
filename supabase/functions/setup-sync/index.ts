import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { corsHeaders } from '../_shared/cors.ts';

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  try {
    const body = await req.json();
    const payload = body?.payload || {};
    const counts = {
      branches: payload?.branches?.length || 0,
      stores: payload?.stores?.length || 0,
      suppliers: payload?.suppliers?.length || 0,
      items: payload?.items?.length || 0,
      costCenters: payload?.costCenters?.length || 0,
      chartAccounts: payload?.chartAccounts?.length || 0,
    };
    return new Response(JSON.stringify({ ok: false,
      productionAllowed: false,
      devOnly: true, dryRun: body?.dryRun !== false, message: 'v181 setup-sync dry-run accepted. Wire database upserts in the next backend sprint.', counts }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    return new Response(JSON.stringify({ ok: false, error: String(error) }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
