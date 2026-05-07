# v366 Enterprise Truth & Security Repair Notes

## What this patch fixes

1. **Broken QA script paths**
   - Fixed `qa:v335-v339` through `qa:v361-v365` so they point to existing `scripts/qa-*.mjs` files instead of missing `scripts/qa:*.mjs` files.

2. **Unsafe production fallback**
   - Production runtime now hard-blocks startup if Supabase is not configured.
   - Local demo fallback remains available only outside production.
   - Runtime mode can be controlled with `VITE_RUNTIME_MODE=local-demo|staging|production`.

3. **Migration ID-type mismatch**
   - The current setup persistence model uses text IDs for branches, stores, items, suppliers, and related setup records.
   - Later migrations were repaired so master-data foreign keys use `text` consistently instead of mixing `uuid` references to text primary keys.
   - This is the safest repair for the current ZIP because the setup/export bridge already emits local text IDs.

4. **Permission guard helpers**
   - Added `public.app_assert_permission(required_permission text)`.
   - Added `public.app_current_user_can_access_branch(target_branch_id text, requested_access text default 'view')`.
   - Future RPCs should call these before posting, approving, reversing, exporting, or closing periods.

5. **RLS guardrails**
   - Added conservative read/write guard policies for late-stage live/backend tables.
   - These are not a replacement for final table-by-table business policies, but they prevent obvious dead/open-table states during staging.

6. **Document storage buckets**
   - Added private buckets for supplier, purchase, finance, and stock-count documents.
   - Added authenticated storage policies based on finance, purchasing, inventory, and settings permissions.

7. **Static loose-end scanner**
   - Added `npm run qa:v366`.
   - It generates `docs/V366_ENTERPRISE_LOOSE_ENDS_REPORT.md` and fails only on critical static issues.

## Important remaining loose ends

This patch does **not** magically make skeleton Edge Functions production-ready. It makes those loose ends visible and blocks the most dangerous config/migration traps.

Before using real finance/inventory data, still implement and test:

- Real finance posting RPC/function body.
- Real inventory posting body.
- Real Foodics staging/posting body.
- Real approval workflow body.
- Real period close body.
- RLS tests with multiple roles and branches.
- End-to-end posting/reversal/reporting test.
- Full Supabase `db reset` test on a clean local/staging project.

## Recommended next command sequence

```bash
npm install
npm run qa:v366
npm run typecheck
npm run build
supabase start
supabase db reset
```

If `supabase db reset` fails, fix the first SQL error before continuing. Do not bypass failed migrations with manual table changes.
