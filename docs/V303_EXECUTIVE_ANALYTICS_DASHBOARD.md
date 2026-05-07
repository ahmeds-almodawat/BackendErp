# V303 — Executive Analytics Dashboard

## Purpose

This patch upgrades the existing Dashboard route into an executive command center while keeping the sidebar clean. No new sidebar module was added.

## Dashboard coverage

- Finance: sales, COGS, expenses, net income, balance-sheet structure, cash movement, VAT position.
- Sales / POS: posted sales, average ticket, branch performance, sales trend.
- Inventory: stock value, category ranking, store ranking, low stock, near-expiry lots, quarantine lots.
- Purchasing / AP: posted invoices, purchase order status, supplier exposure, supplier payments.
- Production / recipes: recipes, production batches, planned vs. actual output, menu margin engineering.
- HR / Access: employees, user accounts, roles, access grants.
- Controls: pending approvals, draft documents, unbalanced journals, locked/closed periods.

## Visual style

Different KPI cards intentionally use different chart shapes:

- Line charts for movement and trends.
- Horizontal bars for rankings and exception counts.
- Doughnut gauges for ratios and pressure metrics.
- Metric rails for board-style quick scans.

## How to test

1. Run `npm install`.
2. Run `npm run dev`.
3. Open Dashboard.
4. Click **Load fast trial scenario**.
5. Confirm the executive KPI cards populate across finance, stock, purchasing, production, POS, HR, and controls.

## Build check

`npm run build` passed after the patch.

Note: `npm run typecheck` can take longer than the execution timeout in this container because the project is still a very large single-file/single-bundle app. Vite production build completed successfully.
