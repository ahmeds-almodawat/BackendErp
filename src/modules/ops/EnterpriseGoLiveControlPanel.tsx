import { StatusBadge } from "../../components/common/StatusBadge";
import { summarizeAppShellReduction } from "./appShellReductionPlan";
import { summarizeEnterpriseTableAdoption } from "./enterpriseTableAdoption";
import { summarizeStagingDeployment } from "../deployment/stagingDeploymentGate";
import { summarizeUatScenarios } from "../uat/enterpriseUatScenarios";
import { summarizeGoLiveChecklist } from "../goLive/productionGoLiveChecklist";

export function EnterpriseGoLiveControlPanel() {
  const shell = summarizeAppShellReduction();
  const tables = summarizeEnterpriseTableAdoption();
  const staging = summarizeStagingDeployment();
  const uat = summarizeUatScenarios();
  const goLive = summarizeGoLiveChecklist();

  const blocked = [shell.status, tables.status, staging.status, goLive.status].filter((status) => status === "blocked").length;
  const status = blocked > 0 ? "blocked" : "warning";

  return (
    <div className="rounded-2xl border bg-white p-5">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-slate-900">Enterprise Go-Live Control</h3>
        <StatusBadge label={status} variant={status === "blocked" ? "critical" : "warning"} />
      </div>

      <p className="mt-3 text-sm text-slate-600">
        v352-v360 adds AppShell reduction planning, permission-aware navigation, table adoption, support logging, audit logging, staging, UAT, and go-live controls.
      </p>

      <div className="mt-4 grid gap-2 text-sm text-slate-700">
        <div>AppShell refactor tasks: {shell.taskCount}</div>
        <div>Enterprise table tasks: {tables.taskCount}</div>
        <div>Staging deployment checks: {staging.checkCount}</div>
        <div>UAT scenarios: {uat.scenarioCount}</div>
        <div>Go-live checklist items: {goLive.itemCount}</div>
      </div>
    </div>
  );
}
