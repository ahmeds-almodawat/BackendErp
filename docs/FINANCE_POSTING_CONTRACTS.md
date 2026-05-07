# Finance Posting Contracts

The v311 backend posting engine defines nine posting contracts. Each contract identifies the source module, the expected debit and credit shape, the control requirements, and the duplicate-prevention design.

| Source Type | Module | Expected Debits | Expected Credits | Core Controls | Duplicate Design |
| --- | --- | --- | --- | --- | --- |
| `manual_journal` | Finance | Configured debit ledger account | Configured credit ledger account | balanced lines, approval, open period, branch scope | lock journal reference by branch and fiscal period |
| `opening_balance` | Finance | Opening assets and expenses | Opening liabilities, equity, and revenue | balanced lines, single cutover reference, open period, lock after posting | lock cutover reference by branch and fiscal period |
| `purchase_invoice` | Purchasing | Inventory or expense, VAT input | Accounts payable or cash | supplier document uniqueness, three-way match, open period | lock invoice source id by branch |
| `supplier_payment` | Purchasing / AP | Accounts payable | Cash or bank | open balance check, payment method, bank account, open period | lock payment voucher source id by branch |
| `sales_pos_batch` | Sales / POS | Cash, bank, clearing, or receivables | Sales revenue and VAT output | closed batch, balanced tenders, open period | lock POS settlement batch id by branch |
| `inventory_adjustment` | Inventory | Inventory gain, variance, or expense | Inventory or variance | approval, reason, cost basis, open period | lock adjustment approval id by branch |
| `production_batch` | Production | Semi-finished or finished goods inventory | Raw material inventory | recipe version, output quantity, wastage, open period | lock production batch id by branch |
| `depreciation_run` | Fixed Assets | Depreciation expense | Accumulated depreciation | single run per period, open period, approval | lock run id by branch and fiscal period |
| `bank_reconciliation` | Banking | Bank or clearing | Bank or clearing | statement linkage, difference explanation, approval, open period | lock reconciliation difference id by branch and fiscal period |

## Shared v311 templates

- `templates/v311/posting_batch_template.csv`
- `templates/v311/posting_batch_lines_template.csv`
- `templates/v311/posting_reversal_template.csv`

## Shared duplicate prevention pattern

All contracts are designed around the same backend pattern:

1. resolve the source document id
2. resolve the posting branch
3. call `finance_lock_posting_source(source_type, source_id, branch_id)`
4. validate the batch with `finance_validate_posting_batch(batch_id)`
5. post only when the JSONB validation summary returns `"ok": true`
