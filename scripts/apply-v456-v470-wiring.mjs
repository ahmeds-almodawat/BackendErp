import fs from 'node:fs';

function read(path) { return fs.readFileSync(path, 'utf8'); }
function write(path, content) { fs.writeFileSync(path, content.replace(/^\uFEFF/, ''), 'utf8'); }
function ensure(condition, message) { if (!condition) throw new Error(message); }

function patchPackageJson() {
  const path = 'package.json';
  const pkg = JSON.parse(read(path));
  pkg.scripts ||= {};

  pkg.scripts['qa:v456-v470'] = 'node scripts/qa-v456-v470-restaurant-ops.mjs';
  for (let v = 456; v <= 470; v += 1) pkg.scripts[`qa:v${v}`] = 'npm run qa:v456-v470';

  // Repair v455 wiring if the local patch exists but package.json missed it.
  const scriptFiles = fs.existsSync('scripts') ? fs.readdirSync('scripts') : [];
  const v455File = scriptFiles.find((file) => /^qa-v455.*\.mjs$/.test(file));
  if (v455File && !pkg.scripts['qa:v455']) pkg.scripts['qa:v455'] = `node scripts/${v455File}`;

  const qaAll = pkg.scripts['qa:all'] || '';
  if (!qaAll.includes('qa:v456-v470')) {
    if (qaAll.includes('npm run qa:v455')) pkg.scripts['qa:all'] = qaAll.replace('npm run qa:v455', 'npm run qa:v455 && npm run qa:v456-v470');
    else if (qaAll.includes('npm run qa:v454')) pkg.scripts['qa:all'] = qaAll.replace('npm run qa:v454', 'npm run qa:v454 && npm run qa:v456-v470');
    else if (qaAll.includes('npm run qa:v451')) pkg.scripts['qa:all'] = qaAll.replace('npm run qa:v451', 'npm run qa:v451 && npm run qa:v456-v470');
    else if (qaAll.includes('npm run typecheck')) pkg.scripts['qa:all'] = qaAll.replace('npm run typecheck', 'npm run qa:v456-v470 && npm run typecheck');
    else pkg.scripts['qa:all'] = `${qaAll} && npm run qa:v456-v470`.replace(/^\s*&&\s*/, '');
  }

  write(path, `${JSON.stringify(pkg, null, 2)}\n`);
  console.log('package.json wired for qa:v456-v470');
}

function patchAppShell() {
  const path = 'src/app/AppShell.tsx';
  ensure(fs.existsSync(path), 'src/app/AppShell.tsx not found');
  let text = read(path);

  if (!text.includes('EnterpriseV456V470RestaurantOpsPage')) {
    const anchor = "const EnterpriseV395V400ProductionReadinessPage = lazy(() => import('../modules/EnterpriseV395V400ProductionReadinessPage'));";
    ensure(text.includes(anchor), 'Could not find lazy import anchor for v395-v400 page');
    text = text.replace(anchor, `${anchor}\nconst EnterpriseV456V470RestaurantOpsPage = lazy(() => import('../modules/EnterpriseV456V470RestaurantOpsPage'));`);
  }

  if (!text.includes("'restaurantOps'")) {
    text = text.replace(/type RouteKey = ([^;]+);/, (m) => m.replace(/;$/, " | 'restaurantOps';"));
  }

  if (!text.includes("restaurantOps: { en: 'Restaurant Flow'")) {
    const anchor = "  releaseGate: { en: 'Release Gate', ar: 'بوابة الإطلاق التجريبي', icon: Rocket },";
    ensure(text.includes(anchor), 'Could not find routeMeta releaseGate anchor');
    text = text.replace(anchor, `${anchor}\n  restaurantOps: { en: 'Restaurant Flow', ar: 'دورة تشغيل المطعم', icon: Store },`);
  }

  if (!text.includes("'restaurantOps'")) {
    throw new Error('RouteKey restaurantOps did not insert correctly');
  }

  if (!text.includes("restaurantOps: <ModuleSuspense")) {
    const anchor = "    releaseGate: <ModuleSuspense label={L(locale, 'Loading pilot release gate', 'تحميل بوابة الإطلاق التجريبي')}><EnterpriseV395V400ProductionReadinessPage gateId=\"release\" state={state} totals={totals} locale={locale} notify={notify} /></ModuleSuspense>,";
    ensure(text.includes(anchor), 'Could not find page map releaseGate anchor');
    text = text.replace(anchor, `${anchor}\n    restaurantOps: <ModuleSuspense label={L(locale, 'Loading restaurant operations flow', 'تحميل دورة تشغيل المطعم')}><EnterpriseV456V470RestaurantOpsPage state={state} locale={locale} notify={notify} /></ModuleSuspense>,`);
  }

  const operationsRegex = /\{ en: 'Operations', ar: 'التشغيل', keys: \[([^\]]+)\] \}/;
  const opsMatch = text.match(operationsRegex);
  ensure(opsMatch, 'Could not find Operations route group');
  if (!opsMatch[1].includes("'restaurantOps'")) {
    const updated = opsMatch[0].replace("'purchasing',", "'purchasing', 'restaurantOps',");
    text = text.replace(opsMatch[0], updated);
  }

  text = text.replace('v395-v400 Release Gates', 'v456-v470 Restaurant Ops');
  text = text.replace('Restaurant ERP v395-v400 Production Readiness Gates', 'Restaurant ERP • Restaurant Operations Flow');
  text = text.replace('Production Readiness Gates now cover tablet UX, deployment, UAT, security, rehearsal, and pilot release signoff.', 'Restaurant Operations Flow now clarifies material requests, reservations, store transfers, internal issues, shortage POs, and Batch No. control.');

  write(path, text);
  console.log('AppShell wired for Restaurant Flow route');
}

patchPackageJson();
patchAppShell();
console.log('v456-v470 wiring complete. Run: npm run qa:v456-v470');
