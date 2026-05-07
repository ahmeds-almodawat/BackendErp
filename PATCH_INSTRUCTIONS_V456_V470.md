# Apply v456-v470 Restaurant Operations Workflow Mega Patch

1. Extract this ZIP into your repo root.
2. Run:

```powershell
node scripts/apply-v456-v470-wiring.mjs
npm run qa:v456-v470
npm run qa:all
supabase db reset
npm run build
npm run dev
```

3. Open:

```text
Operations → Restaurant Flow
```

4. Commit:

```powershell
git status
git add .
git commit -m "Add v456-v470 restaurant operations workflow"
git push
```
