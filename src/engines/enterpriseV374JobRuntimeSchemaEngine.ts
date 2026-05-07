export type V374RuntimeTableStatus = 'ready' | 'missing' | 'incomplete';

export interface V374RuntimeTableDefinition {
  table: string;
  purpose: string;
  requiredColumns: string[];
  requiredIndexes: string[];
  requiresRlsPolicy: boolean;
}

export interface V374RuntimeTableFinding {
  table: string;
  status: V374RuntimeTableStatus;
  missingColumns: string[];
  missingIndexes: string[];
  hasRls: boolean;
  hasPolicy: boolean;
  action: string;
}

export interface V374RuntimeSchemaSnapshot {
  version: string;
  generatedAt: string;
  migrationFile: string;
  totalTables: number;
  readyTables: number;
  incompleteTables: number;
  missingTables: number;
  findings: V374RuntimeTableFinding[];
  nextAction: string;
}

export const V374_JOB_RUNTIME_TABLES: V374RuntimeTableDefinition[] = [
  {
    table: 'worker_jobs',
    purpose: 'Canonical queued work item with payload, idempotency key, retry policy, lane, priority, branch scope, and lifecycle status.',
    requiredColumns: ['id', 'job_type', 'module_key', 'lane', 'priority', 'status', 'payload', 'idempotency_key', 'retry_policy', 'available_at', 'created_at', 'updated_at'],
    requiredIndexes: ['worker_jobs_status_available_idx', 'worker_jobs_idempotency_key_uidx'],
    requiresRlsPolicy: true,
  },
  {
    table: 'worker_job_runs',
    purpose: 'Execution attempt record for a job, including attempt number, worker identity, lease token, heartbeat, progress, and error state.',
    requiredColumns: ['id', 'job_id', 'attempt_no', 'status', 'worker_id', 'lease_token', 'lease_expires_at', 'heartbeat_at', 'processed_rows', 'started_at', 'completed_at', 'created_at', 'updated_at'],
    requiredIndexes: ['worker_job_runs_job_id_idx', 'worker_job_runs_status_lease_idx'],
    requiresRlsPolicy: true,
  },
  {
    table: 'worker_job_leases',
    purpose: 'Dedicated lease history/current holder table for safe acquire, heartbeat, release, expiry, retry, and dead-letter behavior in v375.',
    requiredColumns: ['id', 'job_id', 'job_run_id', 'worker_id', 'lease_token', 'status', 'acquired_at', 'heartbeat_at', 'expires_at', 'released_at', 'created_at'],
    requiredIndexes: ['worker_job_leases_active_uidx', 'worker_job_leases_expiry_idx'],
    requiresRlsPolicy: true,
  },
  {
    table: 'worker_job_checkpoints',
    purpose: 'Resumable cursor/checkpoint records so imports, POS replays, inventory rebuilds, report snapshots, and reconciliations can restart safely.',
    requiredColumns: ['id', 'job_id', 'job_run_id', 'checkpoint_key', 'checkpoint_value', 'processed_rows', 'created_at'],
    requiredIndexes: ['worker_job_checkpoints_run_key_uidx'],
    requiresRlsPolicy: true,
  },
  {
    table: 'worker_job_artifacts',
    purpose: 'Evidence/export artifacts produced by jobs, including validation reports, snapshots, CSV/JSON evidence, backup manifests, and failure bundles.',
    requiredColumns: ['id', 'job_id', 'job_run_id', 'artifact_type', 'storage_bucket', 'storage_path', 'metadata', 'created_at'],
    requiredIndexes: ['worker_job_artifacts_job_id_idx'],
    requiresRlsPolicy: true,
  },
  {
    table: 'worker_dead_letters',
    purpose: 'Final failed jobs after retry exhaustion, with reason, last error, payload snapshot, and review status.',
    requiredColumns: ['id', 'job_id', 'job_run_id', 'reason', 'last_error', 'payload', 'attempts', 'review_status', 'created_at', 'resolved_at'],
    requiredIndexes: ['worker_dead_letters_review_idx'],
    requiresRlsPolicy: true,
  },
  {
    table: 'worker_audit_events',
    purpose: 'Append-oriented audit trail for enqueue, acquire, heartbeat, checkpoint, complete, fail, retry, dead-letter, and artifact events.',
    requiredColumns: ['id', 'job_id', 'job_run_id', 'event_type', 'actor_user_id', 'worker_id', 'details', 'created_at'],
    requiredIndexes: ['worker_audit_events_job_idx', 'worker_audit_events_created_idx'],
    requiresRlsPolicy: true,
  },
];

function hasCreateTable(sql: string, table: string): boolean {
  return new RegExp(`create\\s+table\\s+if\\s+not\\s+exists\\s+public\\.${table}\\b`, 'i').test(sql)
    || new RegExp(`create\\s+table\\s+public\\.${table}\\b`, 'i').test(sql);
}

