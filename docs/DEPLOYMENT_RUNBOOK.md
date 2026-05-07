# Deployment Runbook

Recommended release flow:

1. Create branch
2. Run npm install
3. Run npm run build
4. Open pull request
5. Confirm GitHub Actions passes
6. Test staging
7. Backup production
8. Deploy production
9. Record deployment event
10. Monitor errors
