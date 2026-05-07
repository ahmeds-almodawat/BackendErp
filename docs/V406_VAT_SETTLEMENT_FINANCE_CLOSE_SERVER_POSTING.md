# v406 VAT Settlement / Finance Close Server Posting

Date: 2026-05-06

## Goal

v406 adds the next backend-authoritative finance workflow after purchasing, payments, POS, production, and stock adjustments:

1. VAT settlement posting.
2. Fiscal period close locking.
3. Evidence tables for settlement, close, checks, and audit.
4. Service-side RPCs that run in the database, not in the browser.

## Added Tables

| Table | Purpose |
|---|---|
| `vat_settlement_server_runs` | Canonical VAT settlement run header with period, branch, totals, status, and posting batch reference. |
| `vat_settlement_server_lines` | VAT input/output/source evidence used to build the settlement. |
| `finance_close_server_runs` | Period close run header with checks, blockers, close status, and audit evidence. |
| `finance_close_server_checks` | Individual close checks such as unposted documents, unreconciled VAT, and open jobs. |
| `finance_close_server_events` | Append-style evidence and audit events for VAT settlement and period close. |

## Added RPCs

| RPC | Purpose |
|---|---|
| `finance_post_vat_settlement_server` | Calculates VAT input/output, creates settlement evidence, optionally creates server posting lines, and marks the VAT run posted. |
| `finance_close_period_server` | Runs pre-close checks and locks/closes the fiscal period only when blockers are resolved or explicit force option is supplied. |
| `finance_post_vat_settlement` | Compatibility wrapper for older callers. |
| `finance_close_period` | Compatibility wrapper for older callers. |

## Safety Rules

The backend checks:

- permission when the app permission helper exists,
- fiscal period exists when the period table exists,
- duplicate VAT settlement prevention,
- no close before VAT settlement unless forced,
- open worker jobs as close blockers,
- unposted operational documents where known tables exist,
- all state changes happen server-side with evidence rows.

## What v406 Does Not Do Yet

v406 does not replace a full tax filing workflow or government e-invoicing integration. It creates the ERP-side period VAT settlement and period close authority.

## QA

Run:

```bash
node scripts/apply-v406-package-wiring.mjs
npm run qa:v406
npm run qa:all
supabase db reset
npm run build
```
