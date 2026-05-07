import { evaluateProductionReadiness } from "./productionReadinessEngine";
import { defaultHealthChecks } from "./healthChecks";
import { StatusBadge } from "../../components/common/StatusBadge";

export function ProductionReadinessPanel() {
  const summary = evaluateProductionReadiness(defaultHealthChecks);

  return (
    <div className="rounded-2xl border bg-white p-5">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-slate-900">Production Readiness</h3>
        <StatusBadge
          label={`${summary.readinessScore}% ${summary.status}`}
          variant={summary.status === "ready" ? "success" : summary.status === "warning" ? "warning" : "critical"}
        />
      </div>
      <p className="mt-3 text-sm text-slate-600">
        Production should not launch while critical findings exist. Backup is not trusted until restore is tested.
      </p>
      <div className="mt-4 grid gap-2 text-sm">
        <div>Critical findings: {summary.criticalCount}</div>
        <div>Warnings: {summary.warningCount}</div>
        <div>Blocked areas: {summary.blockedAreas.length ? summary.blockedAreas.join(", ") : "None"}</div>
      </div>
    </div>
  );
}