function hasColumn(sql: string, table: string, column: string): boolean {
  const createMatch = sql.match(new RegExp(`create\\s+table(?:\\s+if\\s+not\\s+exists)?\\s+public\\.${table}\\s*\\(([\\s\\S]*?)\\);`, 'i'));
  if (!createMatch) return false;
  return new RegExp(`\\b${column}\\b`, 'i').test(createMatch[1]);
}

function hasIndex(sql: string, indexName: string): boolean {
  return new RegExp(`create\\s+(?:unique\\s+)?index\\s+if\\s+not\\s+exists\\s+${indexName}\\b`, 'i').test(sql)
    || new RegExp(`create\\s+(?:unique\\s+)?index\\s+${indexName}\\b`, 'i').test(sql);
}

function hasRls(sql: string, table: string): boolean {
  return new RegExp(`alter\\s+table\\s+public\\.${table}\\s+enable\\s+row\\s+level\\s+security`, 'i').test(sql);
}

function hasPolicy(sql: string, table: string): boolean {
  return new RegExp(`create\\s+policy\\s+[^;]+?\\s+on\\s+public\\.${table}\\b`, 'is').test(sql);
}

export function buildV374RuntimeSchemaSnapshot(migrationSql: string, migrationFile = 'unknown'): V374RuntimeSchemaSnapshot {
  const findings = V374_JOB_RUNTIME_TABLES.map<V374RuntimeTableFinding>((definition) => {
    const tableExists = hasCreateTable(migrationSql, definition.table);
    const missingColumns = tableExists ? definition.requiredColumns.filter((column) => !hasColumn(migrationSql, definition.table, column)) : definition.requiredColumns;
    const missingIndexes = tableExists ? definition.requiredIndexes.filter((index) => !hasIndex(migrationSql, index)) : definition.requiredIndexes;
    const tableHasRls = hasRls(migrationSql, definition.table);
    const tableHasPolicy = hasPolicy(migrationSql, definition.table);

    const status: V374RuntimeTableStatus =
      !tableExists ? 'missing' : missingColumns.length || missingIndexes.length || !tableHasRls || (definition.requiresRlsPolicy && !tableHasPolicy) ? 'incomplete' : 'ready';

    return {
      table: definition.table,
      status,
      missingColumns,
      missingIndexes,
      hasRls: tableHasRls,
      hasPolicy: tableHasPolicy,
      action:
        status === 'ready'
          ? 'Schema contract present. Use v375 to add acquire/heartbeat/release RPCs.'
          : !tableExists
            ? 'Create the table in the v374 migration.'
            : 'Add missing columns, indexes, RLS, or policies before moving to v375.',
    };
  });

  const readyTables = findings.filter((finding) => finding.status === 'ready').length;
  const missingTables = findings.filter((finding) => finding.status === 'missing').length;
  const incompleteTables = findings.filter((finding) => finding.status === 'incomplete').length;

  return {
    version: 'v374 Job Runtime Schema',
    generatedAt: new Date().toISOString(),
    migrationFile,
    totalTables: V374_JOB_RUNTIME_TABLES.length,
    readyTables,
    incompleteTables,
    missingTables,
    findings,
    nextAction:
      missingTables || incompleteTables
        ? 'Complete the v374 job runtime schema before implementing worker leases in v375.'
        : 'Proceed to v375 Worker Lease Runtime: acquire, heartbeat, release, expire, retry, and dead-letter RPCs.',
  };
}

export function v374SnapshotToMarkdown(snapshot: V374RuntimeSchemaSnapshot): string {
  const lines = [
    '# v374 Job Runtime Schema Report',
    '',
    `Generated: ${snapshot.generatedAt}`,
    `Migration file: ${snapshot.migrationFile}`,
    '',
    `Ready tables: ${snapshot.readyTables}/${snapshot.totalTables}`,
    `Incomplete tables: ${snapshot.incompleteTables}`,
    `Missing tables: ${snapshot.missingTables}`,
    '',
    '| Table | Status | RLS | Policy | Missing columns | Missing indexes | Action |',
    '|---|---|---:|---:|---|---|---|',
    ...snapshot.findings.map((finding) => [
      finding.table,
      finding.status,
      finding.hasRls ? 'yes' : 'no',
      finding.hasPolicy ? 'yes' : 'no',
      finding.missingColumns.length ? finding.missingColumns.join(', ') : '-',
      finding.missingIndexes.length ? finding.missingIndexes.join(', ') : '-',
      finding.action,
    ].map((value) => String(value).replaceAll('|', '\\|')).join(' | ')).map((line) => `| ${line} |`),
    '',
    `Next action: ${snapshot.nextAction}`,
  ];

  return lines.join('\n');
}
