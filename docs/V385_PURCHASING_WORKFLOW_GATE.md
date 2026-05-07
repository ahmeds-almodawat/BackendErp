# v385 Purchasing Workflow Gate

Date: 2026-05-06

## Goal

v385 adds a purchasing workflow evidence gate before deeper purchasing/AP posting work.

It does **not** post accounting entries, settle AP, modify inventory, or close supplier invoices. It makes the purchasing lifecycle readiness visible and exportable.

## Added UI

Administration / Operations page:

- `Purchasing Gate`

The page reviews:

1. supplier master readiness,
2. purchase requests,
3. purchase orders,
4. goods receipts,
5. supplier invoices,
6. supplier payments,
7. document linking evidence,
8. local blockers before backend cutover.

## Added Engine

- `src/engines/enterpriseV385PurchasingWorkflowEngine.ts`

It generates:

- workflow score,
- production gate status,
- lifecycle stage rows,
- document-linking sample,
- findings and actions,
- CSV export.

## Added Migration

- `supabase/migrations/20260506238500_v385_purchasing_workflow_gate.sql`

Tables:

| Table | Purpose |
|---|---|
| `purchasing_workflow_gate_snapshots` | Snapshot of purchasing readiness score, stages, document links, findings, and next action. |
| `purchasing_workflow_gate_findings` | Structured findings for audit and pilot readiness review. |
| `purchasing_workflow_gate_events` | Evidence events for snapshot recording. |

Service-role RPC:

- `worker_record_purchasing_workflow_gate_snapshot(...)`

## Production Rule

Purchasing is not production-ready until request/PO/GRN/invoice/payment evidence is complete and backend posting authority proves:

- inventory receipt movement,
- AP liability,
- VAT input,
- supplier statement allocation,
- payment settlement,
- reversal-only corrections.

## QA

Run:

```bash
npm run qa:v385
npm run qa:all
supabase db reset
npm run build
```

## Next Patch

v386 should add Inventory Workflow Completion Gate or connect the purchasing evidence to backend AP posting proof.
