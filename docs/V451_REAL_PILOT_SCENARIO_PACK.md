# v451 Real Pilot Scenario Pack

Date: 2026-05-06

## Goal

v451 stops feature expansion and creates a realistic one-month pilot scenario pack for proving the ERP with data.

The goal is to validate the platform as a mid-range restaurant ERP pilot by proving:

- purchase invoice posting,
- supplier payment posting,
- POS day settlement,
- production batch posting,
- stock adjustment posting,
- VAT settlement,
- finance close,
- report truth,
- backup/restore evidence,
- RBAC/RLS readiness.

## New Page

Command → Pilot Scenario

The page contains:

- pilot seed-data target,
- one-month scenario runbook,
- backend proof checklist,
- reconciliation checks,
- go/no-go rules,
- CSV exports,
- JSON export.

## New Backend Evidence

Migration:

`supabase/migrations/20260506245100_v451_real_pilot_scenario_pack.sql`

Tables:

- `pilot_scenario_seed_sets`
- `pilot_scenario_steps`
- `pilot_scenario_runs`
- `pilot_scenario_results`
- `pilot_scenario_reconciliation_checks`
- `pilot_scenario_events`

RPCs:

- `pilot_scenario_catalog()`
- `pilot_record_scenario_result(...)`

## Why This Is Important

The app now has many workflows, gates, workers, and server-side posting functions. v451 creates the evidence pack required to prove that all those pieces work together.

No more large feature patches should be added until this scenario is executed with realistic data.

## QA

Run:

```bash
node scripts/apply-v451-wiring.mjs
npm run qa:v451
npm run qa:all
supabase db reset
npm run build
npm run dev
```

## Go / No-Go Rules

No pilot go-live if:

- trial balance is not balanced,
- duplicate posting is not blocked,
- branch/RBAC scope is not proven,
- backup restore is not tested,
- reports cannot drill down to posted evidence.
