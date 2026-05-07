# v311 Backend Posting Engine Foundation

## Purpose

v311 adds the first backend-oriented posting engine foundation on top of the v309 finance truth layer and the v310 enterprise foundation.

This release is intentionally additive:

- existing UI stays in place
- App.tsx and AppShell remain stable
- no existing v309 finance table is removed or renamed
- the Supabase migration is created only as a file and is not applied automatically

## Added files

### TypeScript foundation

- `src/modules/finance/postingEngine/postingTypes.ts`
- `src/modules/finance/postingEngine/postingContracts.ts`
- `src/modules/finance/postingEngine/postingValidation.ts`
- `src/modules/finance/postingEngine/postingReversal.ts`
- `src/modules/finance/postingEngine/index.ts`
- `src/modules/finance/postingEngine/PostingEnginePanel.tsx`

### Database foundation

- `supabase/migrations/20260505231100_v311_backend_posting_engine.sql`

### Templates

- `templates/v311/posting_batch_template.csv`
- `templates/v311/posting_batch_lines_template.csv`
- `templates/v311/posting_reversal_template.csv`

### Documentation

- `docs/V311_BACKEND_POSTING_ENGINE.md`
- `docs/FINANCE_POSTING_CONTRACTS.md`
- `docs/POSTING_VALIDATION_RULES.md`

## What the TypeScript foundation covers

- canonical posting batch and posting line types
- posting contracts for nine source types
- validation rules for structure, balancing, immutability, period control, reversal linkage, and duplicate prevention design
- reversal helper that mirrors posted lines instead of mutating the original batch
- optional standalone dashboard panel component that is not mounted into AppShell

## What the SQL foundation adds

The migration introduces additive v311 tables:

- `posting_batches`
- `posting_batch_lines`
- `posting_validation_findings`
- `posting_reversals`
- `posting_source_locks`

It also adds:

- `public.finance_validate_posting_batch(batch_id uuid)` returning a JSONB summary
- `public.finance_can_post_to_period(period_id uuid)` returning a boolean
- `public.finance_lock_posting_source(source_type text, source_id text, branch_id uuid)` returning a lock id
- indexes for posting lookups, duplicate prevention, reversal linkage, and validation finding access
- RLS enablement with finance-oriented read/write policies
- immutability and period-guard triggers for v311 posting tables

## Compatibility notes

- v309 `finance_posting_batches` and `finance_posting_batch_lines` remain untouched.
- v311 tables are designed to coexist beside the v309 finance tables.
- The new `finance_validate_posting_batch(uuid)` implementation validates both v311 batches and legacy v309 batches, but the return shape is now JSONB rather than the old set-returning row format.
- Legacy v309 batches receive compatibility warnings for missing v311-only controls such as `fiscal_period_id` on the batch header and `posting_source_locks`.

## Recommended next steps after v311

- wire source modules to create `posting_batches` instead of direct local journals
- call `finance_lock_posting_source` before final posting
- move approval transitions and posting actions into backend functions or Edge Functions
- add reconciliation from v311 batches into the current finance truth layer dashboards
