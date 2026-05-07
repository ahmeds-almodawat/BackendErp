import { corsHeaders } from '../_shared/cors.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  try {
    const payload = await req.json().catch(() => ({}));
    return new Response(JSON.stringify({ ok: false,
      productionAllowed: false,
      devOnly: true, status: 'v150 skeleton', functionName: new URL(req.url).pathname.split('/').pop(), received: payload, next: 'Wire Supabase service role, permission checks, period checks, posting transaction and audit writes.' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (error) {
    return new Response(JSON.stringify({ ok: false, error: String(error) }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
