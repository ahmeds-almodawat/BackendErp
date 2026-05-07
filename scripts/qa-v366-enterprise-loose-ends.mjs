import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const findings = [];

function add(severity, area, finding, action) {
  findings.push({ severity, area, finding, action });
}

function read(file) {
  return fs.readFileSync(path.join(root, file), 'utf8');
}

function walk(dir, predicate = () => true) {
  const out = [];
  const full = path.join(root, dir);
  if (!fs.existsSync(full)) return out;
  for (const entry of fs.readdirSync(full, { withFileTypes: true })) {
    const p = path.join(full, entry.name);
    const rel = path.relative(root, p).replaceAll(path.sep, '/');
    if (entry.isDirectory()) out.push(...walk(rel, predicate));
    else if (predicate(rel)) out.push(rel);
  }
  return out;
}

// 1) Package script target integrity.
const pkg = JSON.parse(read('package.json'));
for (const [name, script] of Object.entries(pkg.scripts ?? {})) {
  const matches = [...String(script).matchAll(/node(?:\s+--[^\s]+|\s+--import\s+[^\s]+|\s+--experimental-strip-types)*\s+([^&|;\s]+\.mjs)/g)];
  for (const match of matches) {
    const target = match[1].replace(/^\.\//, '');
    if (!fs.existsSync(path.join(root, target))) {
      add('critical', 'package.json', `${name} points to missing script ${target}`, 'Fix the script path or add the missing file.');
    }
  }
}

// 2) Master-data FK consistency: this codebase keeps setup IDs as text for current cutover payloads.
const migrationFiles = walk('supabase/migrations', (rel) => rel.endsWith('.sql'));
const masterUuidPattern = /\b(branch_id|store_id|supplier_id|item_id|output_item_id|ingredient_item_id|source_store_id|destination_store_id)\s+uuid\b/i;
for (const file of migrationFiles) {
  const body = read(file);
  if (masterUuidPattern.test(body)) {
    add('critical', 'Supabase migrations', `${file} still declares a master-data FK as uuid`, 'Use text for current branches/stores/items/suppliers IDs or complete a full UUID baseline migration.');
  }
}

// 3) Production must not silently fallback to local demo.
const selector = read('src/lib/dataProvider/providerSelector.ts');
if (/Production mode requested but Supabase is not configured\. Safe fallback selected/i.test(selector)) {
  add('critical', 'Production gate', 'Production provider still silently falls back to local demo.', 'Block production startup when Supabase is not configured.');
}
if (!/Production backend gate blocked startup/.test(selector)) {
  add('warning', 'Production gate', 'Provider selector does not clearly block unsafe production startup.', 'Keep the hard startup gate in selectDataProvider().');
}

// 4) Edge Function skeleton markers are allowed in prototype, but must be visible.
const functionFiles = walk('supabase/functions', (rel) => rel.endsWith('.ts'));
const skeletonMarkers = /skeleton|placeholder|dry[- ]run|wire .*later|not implemented|TODO/i;
const skeletons = [];
for (const file of functionFiles) {
  const body = read(file);
  if (skeletonMarkers.test(body)) skeletons.push(file);
}
if (skeletons.length) {
  add('warning', 'Edge Functions', `${skeletons.length} functions still contain skeleton/dry-run markers: ${skeletons.slice(0, 12).join(', ')}${skeletons.length > 12 ? '...' : ''}`, 'Do not treat those functions as production posting authority until implemented and tested.');
}

// 5) Security-definer grants: flag functions that need manual review.
const sql = migrationFiles.map((file) => `\n-- ${file}\n${read(file)}`).join('\n');
const grantMatches = [...sql.matchAll(/grant\s+execute\s+on\s+function\s+([\w.]+)\s*\([^;]*?\)\s+to\s+authenticated/gi)];
if (grantMatches.length) {
  const risky = [];
  for (const match of grantMatches) {
    const fn = match[1];
    const idx = Math.max(0, sql.lastIndexOf('create or replace function', match.index));
    const block = sql.slice(idx, Math.min(sql.length, match.index + 1200));
    if (/security\s+definer/i.test(block) && !/app_current_user_has_permission|app_assert_permission|auth\.uid\(\)/i.test(block)) {
      risky.push(fn);
    }
  }
  if (risky.length) {
    add('warning', 'RPC security', `${risky.length} authenticated security-definer grants need permission review: ${[...new Set(risky)].slice(0, 12).join(', ')}`, 'Require app_assert_permission(...) or scoped checks inside every sensitive RPC.');
  }
}

// 6) RLS enabled without policies heuristic.
const enabledTables = new Set();
const policyTables = new Set();
for (const file of migrationFiles) {
  const body = read(file);
  for (const m of body.matchAll(/alter\s+table\s+public\.([a-zA-Z0-9_]+)\s+enable\s+row\s+level\s+security/gi)) enabledTables.add(m[1]);
  for (const m of body.matchAll(/create\s+policy\s+[^;]+?\s+on\s+public\.([a-zA-Z0-9_]+)/gis)) policyTables.add(m[1]);
}
const noPolicy = [...enabledTables].filter((table) => !policyTables.has(table)).sort();
if (noPolicy.length) {
  add('warning', 'RLS', `${noPolicy.length} RLS-enabled tables have no direct static policy detected: ${noPolicy.slice(0, 20).join(', ')}${noPolicy.length > 20 ? '...' : ''}`, 'Confirm dynamic v366 guard policies cover these tables, or add explicit module policies.');
}

// 7) Storage bucket guardrails.
const v366Migration = migrationFiles.find((file) => file.includes('v366'));
if (!v366Migration || !/storage\.buckets|storage\.objects/i.test(read(v366Migration))) {
  add('warning', 'Storage', 'No v366 storage bucket/policy guardrail migration detected.', 'Create private buckets and storage.objects policies for finance/purchase/supplier/stock-count documents.');
}

const severityRank = { critical: 3, warning: 2, info: 1 };
findings.sort((a, b) => severityRank[b.severity] - severityRank[a.severity] || a.area.localeCompare(b.area));

const report = [
  '# v366 Enterprise Loose-End Scan',
  '',
  `Generated: ${new Date().toISOString()}`,
  '',
  `Critical: ${findings.filter((f) => f.severity === 'critical').length}`,
  `Warnings: ${findings.filter((f) => f.severity === 'warning').length}`,
  '',
  '| Severity | Area | Finding | Action |',
  '|---|---|---|---|',
  ...findings.map((f) => `| ${f.severity} | ${f.area} | ${f.finding.replaceAll('|', '\\|')} | ${f.action.replaceAll('|', '\\|')} |`),
  '',
  findings.length ? '' : 'No loose ends detected by the v366 static scanner.',
].join('\n');

fs.mkdirSync(path.join(root, 'docs'), { recursive: true });
fs.writeFileSync(path.join(root, 'docs/V366_ENTERPRISE_LOOSE_ENDS_REPORT.md'), report);

console.log(report);

const criticals = findings.filter((f) => f.severity === 'critical');
if (criticals.length) {
  console.error(`\nV366 loose-end scan failed with ${criticals.length} critical finding(s).`);
  process.exit(1);
}
