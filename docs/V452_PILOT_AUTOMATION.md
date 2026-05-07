# v452 Pilot Automation

Adds a local/demo-only pilot automation page. It fills a realistic scenario step by step using `PILOT-*` records as if the operator entered them manually. It does not call production posting services.

Run:

```powershell
node scripts/repair-v451-pilot-scenario-migration.mjs
node scripts/apply-v452-wiring.mjs
npm run qa:v452
npm run qa:all
supabase db reset
npm run build
npm run dev
```

Open: `Command → Pilot Automation`.
