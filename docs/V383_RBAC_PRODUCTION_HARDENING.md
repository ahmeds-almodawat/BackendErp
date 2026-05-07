# v383 RBAC Production Hardening

Date: 2026-05-06

## Goal

v383 makes permissions, route access, backend RPC access, dangerous actions, and scope readiness visible before real Supabase production cutover.

It does **not** replace database RLS or server-side checks. It is a production-readiness gate and evidence layer.

## Added UI

Administration → **RBAC Gate**

The page shows:

- RBAC gate score and status.
- permission catalog count,
- role count,
- active users and scope count,
- route permission map,
- backend RPC permission map,
- dangerous action inventory,
- open RBAC findings,
- exportable CSV evidence.

## Added Engine

`src/engines/enterpriseV383RBACHardeningEngine.ts`

It evaluates:

- route-to-permission coverage,
- RPC-to-permission coverage,
- dangerous action permission coverage,
- role assignment coverage,
- active users without access scope,
- active employees without user accounts.

## Added Supabase Evidence Tables

- `rbac_gate_snapshots`
- `rbac_gate_events`
- `rbac_route_permission_registry`
- `rbac_rpc_permission_registry`
- `rbac_dangerous_action_registry`

These tables are for evidence and review. Production enforcement still belongs in RLS, permission-checked RPCs, and service-role-only worker boundaries.

## QA

Run:

```bash
npm run qa:v383
npm run qa:all
supabase db reset
```

## Next Patch

v384 should make backend source-of-truth mode explicit for selected modules and block local-only mutations when staging/production mode is selected.
