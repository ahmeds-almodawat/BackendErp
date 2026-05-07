import { classifyBundleRisk, shouldUseVirtualization } from "../../lib/performance/performanceEngine";
import { StatusBadge } from "../../components/common/StatusBadge";

export function PerformanceHardeningPanel() {
  const bundleStatus = classifyBundleRisk(710);
  const tableRecommendation = shouldUseVirtualization(3500);

  return (
    <div className="rounded-2xl border bg-white p-5">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-slate-900">Performance Hardening</h3>
        <StatusBadge label={bundleStatus} variant={bundleStatus === "good" ? "success" : bundleStatus === "warning" ? "warning" : "critical"} />
      </div>
      <ul className="mt-4 list-disc space-y-2 pl-5 text-sm text-slate-600">
        <li>Use route-level lazy loading for heavy modules.</li>
        <li>{tableRecommendation.reason}</li>
        <li>Move large report queries to server-side pagination before production.</li>
      </ul>
    </div>
  );
}
