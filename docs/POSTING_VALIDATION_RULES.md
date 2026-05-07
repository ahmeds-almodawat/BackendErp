# Posting Validation Rules

The v311 foundation formalizes these backend posting rules.

## Required rules

1. Posting batch must have source type.
2. Posting batch must have branch id.
3. Posting batch must have fiscal period id.
4. Debit and credit must balance.
5. Amount must be positive and single-sided at line level.
6. Posted batches are immutable.
7. Closed or locked fiscal periods cannot be posted.
8. Reversal must reference original posting batch.
9. Duplicate source document prevention must be designed and enforced through source locks plus duplicate checks.

## Where the rules live

### TypeScript

- `src/modules/finance/postingEngine/postingValidation.ts`
- `src/modules/finance/postingEngine/postingReversal.ts`

TypeScript provides the frontend-safe contract and validation foundation so future workflows can dry-run posting before server submission.

### SQL

- `supabase/migrations/20260505231100_v311_backend_posting_engine.sql`

The SQL layer adds:

- line-level amount checks on `posting_batch_lines`
- duplicate-prevention indexes on `posting_batches` and `posting_source_locks`
- immutable-row triggers for `posting_batches` and `posting_batch_lines`
- `finance_can_post_to_period(period_id uuid)`
- `finance_validate_posting_batch(batch_id uuid)`

## JSONB validation summary

`finance_validate_posting_batch(uuid)` returns:

```json
{
  "ok": true,
  "critical_count": 0,
  "warning_count": 1,
  "findings": []
}
```

`ok` is true only when no critical findings remain.

## Legacy compatibility

The v311 validator can still inspect legacy v309 finance batches, but it will produce warnings when legacy data does not contain v311-only controls such as:

- batch-level `fiscal_period_id`
- active `posting_source_locks`
- v311 reversal references
