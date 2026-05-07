# Backup and Restore Policy

Backup is not trusted until restore was tested.

Minimum policy:

- daily production database backup
- backup before every migration
- weekly export of critical master data
- restore test on staging before production go-live
- documented rollback procedure
