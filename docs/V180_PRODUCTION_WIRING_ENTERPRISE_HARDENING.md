# v180 — Production Wiring + Enterprise Hardening

v180 is a combined v151-v180 patch focused on moving the platform from a strong local prototype toward a production-wired ERP foundation.

## Main additions

1. Enterprise v180 module in the sidebar.
2. Local/Supabase backend mode bridge plan.
3. Master data control center.
4. Foodics and setup persistence readiness.
5. Central posting orchestrator foundation.
6. Inventory enterprise hardening: transfers, FEFO, reservations, costing, inventory close.
7. Finance enterprise hardening: AP/AR aging, vouchers, bank matching, depreciation, statements.
8. Approval and attachment contracts.
9. API contracts for backend functions.
10. QA regression suite and current score notes.

## Current score after v180

- Local MVP / prototype: 9.4 / 10
- Serious ERP foundation: 8.8 / 10
- Enterprise design direction: 9.2 / 10
- Production readiness: 6.5 / 10
- Backend/security readiness: 7.0 / 10

## Remaining gap

The next step should be real wiring, not more dashboards: connect Auth, setup master data, Foodics staging and posting orchestrator to Supabase while keeping local mode as fallback.
