import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const migrationsDir = path.join(root, 'supabase', 'migrations');
const reportRows = [];

function walk(dir) {
  const out = [];
  if (!fs.existsSync(dir)) return out;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walk(full));
    else if (entry.isFile() && entry.name.endsWith('.sql')) out.push(full);
  }
  return out;
}

function rel(file) {
  return path.relative(root, file).replaceAll(path.sep, '/');
}

function repairSql(sql, file) {
  const pattern = /create\s+policy\s+if\s+not\s+exists\s+([\w"]+)\s+on\s+([^\s;]+)\s+([\s\S]*?);/gi;
  let replacements = 0;
  const next = sql.replace(pattern, (match, policyName, tableName, rest) => {
    replacements += 1;
    reportRows.push({ file: rel(file), policyName, tableName });
    return [
      `drop policy if exists ${policyName} on ${tableName};`,
      '',
      `create policy ${policyName}`,
      `on ${tableName}`,
      String(rest).trim(),
      ';',
    ].join('\n');
  });
  return { sql: next, replacements };
}

if (!fs.existsSync(migrationsDir)) {
  console.error('Missing supabase/migrations directory. Run from the repo root.');
  process.exit(1);
}

let changedFiles = 0;
for (const file of walk(migrationsDir)) {
  const before = fs.readFileSync(file, 'utf8');
  const repaired = repairSql(before, file);
  if (repaired.replacements > 0) {
    fs.writeFileSync(file, repaired.sql);
    changedFiles += 1;
  }
}

const report = [
  '# v380a Policy Syntax Repair Report',
  '',
  `Generated: ${new Date().toISOString()}`,
  '',
  `Changed files: ${changedFiles}`,
  `Policies repaired: ${reportRows.length}`,
  '',
  '| File | Policy | Table |',
  '|---|---|---|',
  ...reportRows.map((row) => `| ${row.file} | ${row.policyName} | ${row.tableName} |`),
  '',
  reportRows.length ? 'All detected `CREATE POLICY IF NOT EXISTS` statements were rewritten to PostgreSQL-compatible `DROP POLICY IF EXISTS` + `CREATE POLICY` syntax.' : 'No forbidden policy syntax was found.',
].join('\n');

fs.mkdirSync(path.join(root, 'docs'), { recursive: true });
fs.writeFileSync(path.join(root, 'docs', 'V380A_POLICY_SYNTAX_REPAIR_REPORT.md'), report);
console.log(report);
