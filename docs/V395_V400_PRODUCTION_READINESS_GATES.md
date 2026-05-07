# v395-v400 Production Readiness Gates

Date: 2026-05-06

## Goal

v395-v400 adds the final pilot-readiness evidence layer before deep production implementation.

It combines six gates:

| Version | Gate | Purpose |
|---|---|---|
| v395 | Tablet / Mobile UX Gate | Validate tablet/mobile operational experience before pilot. |
| v396 | Deployment Gate | Confirm backup, environment, build, and rollback evidence. |
| v397 | UAT Gate | Track end-to-end user acceptance scenario readiness. |
| v398 | Security Review Gate | Surface RBAC, scope, secret, and access-review blockers. |
| v399 | Production Rehearsal Gate | Require backup/restore/migration/report rehearsal evidence. |
| v400 | Pilot Release Gate | Summarize all release blockers, signoff, support, and backup status. |

## Safety

This patch is evidence-only. It does not post finance, change stock, settle POS, close periods, change payroll, send alerts, or mutate production records.

## Added Frontend Routes

- Command → UAT Gate
- Command → Release Gate
- Administration → Tablet Gate
- Administration → Deployment Gate
- Administration → Security Gate
- Administration → Rehearsal Gate

## Added Database Evidence Tables

- production_readiness_snapshots
- production_uat_scenarios
- production_security_findings
- production_rehearsal_events
- production_release_signoffs

## QA

Run:

```bash
npm run qa:v395-v400
npm run qa:all
supabase db reset
npm run build
```

## Next Step

After v400, stop adding gates and begin real backend-controlled implementation of one workflow at a time, starting with finance posting or purchasing/AP authority.
