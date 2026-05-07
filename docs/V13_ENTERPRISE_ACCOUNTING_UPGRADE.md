# v13 Enterprise Accounting Upgrade

## Purpose
Upgrade the finance area from a basic display module into a real accounting workspace inspired by enterprise accounting systems.

## Added
- Accounting Dashboard
- Chart of Accounts
- Manual Journal Entry
- Journal Register
- General Ledger
- Trial Balance
- Income Statement
- Balance Sheet
- Cash Flow Summary
- Accounts Payable Aging
- Accounts Receivable Aging
- Banking & Cash Ledger
- Fixed Asset Register
- Depreciation Run
- VAT Report
- Branch P&L
- Cost Center Financial Report
- Fiscal Period / Closing Control scaffold
- Finance Control Center
- Posting Rules documentation page

## Important accounting logic
All posted operational documents should eventually create journal entries:
- Purchase invoice: Dr Inventory, Dr VAT Input, Cr AP/Bank/Cash
- Supplier payment: Dr AP, Cr Bank/Cash
- Sales/POS: Dr Cash/Card/POS Clearing, Cr Sales, Cr VAT Output
- Recipe consumption: Dr Food Cost/COGS, Cr Inventory
- Production batch: Dr Semi-Finished Inventory, Cr Raw Material Inventory
- Depreciation: Dr Depreciation Expense, Cr Accumulated Depreciation

## Local-first
This is still a browser/local-storage trial. Supabase persistence, RLS, approval locks, attachment handling, immutable audit, and period-lock enforcement remain future backend work.
