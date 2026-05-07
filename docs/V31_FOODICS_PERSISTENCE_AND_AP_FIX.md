# v31 — Foodics Persistence + Finance AP Fix

## Purpose
v31 stabilizes the Foodics workflow and corrects a Finance workspace issue before backend migration.

## Changes

### Finance
- Fixed missing Accounts Payable tab rendering.
- Removed stray Finance workspace character.

### Foodics
- Added local persistence for Foodics upload session.
- Persisted branch, item, and payment mappings.
- Persisted posting mode and batch name.
- Added batch register.
- Added duplicate batch reference guard.
- Added report-only batch registration.
- Added controlled reversal foundation for posted Foodics batches.

## Local-storage behavior
The app first tries to save the full Foodics session including rows. If the monthly Foodics files exceed browser local-storage quota, it automatically stores mappings and file metadata only. This protects the app from crashing, but users must re-upload rows before posting.

## Still missing
- Supabase import staging tables.
- Batch status stored in database.
- Approval workflow before posting.
- Server-side reversal function.
- Delivery app settlement reconciliation.
- Full void/refund/original-order matching.
