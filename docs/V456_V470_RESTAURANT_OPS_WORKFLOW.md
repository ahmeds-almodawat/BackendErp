# v456-v470 Restaurant Operations Workflow Mega Patch

## Goal

This patch turns the purchasing/material request discussion into a clear restaurant operating cycle:

```text
Material Request
→ Stock availability check
→ Reservation
→ Store Transfer OR Internal Issue OR Production Issue
→ Shortage PO grouped by supplier when needed
→ Batch No. / FEFO control
→ Request closure evidence
```

## Why this matters

A kitchen request should not always become a purchase order. The correct decision is:

| Situation | Correct final document |
|---|---|
| Stock exists in another store | Store Transfer |
| Stock exists in the same requesting store and will be consumed | Internal Issue |
| Stock is for a prep/recipe batch | Production Issue |
| Stock is insufficient | Shortage PO, split by supplier |
| Request is unnecessary | Refuse / delete with audit evidence |

## Added frontend page

`Operations → Restaurant Flow`

It shows:

- material request decision lines,
- requested / free / reserved / shortage quantities,
- recommended action,
- supplier split plan,
- Batch No. / FEFO findings,
- end-to-end cycle proof,
- CSV export.

## Backend evidence tables

Migration: `supabase/migrations/20260506245600_v456_v470_restaurant_ops_workflow.sql`

Tables:

- `restaurant_ops_workflow_snapshots`
- `restaurant_ops_material_request_decisions`
- `restaurant_ops_fulfillment_documents`
- `restaurant_ops_supplier_split_plan`
- `restaurant_ops_events`

RPC:

- `restaurant_ops_workflow_snapshot_v456()`

## Safe application method

This patch includes `scripts/apply-v456-v470-wiring.mjs` instead of blindly replacing your current `AppShell.tsx` and `package.json`.

Run:

```bash
node scripts/apply-v456-v470-wiring.mjs
npm run qa:v456-v470
npm run qa:all
supabase db reset
npm run build
npm run dev
```

## What this patch does not do

It does not mutate production stock, post GL entries, or auto-create supplier POs. It is a professional workflow cockpit and evidence layer so operators can see what should happen before the final action.
