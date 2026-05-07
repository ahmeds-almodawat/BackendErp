# v301 — Supabase Cutover Foundation

This release starts the real move from local-browser ERP data to Supabase-backed persistence.

## What v301 adds

- Backend Cutover module in the sidebar.
- Supabase environment detection.
- Setup/master-data validation before backend sync.
- Backend-ready setup JSON payload export.
- SQL seed review export for local testing.
- Local dry-run setup sync when Supabase is not configured.
- Edge Function dry-run target when Supabase is configured.
- Supabase migration for setup persistence and sync staging.

## Current mode

The app remains safe in local mode. No backend write happens unless Supabase environment variables are configured and the sync function is called.

## Required next step

After testing v301 locally, configure `.env.local`:

```env
VITE_SUPABASE_URL=https://your-project-ref.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
VITE_BACKEND_MODE=supabase-pilot
```

Then apply migrations and serve functions.

## Honest status

v301 does not yet make every operational page read/write Supabase. It creates the first practical cutover bridge for setup/master data, which is the safest place to begin production persistence.
