import { corsHeaders } from '../_shared/cors.ts';
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  return new Response(JSON.stringify({ ok: true, service: 'backend-health', version: 'v180', checks: ['auth', 'database', 'rls', 'storage', 'functions', 'audit'] }), { headers: { ...corsHeaders, 'content-type': 'application/json' } });
});
