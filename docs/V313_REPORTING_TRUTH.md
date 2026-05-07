# v313 Reporting Truth foundation

## Purpose

v313 introduces an **explainable reporting truth layer**. Reports are not “pretty outputs” — they must state:

- **what sources were used** (tables / upstream files)
- **what is missing**
- **what risks exist**
- a **truth score** and status gate (`trusted`, `warning`, `critical`, `incomplete`)

This patch is foundation-only and does not rewrite existing UI.

## Added TypeScript module

`src/modules/analytics/reportingTruth/` adds:

- report + finding models (`reportingTruthTypes.ts`)
- scoring + summarization (`reportingTruthEngine.ts`)
- foundation report builders:
  - finance: trial balance, GL stub, IS stub, BS stub, cash/bank stub, VAT stub
  - inventory: valuation checks (missing cost/negative stock) + stubs
  - sales: payment reconciliation check + stubs
  - purchasing: supplier aging due-date check + stubs
  - management: packs that summarize truth (not dashboards)
- optional panel: `ReportingTruthPanel.tsx` (not integrated into AppShell)

## Principles (must stay true)

- Every report includes `sources[]` (tables) and surfaces missing data.
- Trial balance must show imbalance when debit != credit.
- Inventory valuation must highlight missing cost and negative stock.
- Sales reconciliation must highlight sales/payment mismatch.
- Supplier aging must highlight missing due dates.
- Management packs must distinguish estimated/demo values from posted truth.

## SQL foundation

Migration file only (not applied automatically):

- `supabase/migrations/20260505231300_v313_reporting_truth.sql`

Adds snapshot/run/finding storage and RPC stubs:

- `reporting_create_truth_snapshot(period_start, period_end, branch_id)`
- `reporting_get_truth_summary(snapshot_id)`
- `reporting_log_finding(snapshot_id, domain, severity, message, source_table, source_id)`

## Next steps

- Implement server-side aggregations per report from v311 posted batches + v312 cutover batches.
- Store report runs with `reporting_report_run_sources` and snapshot results for auditability.
- Gate management dashboards on `trusted` truth status for production pilots.

