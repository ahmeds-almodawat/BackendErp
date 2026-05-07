# Apply v451

Run after extracting this patch into the repo root:

```powershell
node scripts/apply-v451-wiring.mjs
npm run qa:v451
npm run qa:all
supabase db reset
npm run build
npm run dev
```

Then open:

Command → Pilot Scenario

Commit:

```powershell
git status
git add .
git commit -m "Add v451 real pilot scenario pack"
git push
```
