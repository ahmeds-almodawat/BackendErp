# v316 Supabase Backend Cutover Starter

v316 starts the safe bridge from local-demo ERP state to Supabase-backed services.

## Rules

- Local-demo remains the default safe mode.
- Supabase mode requires `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`.
- Never expose `SUPABASE_SERVICE_ROLE_KEY` in frontend code.
- Backend cutover must happen module by module.
- No official data should be posted until migrations, RLS, backup, and restore are tested.

## Added areas

- Supabase browser client factory
- Supabase health checks
- Data provider selector
- Repository foundation
- Master data service foundation
- Finance posting service foundation
- Import backend service foundation
- Backend cutover panel
- v316 migration file
