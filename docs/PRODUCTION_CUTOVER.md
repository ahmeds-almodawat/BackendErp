# Production Cutover Notes

## Do not go live with every module at once

Recommended go-live order:

1. Foundation and setup
2. Finance basics
3. Purchasing and suppliers
4. Inventory
5. POS/Foodics imports
6. Recipes and production
7. Advanced analytics

## Minimum production controls

- Real authentication
- Basic role permissions
- Branch access
- Fiscal periods
- No deletion of posted records
- Posting validation
- Import staging
- Backups
- Error logging
- Activity logging

## Go-live rule

A module is not production-ready until:

- It has real database tables
- It has RLS or backend access control
- It has audit/activity logging
- It has validation
- It has export/reconciliation
- It has a rollback or reversal path
