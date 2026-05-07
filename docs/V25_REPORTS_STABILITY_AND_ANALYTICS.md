# V25 Reports Stability + Analytics

This upgrade fixes the Reports white-page issue by replacing the fragile report renderer with a defensive, empty-state-safe reporting workspace.

## Added
- Robust board-grade reporting center.
- Executive, Branch P&L, Inventory Valuation, Supplier Spend, Menu Engineering, Finance Pack, and Exceptions tabs.
- Defensive calculations using safe arrays and posted-ledger data.
- Export current report view to CSV.
- Exception tab for zero-cost stock, negative available stock, recipe costing gaps, and control alerts.

## Remaining
- True XLSX export.
- PDF/print report pack.
- Comparative periods.
- Saved report filters.
- Backend SQL/materialized views.
