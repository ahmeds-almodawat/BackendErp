import { corsHeaders } from '../_shared/cors.ts';
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  const body = await req.json().catch(() => ({}));
  return new Response(JSON.stringify({ ok: true, service: 'period-close', period: body.period ?? null, action: body.action ?? 'check', status: 'blueprint' }), { headers: { ...corsHeaders, 'content-type': 'application/json' } });
});
