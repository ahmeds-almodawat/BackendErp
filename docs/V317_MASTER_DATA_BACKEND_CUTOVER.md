# v317 Real Master Data Backend Cutover

v317 starts the first real backend cutover area: setup/master data.

## Scope

- branches
- stores
- suppliers
- item categories
- items
- chart of accounts

## Rule

The UI is still allowed to keep local-demo state. v317 does not rewrite AppShell.

This version adds:

- typed master data records
- validation rules
- Supabase repository factory
- backend service foundation
- cutover checklist
- optional panel
- SQL migration
- import templates

## Production warning

Do not migrate official data until:

- Supabase migrations are tested on staging
- RLS is reviewed
- backup/restore is tested
- master data imports are validated
- duplicate codes are resolved
