import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type" };
serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    const body = await req.json().catch(() => ({}));
    const payload = body.payload || {};
    const summary = {
      branches: Array.isArray(payload.branches) ? payload.branches.length : 0,
      stores: Array.isArray(payload.stores) ? payload.stores.length : 0,
      suppliers: Array.isArray(payload.suppliers) ? payload.suppliers.length : 0,
      items: Array.isArray(payload.items) ? payload.items.length : 0,
      accounts: Array.isArray(payload.chartAccounts) ? payload.chartAccounts.length : 0,
    };
    return new Response(JSON.stringify({ ok: false,
      productionAllowed: false,
      devOnly: true, dryRun: body.dryRun !== false, summary, message: "v280 setup sync dry-run accepted" }), { headers: { ...cors, "Content-Type": "application/json" } });
  } catch (error) {
    return new Response(JSON.stringify({ ok: false, error: String(error) }), { status: 500, headers: { ...cors, "Content-Type": "application/json" } });
  }
});
