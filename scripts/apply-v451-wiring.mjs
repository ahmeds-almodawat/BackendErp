import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const appPath = path.join(root, 'src/app/AppShell.tsx');
const pkgPath = path.join(root, 'package.json');

function write(file, content) {
  fs.writeFileSync(file, content, 'utf8');
}

function updatePackage() {
  const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
  pkg.scripts = pkg.scripts || {};
  pkg.scripts['qa:v451'] = 'node scripts/qa-v451-real-pilot-scenario-pack.mjs';

  const qaAll = String(pkg.scripts['qa:all'] || '');
  if (qaAll && !qaAll.includes('qa:v451')) {
    const anchor = 'npm run typecheck';
    pkg.scripts['qa:all'] = qaAll.includes(anchor)
      ? qaAll.replace(anchor, 'npm run qa:v451 && npm run typecheck')
      : `${qaAll} && npm run qa:v451`;
  }

  write(pkgPath, `${JSON.stringify(pkg, null, 2)}\n`);
  console.log('Updated package.json with qa:v451');
}

function insertAfterLastImport(text, importLine) {
  if (text.includes(importLine)) return text;
  const matches = [...text.matchAll(/^import .*?;\s*$/gm)];
  if (!matches.length) return `${importLine}\n${text}`;
  const last = matches[matches.length - 1];
  const index = (last.index ?? 0) + last[0].length;
  return `${text.slice(0, index)}\n${importLine}${text.slice(index)}`;
}

function insertRouteMeta(text) {
  if (text.includes('pilotScenario:')) return text;

  const entry = "  pilotScenario: { en: 'Pilot Scenario', ar: 'سيناريو التشغيل التجريبي', icon: Database },";
  const anchors = [
    /(\s+pilotCenter:\s*\{[^\n]+,\n)/,
    /(\s+commandSuite:\s*\{[^\n]+,\n)/,
    /(\s+smart:\s*\{[^\n]+,\n)/,
    /(\s+dashboard:\s*\{[^\n]+,\n)/,
  ];

  for (const anchor of anchors) {
    if (anchor.test(text)) {
      return text.replace(anchor, `$1${entry}\n`);
    }
  }

  return text;
}

function insertPageMap(text) {
  if (text.includes('pilotScenario: <ModuleSuspense')) return text;

  const entry = "    pilotScenario: <ModuleSuspense label={L(locale, 'Loading pilot scenario', 'تحميل سيناريو التشغيل التجريبي')}><EnterpriseV451PilotScenarioPage locale={locale} notify={notify} /></ModuleSuspense>,";
  const anchors = [
    /(\s+pilotCenter:\s*<ModuleSuspense[\s\S]*?<\/ModuleSuspense>,\n)/,
    /(\s+commandSuite:\s*<ModuleSuspense[\s\S]*?<\/ModuleSuspense>,\n)/,
    /(\s+smart:\s*<ModuleSuspense[\s\S]*?<\/ModuleSuspense>,\n)/,
    /(\s+dashboard:\s*<ModuleSuspense[\s\S]*?<\/ModuleSuspense>,\n)/,
  ];

  for (const anchor of anchors) {
    if (anchor.test(text)) {
      return text.replace(anchor, `$1${entry}\n`);
    }
  }

  return text;
}

function insertNavigation(text) {
  if (text.includes("'pilotScenario'") || text.includes('"pilotScenario"')) return text;

  const listPatterns = [
    /(\[\s*'dashboard'[\s\S]*?'pilotCenter'[\s\S]*?\])/,
    /(\[\s*'dashboard'[\s\S]*?'commandSuite'[\s\S]*?\])/,
    /(\[\s*'dashboard'[\s\S]*?'reports'[\s\S]*?\])/,
  ];

  for (const pattern of listPatterns) {
    const match = text.match(pattern);
    if (match) {
      const replacement = match[1].replace(/(\])/, ", 'pilotScenario'$1");
      return text.replace(match[1], replacement);
    }
  }

  // Fallback: add near any Command group routes declaration.
  return text.replace(/(command:\s*\[[^\]]*)\]/, "$1, 'pilotScenario']");
}

function updateBrand(text) {
  return text
    .replace(/v\d+(?:-v\d+)?\s+[A-Za-z ]+/g, (value) => (value.includes('v451') ? value : value))
    .replace(/v421-v450 Command Suite/g, 'v451 Pilot Scenario')
    .replace(/v407-v420 Pilot Completion/g, 'v451 Pilot Scenario')
    .replace(/Enterprise operations suite/g, 'Pilot validation suite');
}

function updateAppShell() {
  if (!fs.existsSync(appPath)) {
    console.warn('AppShell not found; skipping routing wiring.');
    return;
  }

  let text = fs.readFileSync(appPath, 'utf8');

  text = insertAfterLastImport(
    text,
    "import EnterpriseV451PilotScenarioPage from '../modules/EnterpriseV451PilotScenarioPage';"
  );
  text = insertRouteMeta(text);
  text = insertPageMap(text);
  text = insertNavigation(text);
  text = updateBrand(text);

  fs.writeFileSync(appPath, text, 'utf8');
  console.log('Updated AppShell.tsx with pilotScenario route.');
}

updatePackage();
updateAppShell();
