# V27 — Stability + Refactor Foundation

## Purpose
This release focuses on preventing module crashes from turning into a full white page and starts the platform's transition from fast MVP to maintainable ERP foundation.

## Implemented

### 1. Global Error Boundary
- Added `src/components/ErrorBoundary.tsx`.
- Root app is wrapped in `main.tsx`.
- Any root crash displays a safe recovery screen instead of a white page.

### 2. Module-Level Error Boundary
- Active ERP module is wrapped in an error boundary inside `App.tsx`.
- If Reports, Finance, Inventory, Purchasing, or any module crashes, the user sees a recovery card instead of a blank screen.

### 3. Diagnostic Export
The recovery screen can export a JSON diagnostic file with:
- module name
- error message
- stack trace
- component stack
- local storage snapshot
- user agent

### 4. Local Data Reset
The recovery screen can clear the local trial storage key and reload the platform.

### 5. Safe Local Storage Utility
Added `src/utils/safeStorage.ts` with:
- `safeLoad`
- `safeSave`
- `safeReset`

### 6. State Normalization
The local ERP state now normalizes missing arrays back to empty arrays. This reduces crashes caused by old/corrupted prototype data.

## What this does NOT complete yet
- Full codebase refactor into independent modules.
- Supabase backend migration.
- Server-side posting engine.
- Full permission enforcement on every action.

## Recommended next phase
V27B should create a central posting engine:

validate → check permission → check period → post stock → post GL → audit log
