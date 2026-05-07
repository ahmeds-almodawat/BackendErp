# V26 Reports Hard Fix

## Problem
Reports could still open to a blank/white page when the browser had older local trial data saved from earlier builds, or when some reporting arrays were missing from the local state.

## Fixes
- Changed local storage key to `restaurant-erp-v26-reports-hard-fix` to avoid loading corrupted/stale v24/v25 data.
- Added guarded local-state merging so missing arrays fall back to the current empty state structure.
- Rebuilt the Reports page with defensive local array guards.
- Removed the riskiest nested report calculations from the default Reports path.
- Added a stable report workspace with Executive, Finance Pack, Inventory, Suppliers, Menu Engineering, and Exceptions tabs.
- Added CSV export for every report tab.

## Test
1. Run the app.
2. Open Reports before loading any trial data.
3. Load fast trial scenario.
4. Open Reports again.
5. Switch all report tabs.
6. Toggle Arabic/English.

If the user previously had blank pages from old local data, this version should start fresh because of the new storage key.
