# v302 Users + Employee Link

This patch adds the missing user creation flow.

## Rule
Creating a user automatically creates or updates the linked employee record.

## Why
Permissions, HR, attendance, cashier shifts, branch/store scope, and audit identity all need a single linked person record.

## Added
- New **Users & Employees** sidebar page.
- User email/status/password-reset placeholder.
- Employee code/name/branch/department/job title/salary.
- Role + location scope assignment during user creation.
- Disable user also deactivates linked employee.
- Export users/employees CSV.
- Setup payload now includes employees and user accounts for Supabase cutover.
- Supabase migration for `employees`, `user_accounts`, and `user_access_scopes`.

## Production note
The current page creates local trial users. Real production invitation should later use Supabase Auth invite/admin flow, then connect `auth.users.id` to `public.user_accounts.auth_user_id`.
