# v391-v394 Operational Confidence Gates

Date: 2026-05-06

## Goal

This mega patch adds four operational-confidence gates after the workflow-gate layer:

| Version | Gate | Purpose |
|---|---|---|
| v391 | Report Pack Gate | Confirms management packs have finance, inventory, sales, snapshot, export, and audit evidence. |
| v392 | Alerts & Exceptions Gate | Confirms operational exceptions have sources, owners, SLA logic, and notification readiness. |
| v393 | Support Diagnostics Gate | Confirms support can export diagnostics, trace actions, and prove backup/restore evidence. |
| v394 | Performance Budget Gate | Confirms heavy work is routed to workers and has row/load budget evidence. |

## Safety Scope

This is still a gate/evidence layer. It does not mutate accounting, inventory, POS, HR, payroll, alert rows, or production settings.

## Added Tables

- `operational_confidence_snapshots`
- `operational_alert_rules`
- `operational_alert_events`
- `support_diagnostics_runs`
- `performance_budget_snapshots`

## QA

Run:

```bash
npm run qa:v391-v394
npm run qa:all
supabase db reset
npm run build
```

## Next Patch

v395 should start UAT operator polish: guided scenarios, role-based checklists, and pilot sign-off flow.
