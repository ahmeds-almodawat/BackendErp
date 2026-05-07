# v20 Connected Control Layer

This phase adds a single Control Center that checks whether the core ERP modules are connected enough for serious local trials.

## Added

- Document lifecycle register across purchasing, GRN, invoices, payments, production, sales, and journals.
- Control checklist for accounting, purchasing, inventory, recipes, sales, finance, and solvency.
- Posting connection matrix showing exactly when inventory, GL, VAT, AP, GRNI, COGS, and cost centers are affected.
- Safe repair function to rebuild missing local-trial accounting or stock links where possible.
- Inventory exception workbench for negative available stock, zero-cost stock, quarantine, expired stock, and average-cost visibility.
- Import governance tab for saved mapping profiles, duplicate keys, XLSX/CSV design, and rollback/approval notes.
- Audit readiness tab with recent local audit activity.

## Remaining before production

- Supabase persistence and server-side posting functions.
- Real attachment storage.
- XLSX parser and row-level error workbook.
- RLS enforcement.
- Multi-user approval queues.
- Real PDF/print documents.
