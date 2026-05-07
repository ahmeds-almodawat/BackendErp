import { StatusBadge } from "../../components/common/StatusBadge";
import { validateLiveMasterDataCutover } from "../setup/liveMasterDataCutover";
import { validateLiveManualJournal } from "../finance/live/liveManualJournal";
import { validateGlReportRequest } from "../finance/reports/glLiveReportTypes";

export function LiveCutoverReadinessPanel() {
  const masterData = validateLiveMasterDataCutover({
    resource: "items",
    approvedBy: "demo",
  });

  const journal = validateLiveManualJournal({
    journalNo: "JRN-DEMO",
    journalDate: "2026-01-01",
    description: "Demo balanced journal",
    lines: [
      { accountCode: "1010", debit: 100, credit: 0 },
      { accountCode: "4000", debit: 0, credit: 100 },
    ],
  });

  const report = validateGlReportRequest({
    reportType: "trial_balance",
    periodStart: "2026-01-01",
    periodEnd: "2026-01-31",
  });

  const blocked = [masterData, journal, report].filter((item) => !item.ok).length;
  const status = blocked > 0 ? "blocked" : "ready";

  return (
    <div className="rounded-2xl border bg-white p-5">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-slate-900">Live Cutover Readiness</h3>
        <StatusBadge label={status} variant={status === "ready" ? "success" : "critical"} />
      </div>
      <p className="mt-3 text-sm text-slate-600">
        v335-v339 prepares live master data cutover, import approval, manual journal posting, opening balances, and GL reports.
      </p>
      <div className="mt-4 grid gap-2 text-sm text-slate-700">
        <div>Master data validation: {masterData.status}</div>
        <div>Journal validation: {journal.ok ? "ready" : "blocked"}</div>
        <div>GL report validation: {report.ok ? "ready" : "blocked"}</div>
      </div>
    </div>
  );
}
