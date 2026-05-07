# Ultra Professional Enterprise ERP Roadmap

Date: 2026-05-05

## Current Position

This workspace has a strong prototype/foundation layer:

- Local ERP shell with finance, purchasing, inventory, production, sales, HR, access, imports, controls, smart analytics, and reports.
- v311 posting-engine foundation with contracts, validation, source locks, reversals, SQL migration, and domain QA.
- v312 import staging/cutover foundation with mapping profiles, approval, duplicate hash design, rollback, SQL migration, and domain QA.
- v313 reporting-truth foundation with explainable report sources, truth scoring, findings, management packs, SQL migration, and domain QA.
- Production build, strict TypeScript, code-splitting, and vendor chunking are green.

## What Is Still Missing

### 1. Real Backend Execution

The biggest gap is that many workflows are still local/prototype or foundation-only. A production ERP must move posting, approvals, imports, fiscal locks, and reporting truth into Supabase/Postgres RPCs or Edge Functions.

Must finish:

- Apply and test migrations in a real Supabase project.
- Replace local journal mutations with v311 `posting_batches`.
- Enforce approval/post/reversal transitions server-side.
- Persist source locks before posting to stop duplicates.
- Make database constraints/RLS the final authority, not UI state.

### 2. End-to-End Transaction Workflows

Core ERP documents exist, but they are not yet fully backend-connected through a controlled lifecycle.

Must finish:

- Purchase request -> PO -> GRN -> supplier invoice -> AP payment -> posting.
- Inventory opening stock -> movement ledger -> stock count -> adjustment -> posting.
- POS/Foodics import -> staging -> approval -> cutover -> posting -> reconciliation.
- Production recipe -> batch -> consumption/output -> inventory/GL posting.
- HR/user access -> approval matrix -> audit logs.

### 3. Reporting From Posted Truth

Reports currently mix local state, foundation builders, and truth-model stubs. Enterprise reporting must come from posted, locked, explainable sources.

Must finish:

- Compute trial balance, GL, P&L, balance sheet, cash/bank, VAT, AP aging, inventory valuation, COGS, menu profitability, and branch P&L from posted v311/v312 sources.
- Store report snapshots and source tables/filters.
- Gate executive dashboards when truth status is not trusted.
- Add drill-down from every KPI to source documents and posting lines.

### 4. Security, Compliance, And Governance

The app has access concepts, but enterprise readiness requires hard enforcement.

Must finish:

- Supabase Auth user lifecycle with employee linkage.
- RLS policies by company, branch, store, cost center, and role.
- Approval authority matrix.
- Immutable audit trail for create/update/approve/post/reverse/import/export.
- Attachment storage with retention rules.
- Backup/restore, recovery testing, and environment separation.

### 5. Architecture And Maintainability

The app works, but `AppShell.tsx` is still too large for enterprise maintainability.

Must finish:

- Split each module into route-level files.
- Move shared domain logic into engines/services with tests.
- Add API/data-provider interfaces per module.
- Add error/loading/empty states per route.
- Add route-level regression tests.

### 6. Professional UX And Operations

The interface is broad and useful, but enterprise polish needs consistency and operator confidence.

Must finish:

- Role-specific dashboards.
- Guided workflows with clear next action, blockers, and audit reason capture.
- Import review workbench with row-level corrections.
- Report pack export to Excel/PDF.
- Bilingual Arabic/English copy cleanup and encoding cleanup.
- Mobile/tablet QA for manager review flows.

### 7. Automated Quality Gates

Domain smoke QA exists for v311-v313, but the project still needs layered automated testing.

Must finish:

- Unit tests for every domain engine.
- Integration tests against local Supabase.
- Browser smoke tests for critical workflows.
- Migration tests and seed-data tests.
- Performance budget checks for bundle size and report generation.

## Roadmap

### Phase 1: Stabilize The Foundation

Goal: make the current repo reliable and reviewable.

- Keep `npm run qa:domain`, `npm run typecheck`, and `npm run build` green.
- Create a clean release branch for v313 foundation work.
- Add posting/import/reporting QA to CI.
- Clean README/version history so v313 is the visible current release.
- Start splitting `AppShell.tsx` by route without changing behavior.

