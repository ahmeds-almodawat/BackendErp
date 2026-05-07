# v370 Resumable Work Queue Patch

Date: 2026-05-06

## Intent

v370 turns the v369 heavy-work plan into a local resumable queue foundation.

The app remains a mid-range restaurant ERP: operator screens stay direct and responsive, while heavy work is queued as dry-run or future backend jobs with checkpoint evidence.

## Delivered

- Added `src/engines/enterpriseV370JobRunnerEngine.ts`.
- Added `src/modules/EnterpriseV370WorkloadPage.tsx` as the route-owned v370 entry.
- Extended Workload Ops with a `Queue` tab.
- Added queue candidates from the v369 heavy-job catalog.
- Added queue run state stored in `state.workloadRuns`.
- Added operator actions:
  - Queue dry-run.
  - Advance one batch.
  - Pause.
  - Resume.
  - Mark for review.
- Added queue evidence exports:
  - `v370_queue_snapshot.json`
  - `v370_queue_candidates.csv`
  - `v370_queue_runs.csv`
  - `v370_lane_queue.csv`
- Added audit events for enqueue, advance, complete, pause, resume, duplicate blocking, and review markers.

## Queue Contract

| Status | Meaning |
|---|---|
| `queued` | The work is planned and waiting for an operator or backend worker. |
| `running` | At least one batch has advanced and the checkpoint moved. |
| `paused` | Operator intentionally held the run. |
| `completed` | All batches or all rows are processed. |
| `failed` | The run needs review before more work continues in that lane. |
| `cancelled` | Reserved for future explicit cancellation. |

## Practical Use

Use Workload Ops to queue a dry-run for a heavy task, advance it batch-by-batch, inspect checkpoints, and export evidence before converting the task to a backend worker.

This is still a local foundation. Production heavy work should move to Supabase/worker execution once the remaining v366 Edge Function and RLS caveats are closed.

## QA

Run:

```bash
npm run qa:v370
npm run qa:v369
npm run typecheck
npm run build
```

`qa:all` now includes the v370 queue scan before TypeScript and production build.
