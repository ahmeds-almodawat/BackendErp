# v382 Backend Mode & Production Cutover Gate

Date: 2026-05-06

## Goal

v382 adds a visible backend-mode gate so operators can tell whether the ERP is running as:

- `local-demo`
- `staging`
- `production`

The gate is designed to prevent accidental production use while the app is still using local/demo behavior or unsafe frontend variables.

## Added UI

A new route is available under Administration:

- **Backend Mode**

It displays:

- runtime mode,
- backend configuration status,
- auth requirement,
- branch-scope requirement,
- demo-data posture,
- service-role exposure detection,
- redacted frontend environment,
- staging `.env.local` recipe,
- safe cutover order.

## Added Engine

`src/engines/enterpriseV382BackendModeEngine.ts`

The engine builds a snapshot with:

- `gateStatus`,
- `gateScore`,
- checklist findings,
- redacted environment,
- next action.

## Added Database Evidence Tables

`supabase/migrations/20260506238200_v382_backend_mode_gate.sql`

Adds:

- `backend_mode_gate_snapshots`,
- `backend_mode_gate_events`,
- `backend_mode_gate_event(...)`.

This is evidence-only. It does not post finance, mutate inventory, close periods, or change accounting records.

## Production Rule

Frontend must never expose service role keys. Any environment variable like the following is a critical failure:

```text
VITE_SUPABASE_SERVICE_ROLE_KEY
VITE_SUPABASE_SERVICE_KEY
VITE_SUPABASE_SECRET_KEY
```

Service role keys belong only in Supabase secrets, Edge Functions, or server-side worker runtime.

## QA

Run:

```bash
npm run qa:v382
npm run qa:all
supabase db reset
```

## Next Patch

v383 should harden RBAC and route/action permission mapping so UI visibility and server authority align.
