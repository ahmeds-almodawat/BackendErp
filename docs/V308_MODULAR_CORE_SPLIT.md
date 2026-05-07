# v308 Modular Core Split

v308 starts the modular extraction from the previous single-shell structure.

## Frontend boundary

- `src/App.tsx` is now a tiny entry point.
- Main shell moved to `src/app/AppShell.tsx`.
- Module folders added:
  - `analytics`
  - `finance`
  - `inventory`
  - `purchasing`
  - `production`
  - `sales`
  - `hr`
  - `setup`
  - `access`

## Registry

`src/modules/moduleRegistry.ts` defines each module’s:

- route ownership
- backend tables
- permission keys
- engine dependencies
- import/export responsibilities
- risk level
- backend-cutover tasks

## Analytics engine boundary

Added:

- `src/modules/analytics/engines/comparisonEngine.ts`
- `src/modules/analytics/engines/reportStudioEngine.ts`
- `src/modules/analytics/engines/dataQualityEngine.ts`
- `src/modules/analytics/services/reportImportCenterService.ts`

## Backend contract

Migration `20260505030800_v308_modular_backend_contract.sql` adds `module_registry_contracts`.
