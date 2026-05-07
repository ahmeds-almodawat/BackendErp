# v372 Production Edge Function Audit

Generated: 2026-05-06T13:13:48.174Z

## Summary

- Total Edge Functions scanned: 24
- Production-ready: 0
- Dev-only: 18
- Skeleton: 0
- Unsafe: 6
- Deprecated: 0
- Misleading ok:true skeletons: 0

Next action: Close skeleton/unsafe functions before enabling production backend mode.

## Function Inventory

| Function | Status | Production allowed | Skeleton marker | Misleading ok | Required permissions | Required secrets | Next step |
|---|---|---:|---:|---:|---|---|---|
| approval-workflow | dev-only | no | yes | no | approval.manage | SUPABASE_URL,SUPABASE_SERVICE_ROLE_KEY | Safe as non-production stub. Replace with transaction logic before production enablement. |
| attachment-signer | dev-only | no | yes | no | documents.manage with module scope | SUPABASE_URL,SUPABASE_SERVICE_ROLE_KEY,ATTACHMENT_SIGNING_KEY | Safe as non-production stub. Replace with transaction logic before production enablement. |
| attachment-vault | dev-only | no | yes | no | documents.manage with module scope | SUPABASE_URL,SUPABASE_SERVICE_ROLE_KEY,ATTACHMENT_SIGNING_KEY | Safe as non-production stub. Replace with transaction logic before production enablement. |
| attachment-vault-v200 | dev-only | no | yes | no | documents.manage with module scope | SUPABASE_URL,SUPABASE_SERVICE_ROLE_KEY,ATTACHMENT_SIGNING_KEY | Safe as non-production stub. Replace with transaction logic before production enablement. |
| auth-bootstrap | dev-only | no | yes | no | settings.users.manage / system.owner | SUPABASE_URL,SUPABASE_SERVICE_ROLE_KEY | Safe as non-production stub. Replace with transaction logic before production enablement. |
| backend-health | unsafe | no | no | no | module-specific permission required before production enablement | SUPABASE_URL,SUPABASE_SERVICE_ROLE_KEY | Add explicit JWT, permission, scope, service-role, and audit handling before production use. |
| backend-health-v280 | unsafe | no | no | no | module-specific permission required before production enablement | SUPABASE_URL,SUPABASE_SERVICE_ROLE_KEY | Add explicit JWT, permission, scope, service-role, and audit handling before production use. |
| backend-health-v301 | unsafe | no | no | no | module-specific permission required before production enablement | SUPABASE_URL,SUPABASE_SERVICE_ROLE_KEY | Add explicit JWT, permission, scope, service-role, and audit handling before production use. |
| backup-export | dev-only | no | yes | no | finance.post / finance.admin depending on action | SUPABASE_URL,SUPABASE_SERVICE_ROLE_KEY,BACKUP_SIGNING_KEY | Safe as non-production stub. Replace with transaction logic before production enablement. |
| finance-posting | dev-only | no | yes | no | finance.post / finance.admin depending on action | SUPABASE_URL,SUPABASE_SERVICE_ROLE_KEY,FOODICS_API_KEY if API pull is enabled | Safe as non-production stub. Replace with transaction logic before production enablement. |
| foodics-post | dev-only | no | yes | no | sales.import / sales.post depending on action | SUPABASE_URL,SUPABASE_SERVICE_ROLE_KEY,FOODICS_API_KEY if API pull is enabled | Safe as non-production stub. Replace with transaction logic before production enablement. |
| foodics-staging | dev-only | no | yes | no | sales.import / sales.post depending on action | SUPABASE_URL,SUPABASE_SERVICE_ROLE_KEY,FOODICS_API_KEY if API pull is enabled | Safe as non-production stub. Replace with transaction logic before production enablement. |
| inventory-posting | dev-only | no | yes | no | inventory.post / inventory.admin depending on action | SUPABASE_URL,SUPABASE_SERVICE_ROLE_KEY,FOODICS_API_KEY if API pull is enabled | Safe as non-production stub. Replace with transaction logic before production enablement. |
| master-data-sync | dev-only | no | yes | no | module-specific permission required before production enablement | SUPABASE_URL,SUPABASE_SERVICE_ROLE_KEY | Safe as non-production stub. Replace with transaction logic before production enablement. |
| master-data-validate | unsafe | no | no | no | module-specific permission required before production enablement | SUPABASE_URL,SUPABASE_SERVICE_ROLE_KEY | Add explicit JWT, permission, scope, service-role, and audit handling before production use. |
| period-close | unsafe | no | no | no | finance.post / finance.admin depending on action | SUPABASE_URL,SUPABASE_SERVICE_ROLE_KEY | Add explicit JWT, permission, scope, service-role, and audit handling before production use. |
| posting-orchestrator | dev-only | no | yes | no | sales.import / sales.post depending on action | SUPABASE_URL,SUPABASE_SERVICE_ROLE_KEY,FOODICS_API_KEY if API pull is enabled | Safe as non-production stub. Replace with transaction logic before production enablement. |
| posting-orchestrator-v200 | dev-only | no | yes | no | sales.import / sales.post depending on action | SUPABASE_URL,SUPABASE_SERVICE_ROLE_KEY,FOODICS_API_KEY if API pull is enabled | Safe as non-production stub. Replace with transaction logic before production enablement. |
| posting-orchestrator-v280 | unsafe | no | no | no | sales.import / sales.post depending on action | SUPABASE_URL,SUPABASE_SERVICE_ROLE_KEY,FOODICS_API_KEY if API pull is enabled | Add explicit JWT, permission, scope, service-role, and audit handling before production use. |
| production-bridge | dev-only | no | yes | no | module-specific permission required before production enablement | SUPABASE_URL,SUPABASE_SERVICE_ROLE_KEY | Safe as non-production stub. Replace with transaction logic before production enablement. |
| report-pack-builder | dev-only | no | yes | no | reports.generate | SUPABASE_URL,SUPABASE_SERVICE_ROLE_KEY | Safe as non-production stub. Replace with transaction logic before production enablement. |
| setup-sync | dev-only | no | yes | no | module-specific permission required before production enablement | SUPABASE_URL,SUPABASE_SERVICE_ROLE_KEY | Safe as non-production stub. Replace with transaction logic before production enablement. |
| setup-sync-v280 | dev-only | no | yes | no | module-specific permission required before production enablement | SUPABASE_URL,SUPABASE_SERVICE_ROLE_KEY | Safe as non-production stub. Replace with transaction logic before production enablement. |
| setup-sync-v301 | dev-only | no | yes | no | module-specific permission required before production enablement | SUPABASE_URL,SUPABASE_SERVICE_ROLE_KEY | Safe as non-production stub. Replace with transaction logic before production enablement. |

## QA Findings

Critical: 0
Warnings: 1

| Severity | Area | Finding | Action |
|---|---|---|---|
| warning | Edge Functions | 6 functions are unsafe for production. | Add explicit JWT, permission, scope, service-role, transaction, and audit handling. |
