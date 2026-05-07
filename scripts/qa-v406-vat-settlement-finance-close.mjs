import fs from 'node:fs';
import path from 'node:path';

const migration = 'supabase/migrations/20260506240600_v406_vat_settlement_finance_close_server_posting.sql';
const doc = 'docs/V406_VAT_SETTLEMENT_FINANCE_CLOSE_SERVER_POSTING.md';
const qaDoc = 'docs/V406_VAT_SETTLEMENT_FINANCE_CLOSE_QA.md';

const findings = [];
const critical = (area, finding, action) => findings.push({ severity: 'critical', area, finding, action });
const warning = (area, finding, action) => findings.push({ severity: 'warning', area, finding, action });

if (!fs.existsSync(migration)) critical('migration', 'v406 migration file is missing.', 'Restore the v406 SQL migration.');
if (!fs.existsSync(doc)) critical('docs', 'v406 documentation is missing.', 'Restore the v406 documentation file.');

if (fs.existsSync(migration)) {
  const sql = fs.readFileSync(migration, 'utf8');
  const required = [
    'vat_settlement_server_runs',
    'vat_settlement_server_lines',
    'finance_close_server_runs',
    'finance_close_server_checks',
    'finance_close_server_events',
    'finance_post_vat_settlement_server',
    'finance_close_period_server',
    'finance_post_vat_settlement',
    'finance_close_period',
    'for update',
    'finance_server_record_event',
    'duplicate',
    'open worker jobs',
    'grant execute on function public.finance_post_vat_settlement_server',
    'grant execute on function public.finance_close_period_server',
  ];

  for (const token of required) {
    if (!sql.toLowerCase().includes(token.toLowerCase())) {
      critical('migration', `Missing required token: ${token}`, 'Review v406 migration completeness.');
    }
  }

  const forbidden = [
    'create policy if not exists',
    '\\i ',
    'unique(company_id, source_system, import_type, batch_key, coalesce',
  ];
  for (const token of forbidden) {
    if (sql.toLowerCase().includes(token.toLowerCase())) {
      critical('migration', `Forbidden SQL pattern remains: ${token}`, 'Use Supabase-compatible SQL syntax.');
    }
  }

  if (!sql.includes('revoke execute on function public.finance_post_vat_settlement_server')) {
    warning('security', 'No explicit revoke found for VAT settlement server RPC.', 'Keep RPC grants explicit.');
  }
}

const report = [`# v406 VAT Settlement / Finance Close QA`, '', `Generated: ${new Date().toISOString()}`, '', `Critical: ${findings.filter((f) => f.severity === 'critical').length}`, `Warnings: ${findings.filter((f) => f.severity === 'warning').length}`, '', '| Severity | Area | Finding | Action |', '|---|---|---|---|'];
for (const f of findings) report.push(`| ${f.severity} | ${f.area} | ${f.finding.replaceAll('|', '\\|')} | ${f.action.replaceAll('|', '\\|')} |`);
if (!findings.length) report.push('', 'No v406 VAT settlement / finance close issues detected.');
fs.writeFileSync(qaDoc, report.join('\n'));

if (findings.some((f) => f.severity === 'critical')) {
  console.error(report.join('\n'));
  process.exit(1);
}

console.log(report.join('\n'));
