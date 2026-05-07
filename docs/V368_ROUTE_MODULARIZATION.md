# v368 Route Modularization Patch

Date: 2026-05-06

## Scope

v368 reduces `src/app/AppShell.tsx` from the v367 pressure point into a smaller protected shell by moving heavy route implementations into module-owned pages.

## Delivered

- Smart Analysis now lazy-loads from `src/modules/analytics/SmartAnalysisPage.tsx`.
- Reports now lazy-loads from `src/modules/reports/ReportsPage.tsx`.
- Import / Export now lazy-loads from `src/modules/imports/ImportExportPage.tsx`.
- Inventory CSV helpers moved into `src/modules/imports/importCsvUtils.ts` so inventory uploads keep working without re-growing AppShell.
- AppShell line budget is now enforced by `npm run qa:v368` at 2400 lines.
- Package/runtime metadata advanced to `restaurant-erp-v368-route-modularization-patch` / `1.0.68`.

## Route Contracts

| Route | Module | Contract |
|---|---|---|
| Smart Analysis | `src/modules/analytics/SmartAnalysisPage.tsx` | Period-aware KPIs, sales, inventory, finance, quality gates, and CSV exports. |
| Import / Export | `src/modules/imports/ImportExportPage.tsx` | Route-owned backup/templates/history shell plus staging controls. |
| Reports | `src/modules/reports/ReportsPage.tsx` | Route-owned report workspace plus reporting truth panel. |
| Enterprise | `src/modules/EnterpriseV367UpgradePage.tsx` | v367 command center retained as the enterprise upgrade evaluator. |

## QA

Run:

```bash
npm run qa:v368
npm run qa:v367
npm run typecheck
npm run build
```

`qa:all` now includes the v368 modularization scan before the final TypeScript and production build gates.
