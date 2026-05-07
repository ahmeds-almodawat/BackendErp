# Current Local Status

Date: 2026-05-06

## Product Position

The local workspace is now aligned around **v371 Worker Contracts Patch**.

The visible app now surfaces:

- v371 worker contracts with leases, idempotency keys, retry policies, payload manifests, required secrets, and backend-readiness blockers.
- v370 Workload Ops queue with dry-run enqueue, batch advance, pause/resume, review markers, checkpoint evidence, and queue exports.
- v369 Workload Ops route with mid-range dataset budgets, heavy-job lanes, batch sizing, guardrails, runbook steps, and evidence exports.
- v368 modular shell identity with Smart Analysis, Import / Export, Reports, Enterprise Upgrade, and Workload Ops lazy-loaded as route-owned modules.
- Enterprise Upgrade command center with live gate scoring, module permission coverage, backend posture, refactor pressure, upgrade waves, QA, and evidence exports.
- v366 truth/security repair guardrails for production fallback, migration ID consistency, permission helpers, storage buckets, RLS guardrails, and loose-end scanning.
- v312 import staging controls and v313 reporting truth panels.

## Engineering Status

- Baseline `npm run qa:v366` passes with 0 critical findings and expected warnings around remaining Edge Function skeletons/RLS policy review.
- Baseline `npm run typecheck` passes.
- Package metadata identifies the app as `restaurant-erp-v371-worker-contracts-patch` at `1.0.71`.
- QA scripts now include `qa:v371`, and `qa:all` includes the v371 gate before typecheck/build.
- `src/app/AppShell.tsx` is down to the enforced v368 budget after extracting Smart Analysis, Import / Export, and Reports.

## Next Professional Push

- Run `npm run qa:v371`, `npm run qa:v370`, `npm run qa:v369`, `npm run qa:v368`, `npm run qa:v367`, `npm run qa:v366`, `npm run typecheck`, and `npm run build` as the local v371 gate.
- Replace remaining skeleton Edge Functions with audited posting/import/close implementations.
- Run Supabase migrations and RLS tests on a clean staging project.
- Convert v371 worker contracts into real Edge Function / worker execution after the v366 warnings are closed.
- Continue splitting the remaining large finance/inventory/purchasing route logic into route-owned module packages.
- Capture backup/restore, UAT seed, rollback, and monthly close rehearsal evidence before live finance data.
