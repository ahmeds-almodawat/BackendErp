# v380a Supabase Migration Cleanup QA

Generated: 2026-05-06T13:13:51.129Z

Critical: 1
Warnings: 0
Migration files scanned: 41
CREATE POLICY statements detected: 115
DROP POLICY IF EXISTS statements detected: 20

| Severity | Area | Finding | Action |
|---|---|---|---|
| critical | PostgreSQL policy syntax | 1 migration(s) still contain unsupported CREATE POLICY IF NOT EXISTS syntax: supabase/migrations/20260502130100_v130_rls_and_permissions.sql | Run npm run repair:migrations:policy-syntax, then rerun qa:v380a. |

