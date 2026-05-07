# v369 Mid-Range Heavy Work Patch

Date: 2026-05-06

## Intent

v369 changes the local product posture from "ultra enterprise at every edge" to a practical mid-range restaurant ERP platform that can still handle heavy work safely.

The goal is not to make every operator screen process millions of rows directly. The goal is to keep daily screens responsive while bulk imports, posting replay, report rebuilds, reconciliation sweeps, and audit archive work move through chunked, resumable lanes.

## Delivered

- Added `src/engines/enterpriseV369WorkloadEngine.ts`.
- Added `src/modules/EnterpriseV369WorkloadPage.tsx`.
- Added a new `Workload Ops` command route.
- Added dataset budgets for mid-range and heavy-work thresholds.
- Added execution lanes:
  - `interactive` for small user actions.
  - `background` for chunked imports and recalculation.
  - `scheduled` for heavy backfills and report rebuilds.
  - `archive` for retention, backups, and old audit/POS rows.
- Added a heavy-job catalog for imports, inventory recalculation, POS replay, report rebuilds, finance reconciliation, RLS sweeps, audit archive, and backup export.
- Added guardrails for backend readiness, browser hot-state size, dataset budgets, posting integrity, approval backlog, and interactive safety.
- Added CSV/JSON evidence exports and audit rehearsal logging.

## Mid-Range Budgets

The v369 evaluator treats the app as a strong mid-range platform by default:

| Dataset | Mid-range target | Heavy-work ceiling |
|---|---:|---:|
| Items / SKUs | 25,000 | 150,000 |
| Recipe lines | 100,000 | 500,000 |
| Stock movements | 500,000 | 2,500,000 |
| Sales / POS rows | 1,000,000 | 5,000,000 |
| Journal entries | 250,000 | 1,000,000 |
| Audit log rows | 750,000 | 4,000,000 |

Rows above the mid-range target must run through chunked jobs. Rows above the heavy-work ceiling should be archived, snapshotted, or moved to backend scheduled processing before live production use.

## QA

Run:

```bash
npm run qa:v369
npm run qa:v368
npm run typecheck
npm run build
```

`qa:all` now includes the v369 scan before TypeScript and production build.
