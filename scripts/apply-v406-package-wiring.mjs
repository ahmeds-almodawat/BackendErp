import fs from 'node:fs';

const packagePath = 'package.json';
const pkg = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
pkg.scripts ||= {};
pkg.scripts['qa:v406'] = 'node scripts/qa-v406-vat-settlement-finance-close.mjs';

const qaAll = pkg.scripts['qa:all'] || '';
if (!qaAll.includes('npm run qa:v406')) {
  if (qaAll.includes('npm run qa:v405')) {
    pkg.scripts['qa:all'] = qaAll.replace('npm run qa:v405', 'npm run qa:v405 && npm run qa:v406');
  } else if (qaAll.includes('npm run qa:v404')) {
    pkg.scripts['qa:all'] = qaAll.replace('npm run qa:v404', 'npm run qa:v404 && npm run qa:v406');
  } else if (qaAll.trim()) {
    pkg.scripts['qa:all'] = `npm run qa:v406 && ${qaAll}`;
  } else {
    pkg.scripts['qa:all'] = 'npm run qa:v406 && npm run typecheck && npm run build';
  }
}

fs.writeFileSync(packagePath, `${JSON.stringify(pkg, null, 2)}\n`);
console.log('v406 package wiring applied: qa:v406 added and included in qa:all.');
