# v312 Import Staging and Production Cutover Foundation

## Purpose

v312 layers **mapping profiles**, **cutover batches**, **hash-based duplicate detection**, **rollback requests**, and **RPC helpers** on top of v310 `import_staging_*` tables and v311 posting batches (for optional correction links). It is additive and does not remove or rename existing v310 import tables.

## Deliverables

### TypeScript (`src/modules/imports/`)

| File | Role |
| --- | --- |
| `importMappingProfiles.ts` | Field types, profile shape, seven default profiles |
| `importApproval.ts` | Approve/reject rules (validated, no critical errors, immutability) |
| `importRollback.ts` | Rollback request validation (posted cutover, reason, no double rollback) |
| `importErrorExport.ts` | CSV rows + export helper for `import_validation_errors` shape |
| `importCutoverEngine.ts` | Cutover readiness, duplicate key, preview shell |
| `ImportStagingPanel.tsx` | Optional standalone summary (not mounted in AppShell) |
| `index.ts` | Barrel exports |

### Database

- `supabase/migrations/20260505231200_v312_import_staging_cutover.sql`

Apply **after** v310 and v311 so `posting_batches` exists for the optional FK on `import_rollback_requests.applied_correction_batch_id`.

### Templates

- `templates/v312/import_mapping_profile_template.csv`
- `templates/v312/import_cutover_batch_template.csv`
- `templates/v312/import_error_export_template.csv`
- `templates/v312/import_rollback_request_template.csv`

### RPCs (return JSONB: `ok`, `critical_count`, `warning_count`, `message`, `findings`)

- `public.import_validate_staging_file(file_id uuid)`
- `public.import_approve_staging_file(file_id uuid)`
- `public.import_create_cutover_batch(file_id uuid)` — requires `metadata.mapping_profile_id`, `metadata.branch_id`, `metadata.business_date`, `metadata.file_sha256` (or `file_hash`)
- `public.import_request_rollback(cutover_batch_id uuid, reason text)`

## Next steps

1. Run the migration when the database is ready (not auto-applied in this repo workflow).
2. On upload, compute SHA-256 and store in `import_staging_files.metadata` with branch and business date; register `import_file_hash_locks` to enforce duplicate file detection.
3. Wire Edge Functions or service layer to call RPCs in order: validate → approve → create cutover → post → (if needed) rollback request + v311 reversal postings.
