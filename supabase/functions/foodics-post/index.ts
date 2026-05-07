import { corsHeaders, json } from '../_shared/cors.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  try {
    const payload = await req.json().catch(() => ({}));
    return json({
      ok: false,
      productionAllowed: false,
      devOnly: true,
      function: 'foodics-post',
      mode: 'v130-skeleton',
      message: 'Production implementation placeholder. Wire this to Supabase service role, RLS-aware validation, posting guard, audit and lifecycle updates.',
      receivedKeys: Object.keys(payload || {}),
      nextStep: 'Implement permission check, period check, source validation, posting and audit write.',
    });
  } catch (error) {
    return json({ ok: false, function: 'foodics-post', error: String(error) }, 500);
  }
});
