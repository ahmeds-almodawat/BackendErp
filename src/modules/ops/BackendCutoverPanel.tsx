import { selectDataProvider } from "../../lib/dataProvider/providerSelector";
import { checkSupabaseEnvironment } from "../../lib/supabase/supabaseHealth";

export function BackendCutoverPanel() {
  const health = checkSupabaseEnvironment();
  const provider = selectDataProvider();

  return (
    <div className="rounded-2xl border bg-white p-5">
      <h3 className="text-lg font-semibold text-slate-900">Backend Cutover Starter</h3>
      <div className="mt-4 grid gap-2 text-sm text-slate-600">
        <div>Supabase status: {health.status}</div>
        <div>Backend mode: {provider.mode}</div>
        <div>Fallback: {provider.reason}</div>
      </div>
      <ul className="mt-4 list-disc space-y-1 pl-5 text-sm text-slate-600">
        <li>Keep local-demo mode until Supabase env and RLS are tested.</li>
        <li>Cut over master data first, then posting, imports, and reports.</li>
        <li>Never expose the service role key in frontend code.</li>
      </ul>
    </div>
  );
}
