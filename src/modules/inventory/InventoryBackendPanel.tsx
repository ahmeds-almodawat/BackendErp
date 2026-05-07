import { StatusBadge } from "../../components/common/StatusBadge";
import { createInventoryCutoverSummary } from "./inventoryCutover";

export function InventoryBackendPanel() {
  const summary = createInventoryCutoverSummary();

  return (
    <div className="rounded-2xl border bg-white p-5">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-slate-900">Inventory Backend Cutover</h3>
        <StatusBadge
          label={summary.status}
          variant={summary.status === "ready" ? "success" : summary.status === "warning" ? "warning" : "critical"}
        />
      </div>

      <p className="mt-3 text-sm text-slate-600">
        v318 prepares real inventory movement ledger, stock balances, adjustments, stock counts, and costing controls.
      </p>

      <div className="mt-4 grid gap-2 text-sm text-slate-700">
        <div>Blocked items: {summary.blocked}</div>
        <div>Not checked: {summary.notChecked}</div>
      </div>

      <ul className="mt-4 list-disc space-y-1 pl-5 text-sm text-slate-600">
        {summary.checklist.map((item) => (
          <li key={item.key}>{item.label}</li>
        ))}
      </ul>
    </div>
  );
}
