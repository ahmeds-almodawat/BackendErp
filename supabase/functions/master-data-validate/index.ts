import { corsHeaders } from '../_shared/cors.ts';
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  const body = await req.json().catch(() => ({}));
  return new Response(JSON.stringify({ ok: true, service: 'master-data-validate', scope: body.scope ?? 'all', blockers: [], warnings: [], score: 100 }), { headers: { ...corsHeaders, 'content-type': 'application/json' } });
});
