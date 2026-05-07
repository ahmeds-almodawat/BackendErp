import { StatusBadge } from "../../components/common/StatusBadge";
import { summarizeStagingMigrationChecks } from "./stagingMigrationVerification";
import { summarizeRlsDryRun } from "../security/rlsDryRunHarness";
import { summarizeUatSeedData } from "../uat/uatSeedDataPacks";
import { summarizeCutoverRehearsal } from "../goLive/cutoverRehearsal";
import { calculateFinalEnterpriseReadiness } from "../goLive/finalEnterpriseReadiness";

export function FinalEnterpriseReadinessPanel() {
  const staging = summarizeStagingMigrationChecks();
  const rls = summarizeRlsDryRun();
  const seed = summarizeUatSeedData();
  const rehearsal = summarizeCutoverRehearsal();

  const readiness = calculateFinalEnterpriseReadiness({
    stagingVerified: staging.status === "ready",
    rlsDryRunPassed: rls.status === "ready",
    uatSeedDataVerified: seed.status === "ready",
    cutoverRehearsalPassed: rehearsal.status === "ready",
    backupRestorePassed: false,
    supportReady: true,
    auditReady: true,
  });

  return (
    <div className="rounded-2xl border bg-white p-5">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-slate-900">Final Enterprise Readiness</h3>
        <StatusBadge
          label={`${readiness.score}% ${readiness.status}`}
          variant={readiness.status === "ready" ? "success" : readiness.status === "warning" ? "warning" : "critical"}
        />
      </div>

      <p className="mt-3 text-sm text-slate-600">
        v361-v365 adds staging verification, RLS dry-run harness, UAT seed data pack, cutover rehearsal, and final readiness scoring.
      </p>

      <div className="mt-4 grid gap-2 text-sm text-slate-700">
        <div>Staging verification: {staging.status}</div>
        <div>RLS dry run: {rls.status}</div>
        <div>UAT seed data: {seed.status}</div>
        <div>Cutover rehearsal: {rehearsal.status}</div>
      </div>
    </div>
  );
}
