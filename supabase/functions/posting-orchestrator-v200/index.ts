import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: { 'access-control-allow-origin': '*', 'access-control-allow-headers': 'authorization, content-type, apikey' } });
  const body = await req.json().catch(() => ({}));
  return new Response(JSON.stringify({ ok: false,
      productionAllowed: false,
      devOnly: true, function: 'posting-orchestrator-v200', status: 'dry-run', requiredFlow: ['validate','permission','period','lifecycle','inventory','gl','audit','status'], received: body }), {
    headers: { 'content-type': 'application/json', 'access-control-allow-origin': '*' },
  });
});
