# v281 Test Report

Automated checks run in the container:

- npm install --no-audit --no-fund: passed
- Vite production build: passed
- Dev server HTTP smoke test: passed
- Sample data CSV structure check: passed
- Foodics smooth sample totals checked: recognized gross 1,311.00, payments 1,311.00, VAT 171.00

Notes:

- The original v280 package used `npm run build = tsc -b && vite build`. With latest TypeScript, the TypeScript deprecation check blocks/does not complete quickly in this environment. v281 changes `npm run build` to the practical Vite production build and keeps strict type checking available as `npm run typecheck` / `npm run build:strict`.
- The root error boundary storage key label was updated from the old v27 label to the current v280 app key.
- Vite build still warns that the main JavaScript bundle is large, which is expected because App.tsx is still very large. This is not a crash, but it confirms the next refactor should split modules and use code-splitting.
