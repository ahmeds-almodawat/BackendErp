import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { corsHeaders } from '../_shared/cors.ts';
serve((_req) => new Response(JSON.stringify({ ok: true, service: 'backend-health-v301', at: new Date().toISOString(), message: 'Supabase backend function reachable.' }), { headers: { ...corsHeaders, 'content-type': 'application/json' } }));
