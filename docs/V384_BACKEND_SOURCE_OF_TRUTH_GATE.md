# v384 Backend Source of Truth Gate

Date: 2026-05-06

## Goal

v384 makes the platform's source-of-truth status explicit before production cutover.

The ERP now has worker lanes, backup/restore, backend mode, and RBAC gates. v384 connects those foundations into a single authority map that answers:

- Which workflows are still local/demo authority?
- Which workflows have backend tables/RPCs/workers but still need proof?
- Which workflows are blocked from production?
- What exact gate must be closed before production mode?

## Added Page

Administration -> Source of Truth

The page shows:

- authority score,
- production blockers,
- workflow authority map,
- backend object readiness,
- local browser-state risk inventory,
- cutover rule,
- CSV audit export.

## Added Backend Evidence

Migration:

`supabase/migrations/20260506238400_v384_backend_source_of_truth_gate.sql`

Tables:

- `backend_authority_snapshots`
- `backend_authority_events`
- `backend_authority_registry`

RPC:

- `backend_authority_record_snapshot`

The snapshot RPC is service-role only. The browser page is currently an evidence/view gate and should not directly write production snapshots.

## Production Rule

Do not enable production mode until every critical workflow is backend-authoritative or has a proven worker-backed handoff with RLS, audit, restore, and report reconciliation evidence.

## QA

Run:

```bash
npm run qa:v384
npm run qa:all
supabase db reset
npm run build
```

## Next Patch

v385 should start completing real purchasing workflow authority, because purchasing connects supplier invoice, receiving, AP, inventory, VAT, and finance posting.
