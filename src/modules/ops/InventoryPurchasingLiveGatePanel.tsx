import { StatusBadge } from "../../components/common/StatusBadge";
import { validateLiveOpeningStockBatch } from "../inventory/live/liveOpeningStock";
import { validateLivePurchaseInvoice } from "../purchasing/live/livePurchaseInvoice";
import { validateLiveSupplierPayment } from "../purchasing/live/liveSupplierPayment";

export function InventoryPurchasingLiveGatePanel() {
  const openingStock = validateLiveOpeningStockBatch({
    batchNo: "OPEN-DEMO",
    openingDate: "2026-01-01",
    lines: [{ sku: "ITEM-001", quantity: 10, unitCost: 5 }],
  });

  const invoice = validateLivePurchaseInvoice({
    invoiceNo: "PINV-DEMO",
    supplierId: "supplier-demo",
    branchId: "branch-demo",
    invoiceDate: "2026-01-02",
    lines: [{ sku: "ITEM-001", quantity: 10, unitCost: 5, discountAmount: 0, taxAmount: 7.5 }],
  });

  const payment = validateLiveSupplierPayment({
    paymentNo: "PAY-DEMO",
    supplierId: "supplier-demo",
    branchId: "branch-demo",
    paymentDate: "2026-01-03",
    amount: 57.5,
    method: "bank",
    accountCode: "1010",
  });

  const blocked = [openingStock, invoice, payment].filter((item) => !item.ok).length;
  const status = blocked > 0 ? "blocked" : "ready";

  return (
    <div className="rounded-2xl border bg-white p-5">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-slate-900">Inventory + Purchasing Live Gate</h3>
        <StatusBadge label={status} variant={status === "ready" ? "success" : "critical"} />
      </div>

      <p className="mt-3 text-sm text-slate-600">
        v340-v344 prepares opening stock, purchase receipt, stock count, purchase invoice, and supplier payment live posting.
      </p>

      <div className="mt-4 grid gap-2 text-sm text-slate-700">
        <div>Opening stock: {openingStock.ok ? "ready" : "blocked"}</div>
        <div>Purchase invoice: {invoice.ok ? "ready" : "blocked"}</div>
        <div>Supplier payment: {payment.ok ? "ready" : "blocked"}</div>
      </div>
    </div>
  );
}
