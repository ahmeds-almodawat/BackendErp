# v367 Mega Upgrade Patch

## What Changed

- Added a live Enterprise Upgrade command center at the existing Enterprise route.
- Added `buildV367MegaUpgradeSnapshot()` to score gate readiness, module permission coverage, backend posture, AppShell refactor pressure, upgrade waves, and QA evidence.
- Added exportable gates, module coverage, upgrade waves, QA, and full JSON snapshot evidence packs.
- Added `npm run qa:v367`, which verifies the v367 file inventory, route wiring, package metadata, documentation, runtime version, CSS variables, and evaluator contract.
- Updated package metadata to `restaurant-erp-v367-mega-upgrade-patch` version `1.0.67`.
- Fixed undefined theme variables used by the existing v240/v77 enterprise pages.

## Why This Patch Matters

v366 made loose ends visible and blocked dangerous production fallback. v367 turns that repair into a repeatable upgrade cockpit: the app now tells the team which business-data, permission, backend, and release gates are ready, warning, or critical before the next live pilot.

## Recommended Local Gate

```bash
npm run qa:v367
npm run qa:v366
npm run typecheck
npm run build
```

## Remaining Production Work

- Continue reducing `src/app/AppShell.tsx` by moving route business logic into module-owned packages.
- Replace remaining Edge Function skeletons with audited posting/import/close implementations.
- Run Supabase migrations and RLS tests against a clean staging project.
- Complete backup/restore, UAT seed, rollback, and monthly close rehearsal evidence before live finance data.
