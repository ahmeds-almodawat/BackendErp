# Import validation, approval, and rollback

## Validation

- Row-level issues belong in `import_validation_errors` (from v310) with `severity` in `warning`, `error`, `critical`.
- TypeScript helpers in `importValidation.ts` remain available for client-side column checks; server RPC `import_validate_staging_file` aggregates critical vs warning counts.

## Approval rules (`importApproval.ts`)

- Only **`validated`** staging files can be **approved**.
- Files with **critical** validation rows or **`error_rows > 0`** cannot be approved.
- **`approved`** and **`posted`** files are immutable for editing workflows—use rollback/correction paths instead.
- Approval requires **`approvedBy`** and **`approvedAt`** timestamps on the persisted record.

SQL RPC `import_approve_staging_file` enforces `imports.approve` permission and the same structural rules.

## Cutover readiness (`importCutoverEngine.ts`)

- An active **mapping profile** must be resolved before cutover.
- **Critical** row errors block cutover.
- **Approved** imports can move to cutover/posting; **posted** imports cannot be edited.
- **Duplicate detection** should key off **file hash**, **source type**, **branch**, and **business date** (`buildImportDuplicateKey` / `import_file_hash_locks`).

## Rollback (`importRollback.ts` + RPC)

- Only **posted** cutover batches should initiate rollback requests.
- Rollback must include a **reason**.
- Implementation policy: create **correction or reversal postings** (v311 posting engine), not silent deletes.
- Staging files in **`rolled_back`** or **`cancelled`** state cannot be rolled back again.
- RPC `import_request_rollback` records the request and sets `import_cutover_batches.rollback_status` to `requested`.

## Error export (`importErrorExport.ts`)

- `exportImportErrorsToCsv` outputs: `file_id`, `row_number`, `field_name`, `error_code`, `error_message`, `severity`.
- Template: `templates/v312/import_error_export_template.csv`.
