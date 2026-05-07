import assert from "node:assert/strict";
import fs from "node:fs";

const expectedFiles = [
  "src/modules/inventory/live/liveOpeningStock.ts",
  "src/modules/inventory/live/liveOpeningStockService.ts",
  "src/modules/inventory/live/livePurchaseReceipt.ts",
  "src/modules/inventory/live/livePurchaseReceiptService.ts",
  "src/modules/inventory/live/liveStockCount.ts",
  "src/modules/inventory/live/liveStockCountService.ts",
  "src/modules/purchasing/live/livePurchaseInvoice.ts",
  "src/modules/purchasing/live/livePurchaseInvoiceService.ts",
  "src/modules/purchasing/live/liveSupplierPayment.ts",
  "src/modules/purchasing/live/liveSupplierPaymentService.ts",
  "src/modules/ops/InventoryPurchasingLiveGatePanel.tsx",
  "supabase/migrations/20260505234000_v340_v344_inventory_purchasing_live_posting.sql",
  "docs/V340_V344_INVENTORY_PURCHASING_LIVE_POSTING.md",
  "templates/v340-v344/opening_stock_live_template.csv"
];

for (const file of expectedFiles) {
  assert.ok(fs.existsSync(file), `Missing expected v340-v344 file: ${file}`);
}

const migration = fs.readFileSync("supabase/migrations/20260505234000_v340_v344_inventory_purchasing_live_posting.sql", "utf8");
assert.ok(migration.includes("live_inventory_post_opening_stock"), "Missing opening stock RPC");
assert.ok(migration.includes("live_inventory_post_purchase_receipt"), "Missing purchase receipt RPC");
assert.ok(migration.includes("live_inventory_post_stock_count"), "Missing stock count RPC");
assert.ok(migration.includes("live_purchasing_post_purchase_invoice"), "Missing purchase invoice RPC");
assert.ok(migration.includes("live_purchasing_post_supplier_payment"), "Missing supplier payment RPC");
assert.ok(migration.includes("enable row level security"), "Migration should enable RLS");

const packageJson = JSON.parse(fs.readFileSync("package.json", "utf8"));
assert.ok(packageJson.scripts?.["qa:v340-v344"], "Missing qa:v340-v344 script");

console.log("v340-v344 inventory and purchasing live posting QA passed");
