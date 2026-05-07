import { StatusBadge } from "../../components/common/StatusBadge";
import { validateLiveBankStatementImport } from "../finance/reconciliation/liveBankReconciliation";
import { validateLiveVatSettlement } from "../finance/tax/liveVatSettlement";
import { validateLivePeriodClose } from "../finance/close/livePeriodClose";

export function FinanceCloseLiveGatePanel() {
  const bank = validateLiveBankStatementImport({
    importNo: "BANK-DEMO",
    accountCode: "1010",
    periodStart: "2026-01-01",
    periodEnd: "2026-01-31",
    lines: [{ statementDate: "2026-01-01", description: "Demo bank line", amount: 100 }],
  });

  const vat = validateLiveVatSettlement({
    settlementNo: "VAT-DEMO",
    periodStart: "2026-01-01",
    periodEnd: "2026-01-31",
    reviewedBy: "Finance",
  });

  const close = validateLivePeriodClose({
    closeNo: "CLOSE-DEMO",
    fiscalPeriodId: "period-demo",
    requestedBy: "Finance",
    backupConfirmed: true,
    trialBalanceBalanced: true,
    inventoryReconciled: true,
    apReconciled: true,
    arReconciled: true,
    bankReconciled: true,
    vatReviewed: true,
  });

  const blocked = [bank, vat, close].filter((item) => !item.ok).length;
  const status = blocked > 0 ? "blocked" : "ready";

  return (
    <div className="rounded-2xl border bg-white p-5">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-slate-900">Finance Close Live Gate</h3>
        <StatusBadge label={status} variant={status === "ready" ? "success" : "critical"} />
      </div>

      <p className="mt-3 text-sm text-slate-600">
        v349-v351 prepares live bank reconciliation, VAT settlement, and period close gate controls.
      </p>

      <div className="mt-4 grid gap-2 text-sm text-slate-700">
        <div>Bank reconciliation: {bank.ok ? "ready" : "blocked"}</div>
        <div>VAT settlement: {vat.ok ? "ready" : "blocked"}</div>
        <div>Period close: {close.ok ? "ready" : "blocked"}</div>
      </div>
    </div>
  );
}
