import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type" };
serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  const body = await req.json().catch(() => ({}));
  const required = ["sourceModule", "postingMode"];
  const missing = required.filter((key) => !body[key]);
  return new Response(JSON.stringify({ ok: missing.length === 0, dryRun: true, missing, guardFlow: ["validate", "permission", "period", "lifecycle", "inventory", "gl", "audit", "status"] }), { status: missing.length ? 400 : 200, headers: { ...cors, "Content-Type": "application/json" } });
});
