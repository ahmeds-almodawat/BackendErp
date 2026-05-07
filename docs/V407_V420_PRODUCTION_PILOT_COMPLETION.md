# v407-v420 Production Pilot Completion Mega Patch

Date: 2026-05-06

## Purpose

This patch completes the first backend-authoritative pilot layer by adding one professional Pilot Center and a durable backend evidence catalog.

It does **not** pretend the ERP is fully production-live. It gives operators and developers the cockpit needed to prove the backend posting workflows from v401-v406 against a fresh local Supabase reset.

## Included Scope

| Version | Area | Result |
|---|---|---|
| v407 | Backend posting test harness | Pilot Center page lists and can call critical posting RPCs. |
| v408 | Purchase invoice UI connection | `purchasing_post_purchase_invoice` exposed from the Pilot Center. |
| v409 | Supplier payment UI connection | `purchasing_post_supplier_payment` exposed from the Pilot Center. |
| v410 | POS settlement UI connection | `sales_post_pos_batch` exposed from the Pilot Center. |
| v411 | Production batch UI connection | `production_post_batch` exposed from the Pilot Center. |
| v412 | Stock adjustment/count UI connection | `inventory_post_adjustment` and `inventory_post_stock_count` exposed from the Pilot Center. |
| v413 | VAT settlement and period close UI connection | `finance_post_vat_settlement` and `finance_close_period` exposed from the Pilot Center. |
| v414 | Demo/UAT evidence | Pilot checklist and backend catalog tables. |
| v415 | RBAC/RLS proof support | Required permission shown beside every critical RPC. |
| v416 | Report truth proof support | Checklist requires report reconciliation after postings. |
| v417 | Backup/restore proof support | Checklist requires a backup/restore drill. |
| v418 | Operator error messages | RPC console renders success/error JSON and user notification. |
| v419 | UI simplification | One Pilot Center page instead of many noisy final-version pages. |
| v420 | Pilot release readiness | Final checklist, score and evidence export. |

## New Frontend Page

Navigation:

```text
Command → Pilot Center
```

The page shows:

- backend posting RPC catalog,
- local candidate documents,
- direct Supabase RPC proof buttons,
- pilot checklist,
- readiness score,
- findings,
- CSV evidence export.

## New Backend Evidence Objects

Migration:

```text
supabase/migrations/20260506240700_v407_v420_pilot_completion.sql
```

Tables:

- `pilot_completion_snapshots`
- `pilot_completion_events`
- `pilot_posting_rpc_catalog`
- `pilot_release_checklist`

RPCs:

- `pilot_completion_rpc_readiness()`
- `pilot_record_completion_snapshot(...)`

## Acceptance Commands

```bash
npm run qa:v407-v420
npm run qa:all
supabase db reset
npm run build
npm run dev
```

## Pilot Definition of Done

The pilot is ready when:

1. `supabase db reset` passes from zero.
2. `npm run qa:all` passes.
3. `npm run build` passes.
4. Each v401-v406 posting RPC is run once with realistic Supabase data.
5. Trial balance, VAT, AP and inventory evidence reconcile after posting.
6. Backup/restore drill is completed.
7. UAT owners sign off purchasing, inventory, POS, production, finance close and HR flows.
