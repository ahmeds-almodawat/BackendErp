# v181 — Auth + Setup Persistence Wiring

v181 is the first practical bridge from Local Trial Mode to Supabase-backed setup persistence.

## Added

- Backend Sync v181 module in the sidebar.
- Local/Supabase health indicator.
- Setup sync JSON export.
- Setup validation before backend migration.
- Dry-run setup sync service.
- Supabase migration for setup sync staging tables.
- Edge Function skeleton for `setup-sync`.

## Why this matters

Before Foodics, inventory and finance postings move to the backend, setup master data must be clean and persistent:

- branches
- stores
- suppliers
- items/SKUs
- cost centers
- chart of accounts
- roles/permissions

## Current limits

This patch does not yet replace all frontend localStorage reads/writes. It prepares and validates the first backend setup sync path.

## Next milestone

v182 should connect Setup pages to the backend bridge with read/write fallback.
