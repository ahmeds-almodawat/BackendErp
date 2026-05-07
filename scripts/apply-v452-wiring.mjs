
import fs from 'node:fs';
import path from 'node:path';
const root = process.cwd();
const appPath = path.join(root, 'src', 'app', 'AppShell.tsx');
const packagePath = path.join(root, 'package.json');
function read(p){return fs.readFileSync(p,'utf8').replace(/^\uFEFF/,'')}
function write(p,t){fs.writeFileSync(p,t,'utf8')}
let app = read(appPath);
if (!app.includes('EnterpriseV452PilotAutomationPage')) {
  const anchor = "const ImportExportRoutePage = lazy(() => import('../modules/imports/ImportExportPage'));";
  app = app.replace(anchor, `${anchor}\nconst EnterpriseV452PilotAutomationPage = lazy(() => import('../modules/EnterpriseV452PilotAutomationPage'));`);
}
if (!app.includes("'pilotAutomation'")) app = app.replace(/type RouteKey = ([^;]+);/, (m,u)=>`type RouteKey = ${u} | 'pilotAutomation';`);
if (!app.includes('pilotAutomation: {')) app = app.replace(/const routeMeta: Record<RouteKey, \{ en: string; ar: string; icon: typeof LayoutDashboard \}> = \{\n/, "const routeMeta: Record<RouteKey, { en: string; ar: string; icon: typeof LayoutDashboard }> = {\n  pilotAutomation: { en: 'Pilot Automation', ar: 'أتمتة التجربة', icon: Sparkles },\n");
if (!app.includes('pilotAutomation: <ModuleSuspense')) app = app.replace(/const page: Record<RouteKey, ReactNode> = \{\n/, "const page: Record<RouteKey, ReactNode> = {\n    pilotAutomation: <ModuleSuspense label={L(locale, 'Loading pilot automation', 'تحميل أتمتة التجربة')}><EnterpriseV452PilotAutomationPage state={state} setState={setState} locale={locale} notify={notify} /></ModuleSuspense>,\n");
if (!app.match(/keys: \[[^\]]*'pilotAutomation'/s)) app = app.replace(/(\{ en: 'Command', ar: 'القيادة', keys: \[)([^\]]*)\]/, (m,start,keys)=>`${start}'pilotAutomation', ${keys.trim()}]`);
write(appPath, app);
const pkg = JSON.parse(read(packagePath));
pkg.scripts ??= {};
pkg.scripts['qa:v452'] = 'node scripts/qa-v452-pilot-automation.mjs';
if (!String(pkg.scripts['qa:all']||'').includes('qa:v452')) pkg.scripts['qa:all'] = String(pkg.scripts['qa:all']||'').includes('npm run typecheck') ? String(pkg.scripts['qa:all']).replace('npm run typecheck', 'npm run qa:v452 && npm run typecheck') : `${pkg.scripts['qa:all']} && npm run qa:v452`;
write(packagePath, JSON.stringify(pkg,null,2)+'\n');
console.log('v452 wiring applied.');
