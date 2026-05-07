import { StatusBadge } from "../../components/common/StatusBadge";
import { summarizeFinanceClose } from "./close/financeCloseTypes";

export function FinanceEnterpriseBackendPanel() {
  const close = summarizeFinanceClose();

  return (
    <div className="rounded-2xl border bg-white p-5">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-slate-900">Finance Enterprise Backend</h3>
        <StatusBadge
          label={close.status}
          variant={close.status === "ready" ? "success" : close.status === "warning" ? "warning" : "critical"}
        />
      </div>

      <p className="mt-3 text-sm text-slate-600">
        v323-v328 adds GL, subledger aging, VAT, bank reconciliation, finance close, and management truth foundations.
      </p>

      <div className="mt-4 grid gap-2 text-sm text-slate-700">
        <div>Close blocked checks: {close.blockedCount}</div>
        <div>Close warnings/not checked: {close.warningCount}</div>
      </div>
    </div>
  );
}
