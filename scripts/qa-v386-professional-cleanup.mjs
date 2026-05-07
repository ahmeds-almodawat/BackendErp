import fs from 'node:fs';

const appShell = fs.readFileSync('src/app/AppShell.tsx', 'utf8');
const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
const findings = [];

function check(condition, area, finding, action) {
  if (!condition) findings.push({ area, finding, action });
}

check(!appShell.includes("v385 Purchasing Gate"), 'Branding', 'Old v385 label still appears in AppShell.', 'Replace version patch language with stable product language.');
check(appShell.includes('Enterprise operations suite'), 'Branding', 'Professional product subtitle is missing.', 'Keep stable product language in the sidebar brand.');
check(!/keys:\s*\[[^\]]*purchasingGate/.test(appShell), 'Navigation', 'Purchasing readiness gate is still visible in primary Operations navigation.', 'Keep readiness gates available in code but out of daily operator navigation.');
check(!/keys:\s*\[[^\]]*enterprise/.test(appShell), 'Navigation', 'Readiness archive is still visible in primary Command navigation.', 'Hide historical/AI-style pages from main sidebar.');
check(/keys:\s*\[[^\]]*dashboard[^\]]*smartAnalysis[^\]]*reports[^\]]*controls/.test(appShell), 'Navigation', 'Command group does not contain the expected executive pages.', 'Keep Command focused on executive dashboard, analysis, reports, and control.');
check(appShell.includes("{ en: 'System'"), 'Navigation', 'System group is missing.', 'Keep backend/readiness tools under a clear System group.');
check(pkg.name === 'restaurant-erp-enterprise-operations-suite', 'Package', 'package.json still has patch/version-oriented name.', 'Use product-oriented package metadata.');
check(Boolean(pkg.scripts?.['qa:v386-clean']), 'QA', 'qa:v386-clean script is missing.', 'Wire professional cleanup QA into package scripts.');
check(String(pkg.scripts?.['qa:all'] || '').includes('qa:v386-clean'), 'QA', 'qa:all does not run qa:v386-clean.', 'Add cleanup QA to the full quality gate.');

const report = [
  '# v386 Professional Cleanup QA',
  '',
  `Generated: ${new Date().toISOString()}`,
  '',
  `Critical: ${findings.length}`,
  'Warnings: 0',
  '',
  '| Severity | Area | Finding | Action |',
  '|---|---|---|---|',
  ...(findings.length ? findings.map((f) => `| critical | ${f.area} | ${f.finding} | ${f.action} |`) : ['', 'No v386 professional cleanup issues detected.']),
].join('\n');

fs.writeFileSync('docs/V386_PROFESSIONAL_CLEANUP_QA.md', report);

if (findings.length) {
  console.error(report);
  process.exit(1);
}

console.log(report);
