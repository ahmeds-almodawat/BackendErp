# v19 — Professional Control Layer

This release adds the control layer that should sit above finance, inventory, purchasing, and imports before moving to new modules.

## Added

### Permission enforcement foundation
- Active trial user selector in the top bar.
- Permission catalogue expanded for purchasing, finance, inventory approvals, period locking, opening balances, and payment runs.
- `canPerform`, `requirePermission`, and scoped access checking utilities.
- Manual GL posting and journal reversal now respect permission checks and locked periods.

### Fiscal period locking
- Finance now includes a fiscal-period control page.
- Periods can be open, locked, or closed.
- Locked/closed periods block new manual posted journals and opening balance posting in local mode.

### Opening balances wizard
- Finance now includes an Opening Balances tab.
- Opening balances are posted as controlled journal entries.
- The wizard respects permissions and period locks.

### Bank reconciliation workbench
- Finance now includes a bank reconciliation tab.
- Add local bank statement lines.
- Match statement lines to cash/bank ledger journals.
- Keeps matched/unmatched registers for local trials.

### Available stock engine
Inventory now includes a tab for operationally available stock:

Available = On hand - Reserved - Quarantine - Expired - In-transit out + In-transit in

This is more professional than using on-hand quantity only.

### Import control design
- Default import profile added to master data for POS sales mapping.
- Design now supports CSV/XLSX profiles, duplicate keys, approval requirement, and saved mappings.

## Still local-first
This is still a local trial app. The same rules must later move into Supabase functions/RLS so users cannot bypass them from the browser.
