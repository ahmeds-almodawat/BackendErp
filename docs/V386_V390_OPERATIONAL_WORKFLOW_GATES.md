# v386-v390 Operational Workflow Gates Mega Patch

Date: 2026-05-06

## Goal

This patch adds five operational readiness gates in one controlled release:

| Version | Page | Purpose |
|---|---|---|
| v386 | Inventory Gate | Stock master, movement, lot/bin/expiry, transfer, and approval readiness. |
| v387 | Sales / POS Gate | POS replay, menu mapping, payment settlement, recipe/COGS readiness. |
| v388 | Production Gate | Recipe, production batch, yield, wastage, and stock deduction readiness. |
| v389 | Finance Close Gate | Trial balance, fiscal period, bank reconciliation, AP/AR, and close evidence. |
| v390 | HR / Attendance Gate | Employee/user linkage, roles, access scope, attendance, and schedules. |

## Safety

This is an evidence/gate patch only. It does **not** post accounting entries, stock movements, sales settlements, production consumption, or payroll.

## Added UI Routes

- Operations → Inventory Gate
- Operations → Sales Gate
- Operations → Production Gate
- Administration → Finance Close Gate
- Administration → HR Gate

## Added Backend Evidence

The migration adds:

- `operational_workflow_gate_snapshots`
- `operational_workflow_gate_events`
- `worker_record_operational_workflow_gate_snapshot(...)`
- `worker_record_operational_workflow_gate_event(...)`

Worker functions are service-role only.

## QA

Run:

```bash
npm run qa:v386-v390
npm run qa:all
supabase db reset
npm run build
```

## Next Suggested Patch

After these gates are stable, move to real backend authority per module, starting with the highest-risk flow:

1. inventory ledger authority,
2. POS settlement authority,
3. production posting authority,
4. finance close authority,
5. HR attendance authority.
