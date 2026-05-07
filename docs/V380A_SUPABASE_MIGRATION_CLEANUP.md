# v380a Supabase Migration Cleanup

Date: 2026-05-06

## Why This Patch Exists

No Supabase project has been created yet, so the project can still clean its migration history before the first real `supabase db reset`.

The immediate compatibility risk is PostgreSQL policy syntax. Some generated migrations used:

```sql
create policy if not exists policy_name on public.table_name ...
```

PostgreSQL does not support `IF NOT EXISTS` for `CREATE POLICY`. A clean Supabase reset can fail on that syntax even when static QA passes.

## What v380a Does

v380a adds:

1. `npm run repair:migrations:policy-syntax`
2. `npm run qa:v380a`
3. this cleanup runbook
4. a generated repair report
5. a QA report that fails if unsupported policy syntax remains

The repair script rewrites every detected policy to:

```sql
drop policy if exists policy_name on public.table_name;

create policy policy_name
on public.table_name
...
;
```

This makes migrations safer to replay on a brand-new Supabase project.

## Required Command Order

Run from the repo root:

```bash
npm run repair:migrations:policy-syntax
npm run qa:v380a
npm run qa:all
```

Then commit the changed migration files and generated reports.

## Squash Strategy

Because there is no live Supabase project yet, a future squash is allowed. However, do not manually delete historical migrations until one of these is true:

1. A clean `supabase db reset` passes with the repaired migrations, or
2. A full baseline migration has been generated and validated from a clean database dump.

Recommended path:

1. Repair syntax now.
2. Run local Supabase reset.
3. If reset passes, decide whether to keep history or squash.
4. If reset fails due to deeper old-migration conflicts, create a new `00000000000000_baseline.sql` and move old migrations to `supabase/migrations_archive/`.

## Next Step After v380a

After the migration syntax repair passes, continue to:

- v381 Backup/Archive Worker, or
- baseline squash if `supabase db reset` still fails.
