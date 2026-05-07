# v381 Backup / Archive Worker + Platform Backup Page

Date: 2026-05-06

## Goal

v381 closes the first worker-foundation wave with backup/archive evidence and adds an operator-facing Backup / Restore page for the local ERP platform.

The patch has two layers:

1. **Frontend local platform backup**: export the current ERP state into one portable ZIP and restore it after preview/confirmation.
2. **Supabase worker foundation**: record backup/archive jobs, artifacts, restore drills, integrity hashes, and events through service-role worker RPCs.

## Added frontend files

| File | Purpose |
|---|---|
| `src/engines/enterpriseV381PlatformBackupEngine.ts` | Creates/parses a dependency-free stored ZIP backup package with manifest, state, summary, audit extract, and restore instructions. |
| `src/modules/EnterpriseV381BackupPage.tsx` | Backup / Restore page with export, restore preview, confirmation, and local state replacement. |

## Added route

`backup` is added to the Administration navigation group as **Backup / Restore**.

## Added Supabase tables

| Table | Purpose |
|---|---|
| `backup_archive_runs` | Backup/archive run header, source counts, manifest, warning count, integrity hash. |
| `backup_archive_artifacts` | Backup artifact evidence such as manifest, ZIP, database dump, or storage archive references. |
| `backup_restore_runs` | Restore drill evidence and verification summary. |
| `backup_archive_events` | Backup/restore lifecycle events. |

## Added Supabase RPCs

| RPC | Purpose |
|---|---|
| `worker_backup_archive_source_counts` | Counts important source tables for backup evidence. |
| `worker_enqueue_backup_archive` | Enqueues an idempotent `backup.archive` worker job. |
| `worker_acquire_backup_archive_job` | Acquires only backup/archive jobs. |
| `worker_run_backup_archive_batch` | Records backup evidence, manifest hash, artifact, checkpoint, and completes/fails through v375 runtime. |
| `worker_record_restore_evidence` | Records restore drill evidence for staging/production readiness. |
| `worker_backup_archive_event` | Appends backup/archive event evidence. |

## Security posture

- Worker RPCs are revoked from `public` and `authenticated`.
- Worker RPCs are granted to `service_role` only.
- Authenticated users receive read-only visibility through RLS for backup evidence review.
- Browser backup page only handles local app state; it does not call service-role backup RPCs.

## Important limitation

The page gives you a very useful **testing-phase backup/restore** for the browser/local ERP state. For real production Supabase later, full backup must also include:

- Postgres database dump or managed backup,
- storage bucket contents,
- Edge Function source/config,
- secrets inventory outside Git,
- restore drill on staging,
- signed backup retention SOP.

## QA

Run:

```bash
npm run qa:v381
npm run qa:all
supabase db reset
```
