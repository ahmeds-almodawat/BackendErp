import { checkBackendEnvironmentGate } from "../../lib/supabase/backendHealthService";
import { StatusBadge } from "../../components/common/StatusBadge";
import { summarizeExpectedBackend } from "./migrationVerification";
import { summarizeRlsTestMatrix } from "./rlsTestMatrix";

export function EnterpriseRealBackendGatePanel() {
  const backend = checkBackendEnvironmentGate();
  const expected = summarizeExpectedBackend();
  const rls = summarizeRlsTestMatrix();

  return (
    <div className="rounded-2xl border bg-white p-5">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-slate-900">Enterprise Real Backend Gate</h3>
        <StatusBadge
          label={backend.status}
          variant={backend.status === "ready" ? "success" : backend.status === "blocked" ? "critical" : "warning"}
        />
      </div>

      <p className="mt-3 text-sm text-slate-600">
        v329-v334 verifies real Supabase readiness, migration coverage, authentication shell, RBAC enforcement, and RLS test planning.
      </p>

      <div className="mt-4 grid gap-2 text-sm text-slate-700">
        <div>Expected migrations: {expected.expectedMigrationCount}</div>
        <div>Expected backend objects: {expected.expectedObjectCount}</div>
        <div>RLS test cases: {rls.testCount}</div>
        <div>Backend message: {backend.message}</div>
      </div>
    </div>
  );
}
