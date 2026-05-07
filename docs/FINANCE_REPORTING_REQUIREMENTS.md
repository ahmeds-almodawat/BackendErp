# Finance reporting requirements (v313 foundation)

## Minimum safe reporting gates

1. **Posting validation** must block unbalanced batches before they become posted truth.
2. **Fiscal period enforcement** must block posting into locked/closed periods.
3. **Immutability**: posted records cannot be edited; use reversals.

## Trial Balance (required)

The trial balance report must:

- compute total debit and total credit for the period
- surface **imbalance** (debit - credit)
- classify truth:
  - **critical** if imbalance is non-zero beyond tolerance
  - **incomplete** if required sources are missing

## General Ledger (next)

GL needs:

- account-level rollups and transaction listing with pagination
- stable filters: branch, period, date range, account_code
- source links back to posting batches and source documents

## Income Statement / Balance Sheet (next)

These require COA classification:

- revenue/expense for income statement
- asset/liability/equity for balance sheet

Do not “fake” these rollups from UI assumptions; the backend must define account groupings.

