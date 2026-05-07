import {
  summarizeReportingTruth,
} from "./reportingTruthEngine.js";
import {
  buildTrialBalanceReport,
  buildVatSummaryReport,
} from "./financeReports.js";
import {
  buildInventoryValuationReport,
  buildLowStockReport,
} from "./inventoryReports.js";
import {
  buildSalesSummaryReport,
  buildPaymentReconciliationReport,
} from "./salesReports.js";
import {
  buildSupplierBalanceReport,
  buildSupplierAgingReport,
} from "./purchasingReports.js";
import {
  buildManagementDashboardPack,
  buildExecutiveKpiPack,
} from "./managementReports.js";
import type { ReportPeriod } from "./reportingTruthTypes.js";

const samplePeriod: ReportPeriod = {
  start: "2026-05-01",
  end: "2026-05-31",
  label: "May 2026",
};

export default function ReportingTruthPanel({ period = samplePeriod }: { period?: ReportPeriod }) {
  const reports = [
    buildTrialBalanceReport({ period }),
    buildVatSummaryReport({ period }),
    buildInventoryValuationReport({ period }),
    buildLowStockReport({ period }),
    buildSalesSummaryReport({ period }),
    buildPaymentReconciliationReport({ period }),
    buildSupplierBalanceReport({ period }),
    buildSupplierAgingReport({ period }),
    buildExecutiveKpiPack({ period }),
    buildManagementDashboardPack(period),
  ];

  const summary = summarizeReportingTruth(reports);
  const tone =
    summary.status === "trusted"
      ? { fg: "#166534", bg: "#dcfce7" }
      : summary.status === "warning"
        ? { fg: "#92400e", bg: "#fef3c7" }
        : summary.status === "incomplete"
          ? { fg: "#1f2937", bg: "#e5e7eb" }
          : { fg: "#991b1b", bg: "#fee2e2" };

  const criticalRisks = summary.findings
    .filter((f) => f.severity === "critical")
    .slice(0, 6);

  return (
    <section
      style={{
        border: "1px solid #e2e8f0",
        borderRadius: 14,
        padding: 20,
        background: "linear-gradient(180deg, #ffffff 0%, #f8fafc 100%)",
        display: "grid",
        gap: 14,
        fontFamily: "system-ui, sans-serif",
      }}
    >
      <div>
        <h3 style={{ margin: 0, fontSize: 20 }}>Reporting Truth (v313)</h3>
        <p style={{ margin: "8px 0 0", color: "#64748b", fontSize: 14 }}>
          AppShell-visible truth layer panel. Shows explainable status and risks based on missing source truth.
        </p>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
          gap: 10,
        }}
      >
        <div style={{ padding: 12, borderRadius: 10, border: "1px solid #e2e8f0", background: tone.bg, color: tone.fg }}>
          <strong style={{ fontSize: 18 }}>{summary.status.toUpperCase()}</strong>
          <div style={{ marginTop: 4, color: tone.fg }}>Truth status</div>
        </div>
        <div style={{ padding: 12, borderRadius: 10, border: "1px solid #e2e8f0", background: "#eff6ff" }}>
          <strong style={{ fontSize: 18 }}>{summary.truthScore}</strong>
          <div style={{ marginTop: 4, color: "#475569" }}>Truth score (/100)</div>
        </div>
        <div style={{ padding: 12, borderRadius: 10, border: "1px solid #e2e8f0", background: "#fee2e2" }}>
          <strong style={{ fontSize: 18 }}>{summary.criticalCount}</strong>
          <div style={{ marginTop: 4, color: "#475569" }}>Critical findings</div>
        </div>
        <div style={{ padding: 12, borderRadius: 10, border: "1px solid #e2e8f0", background: "#fef3c7" }}>
          <strong style={{ fontSize: 18 }}>{summary.warningCount}</strong>
          <div style={{ marginTop: 4, color: "#475569" }}>Warning findings</div>
        </div>
      </div>

      <div style={{ display: "grid", gap: 8 }}>
        <strong>Supported report groups</strong>
        <div style={{ color: "#334155", fontSize: 14 }}>
          Finance • Inventory • Sales • Purchasing • Management (foundation builders; calculations intentionally minimal)
        </div>
      </div>

      <div style={{ display: "grid", gap: 8 }}>
        <strong>Truth score explanation</strong>
        <div style={{ color: "#334155", fontSize: 14 }}>
          Critical findings apply a heavy penalty; warnings apply a moderate penalty. Trusted requires <strong>score ≥ 90</strong> and <strong>zero critical</strong>.
          Missing source data is shown as <strong>incomplete</strong>.
        </div>
      </div>

      <div style={{ display: "grid", gap: 8 }}>
        <strong>Critical reporting risks</strong>
        {criticalRisks.length === 0 ? (
          <div style={{ padding: 12, borderRadius: 10, background: "#dcfce7", color: "#166534" }}>
            No critical risks detected by the foundation checks.
          </div>
        ) : (
          criticalRisks.map((risk) => (
            <div key={risk.id} style={{ padding: 12, borderRadius: 10, background: "#fee2e2", color: "#991b1b" }}>
              <strong>{risk.domain}</strong>
              <div style={{ marginTop: 4 }}>{risk.message}</div>
              {risk.action ? <div style={{ marginTop: 6, color: "#7f1d1d" }}>{risk.action}</div> : null}
            </div>
          ))
        )}
      </div>

      <div style={{ display: "grid", gap: 8 }}>
        <strong>Next backend cutover tasks</strong>
        <ol style={{ margin: 0, paddingLeft: 18, color: "#334155", fontSize: 14 }}>
          <li>Apply `20260505231300_v313_reporting_truth.sql` when ready (do not auto-apply).</li>
          <li>Compute report runs from posted v311 batches and v312 cutover batches, not local demo state.</li>
          <li>Store explainable sources per report run (tables + filters) and snapshot findings.</li>
        </ol>
      </div>
    </section>
  );
}
