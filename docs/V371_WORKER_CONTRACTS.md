# v371 Worker Contracts Patch

Date: 2026-05-06

v371 turns v370 local queue runs into backend-ready worker handoff contracts.

Delivered:

- `src/engines/enterpriseV371WorkerContractEngine.ts`
- `src/modules/EnterpriseV371WorkloadPage.tsx`
- Workload Ops `Workers` tab.
- Worker contract JSON/CSV exports.
- Lease seconds by lane.
- Idempotency keys per run/checkpoint.
- Retry and dead-letter policy.
- Required Supabase secret manifest.
- Readiness blockers when backend config is missing or a run is failed/cancelled.

This still does not execute production jobs. It defines the exact contract a future worker should honor.

Run:

```bash
npm run qa:v371
npm run qa:all
```
