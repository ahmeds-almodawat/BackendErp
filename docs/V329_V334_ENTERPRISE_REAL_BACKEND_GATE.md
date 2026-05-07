# v329-v334 Enterprise Real Backend Gate

This mega patch moves the platform from backend foundation toward real backend readiness.

## Included versions

- v329 QA lock
- v330 real Supabase client integration
- v331 migration verification
- v332 auth shell foundation
- v333 RBAC enforcement foundation
- v334 RLS test matrix

## Enterprise rule

Do not continue deep module cutover until this gate passes:

- `npm run qa:all`
- real Supabase env configured
- service role key not exposed
- migrations verified on staging
- auth shell ready
- RBAC rules defined
- RLS test matrix executed
- backup/restore tested

## Safe behavior

Local-demo mode remains safe when Supabase env variables are missing.
