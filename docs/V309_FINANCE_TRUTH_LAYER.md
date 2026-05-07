# v309 Finance Extraction + Backend Truth Layer

v309 adds the finance truth layer and posting contract foundation.

## Frontend

- Finance tab definitions extracted to `src/modules/finance/financeTabs.ts`.
- Finance truth layer engine added at `src/modules/finance/financeTruthLayer.ts`.
- Finance page now includes a Finance Truth Layer panel.
- Finance Controls now show truth score and findings.
- Posting Rules now display v309 posting contracts.

## Posting contracts

Contracts registered for:

1. manual journals
2. purchase invoices
3. supplier payments
4. sales/POS batches
5. inventory adjustments
6. production batches
7. depreciation runs
8. opening balances
9. bank reconciliation

## Backend migration

Migration `20260505030900_v309_finance_truth_layer.sql` adds:

- `finance_posting_batches`
- `finance_posting_batch_lines`
- `finance_reconciliation_checks`
- `finance_import_staging_files`
- `finance_posting_contracts`
- RPC `finance_validate_posting_batch(uuid)`

## Templates

- `templates/finance_posting_contracts_v309_template.csv`
- `templates/ledger_reconciliation_v309_template.csv`
- `templates/finance_import_mapping_v309_template.csv`
