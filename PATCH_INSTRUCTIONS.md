# v385 Purchasing Workflow Gate Patch

Extract this ZIP into the root of your `Erp-Backend` repository and allow files to be replaced.

Then run:

```powershell
npm run qa:v385
npm run qa:all
supabase db reset
npm run build
npm run dev
```

If all checks pass:

```powershell
git status
git add .
git commit -m "Add v385 purchasing workflow gate"
git push
```

Check the app page:

- Operations -> Purchasing Gate

The sidebar should show `v385 Purchasing Gate`.
