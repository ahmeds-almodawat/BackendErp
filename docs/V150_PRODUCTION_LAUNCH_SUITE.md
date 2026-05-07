# v150 Production Launch Suite

This version combines v131-v150 into one production-launch package. It does not replace the local prototype. It adds a stronger transition layer toward Supabase-backed production use.

## Major additions

1. Enterprise v150 cockpit inside the app.
2. v131-v150 backend and launch program.
3. Production API contracts.
4. Central posting guard requirements.
5. Approval/maker-checker and attachment-vault policy.
6. Pilot-to-go-live cutover plan.
7. QA regression suite.
8. Deeper backend migrations for approvals, imports, posting, audit and close snapshots.
9. Edge Function skeletons for setup sync, Foodics staging, posting orchestration, attachments, approvals, reports and backups.
10. Current scoring and professional notes directly inside the app.

## Current score

| View | Score |
|---|---:|
| Local MVP / prototype | 9.3 / 10 |
| Serious ERP foundation | 8.6 / 10 |
| Enterprise design direction | 9.0 / 10 |
| Production readiness | 6.1 / 10 |
| Backend/security readiness | 6.7 / 10 |

## Honest status

v150 is still not fully production-ready. It is a strong launch foundation. The next real value is connecting the frontend to Supabase for Auth, setup persistence, Foodics staging and server-side posting.

## Recommended next step

v151 should wire the first real backend flow:

- Supabase Auth
- company profile
- branches
- stores
- suppliers
- items
- chart of accounts
- cost centers

Keep local mode as fallback during the transition.