Exit gate:

- One command validates domain QA, typecheck, and build.
- No unexplained uncommitted generated files.
- v311-v313 docs, migrations, templates, and QA scripts are aligned.

### Phase 2: Backend Cutover MVP

Goal: make Supabase the source of truth for setup, users, imports, posting, and reports.

- Apply v310-v313 migrations in a test Supabase project.
- Wire data provider methods for posting batches, import staging, fiscal periods, and reporting snapshots.
- Replace direct local posting with server-side `posting_batches`.
- Call import RPCs in order: validate -> approve -> cutover -> post -> rollback request.
- Add RLS smoke tests for user/branch separation.

Exit gate:

- A purchase invoice, POS batch, opening stock file, and manual journal can post through backend-controlled flows.
- Duplicate imports/postings are blocked by database locks.
- Posted records cannot be edited except by reversal/correction.

### Phase 3: Accounting And Inventory Truth

Goal: make finance and inventory reports trustworthy.

- Compute trial balance, GL, P&L, balance sheet, VAT, AP, inventory valuation, and COGS from posted lines.
- Add inventory movement ledger and costing snapshots.
- Connect stock counts and adjustments to v311 posting.
- Store report truth snapshots with sources and findings.
- Add KPI drill-down to documents and posting lines.

Exit gate:

- Trial balance balances from posted data.
- Inventory valuation reconciles to inventory postings.
- Dashboard truth score blocks untrusted management packs.

### Phase 4: Operational Workflow Completion

Goal: complete restaurant ERP workflows end to end.

- Purchasing: requisition, PO, GRN, invoice, payment, supplier statement.
- Inventory: item master, lots, bins, expiry, transfers, counts, adjustments, returns.
- Production: recipes, batch production, yield/wastage, WIP/finished goods.
- Sales/POS: Foodics imports, payments, menu mix, branch settlement.
- HR/access: users, employee linkage, shifts, attendance, permissions.

Exit gate:

- A realistic month-end restaurant scenario runs from imports and operations to financial statements.
- Exceptions are visible, actionable, and auditable.

### Phase 5: Enterprise Hardening

Goal: make the system pilot-ready for real operators.

- Add CI pipeline for lint/typecheck/domain QA/build/migration smoke.
- Add local Supabase seed/reset scripts.
- Add monitoring, error boundaries, audit exports, and backup checks.
- Add role-based navigation and permission-gated actions.
- Add CSV/XLSX import correction files and Excel/PDF report packs.
- Add Arabic/English copy review and encoding cleanup.

Exit gate:

- Pilot users can run daily operations with no developer intervention.
- Admin can explain every posted number back to source documents.
- Recovery, permissions, and audit evidence are demonstrable.

### Phase 6: Production Readiness

Goal: move from pilot to production-grade ERP.

- Performance test large imports and reports.
- Security review RLS, storage policies, service keys, and audit immutability.
- Data migration plan from legacy Excel/Foodics/accounting systems.
- Training materials and SOPs.
- Release management, rollback plan, and support process.
- Multi-company/branch scaling model if needed.

Exit gate:

- Signed-off UAT.
- Tested backup/restore.
- Locked production migration plan.
- Operational support playbook ready.

## Recommended Next Sprint

Do this next, in order:

1. Add CI-style `qa:domain && typecheck && build` script.
2. Split AppShell into route modules, starting with Imports and Reports.
3. Wire v311 posting engine to one real workflow: manual journal or purchase invoice.
4. Wire v312 import staging to Supabase RPCs for one file type.
5. Compute v313 trial balance truth from posted v311 batches.
6. Add a month-end demo scenario that proves posting -> reporting -> truth score.

## Enterprise Definition Of Done

The ERP is ultra professional when:

- Every financial number comes from posted, locked, auditable source data.
- Every import has staging, mapping, validation, approval, duplicate detection, cutover, and rollback.
- Every report states its source tables, filters, missing data, findings, and trust score.
- Every critical action is permissioned, logged, reversible, and server-enforced.
- Every module has automated domain tests and at least one end-to-end smoke test.
- The app can be deployed, restored, audited, and operated by non-developers.
