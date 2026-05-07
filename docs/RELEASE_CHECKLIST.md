# Release Checklist

Run this before every release.

## Local checks

- npm install
- npm run build
- Open app locally
- Test English layout
- Test Arabic layout
- Test sidebar navigation
- Test Smart Analysis
- Test finance pages
- Test imports page if changed
- Confirm no white screen
- Confirm browser console has no fatal errors

## Git checks

- git status is clean before starting
- changes committed to feature branch
- branch pushed to GitHub
- main is not changed directly for major upgrades

## Production checks

- Database backup exists
- Migration reviewed
- Migration tested on staging
- Environment variables confirmed
- Service role key is not in frontend
- Rollback plan exists
