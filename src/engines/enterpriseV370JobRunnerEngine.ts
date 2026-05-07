import {
  buildV369WorkloadSnapshot,
  v369RowsToCsv,
  type V369HeavyJob,
  type V369LaneKey,
  type V369Tone,
} from './enterpriseV369WorkloadEngine';

export type V370RunStatus = 'queued' | 'running' | 'paused' | 'completed' | 'failed' | 'cancelled';

export interface V370WorkloadRun {
  id: string;
  jobId: string;
  jobName: string;
  module: string;
  lane: V369LaneKey;
  priority: string;
  status: V370RunStatus;
  dryRun: boolean;
  totalRows: number;
  batchSize: number;
  totalBatches: number;
  completedBatches: number;
  failedBatches: number;
  processedRows: number;
  checkpoint: string;
  createdAt: string;
  updatedAt: string;
  startedAt?: string;
  completedAt?: string;
  lastError?: string;
  evidence: string[];
}

export interface V370QueueCandidate {
  jobId: string;
  module: string;
  job: string;
  lane: V369LaneKey;
  priority: string;
  estimatedRows: number;
  batchSize: number;
  batches: number;
  status: string;
  alreadyQueued: boolean;
  recommended: boolean;
  action: string;
}

export interface V370LaneQueueRow {
  lane: V369LaneKey;
  queued: number;
  running: number;
  paused: number;
  completed: number;
  failed: number;
  maxConcurrency: number;
  status: 'ready' | 'watch' | 'blocked';
  action: string;
}

export interface V370QueueSnapshot {
  version: string;
  generatedAt: string;
  queueScore: number;
  candidates: V370QueueCandidate[];
  runs: V370WorkloadRun[];
  laneRows: V370LaneQueueRow[];
  counts: {
    totalRuns: number;
    queued: number;
    running: number;
    paused: number;
    completed: number;
    failed: number;
    cancelled: number;
    openRows: number;
    processedRows: number;
  };
  nextAction: string;
}

function arr<T = any>(value: unknown): T[] {
  return Array.isArray(value) ? value as T[] : [];
}

function nowIso() {
  return new Date().toISOString();
}

function makeId(prefix: string) {
  const random = typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID().slice(0, 8) : Math.random().toString(36).slice(2, 10);
  return `${prefix}-${random}`;
}

function clampScore(value: number) {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function runsFromState(state: any): V370WorkloadRun[] {
  return arr<V370WorkloadRun>(state?.workloadRuns).map((run) => ({
    ...run,
    evidence: arr<string>(run.evidence),
    failedBatches: Number(run.failedBatches ?? 0),
    completedBatches: Number(run.completedBatches ?? 0),
    processedRows: Number(run.processedRows ?? 0),
    totalRows: Number(run.totalRows ?? 0),
    totalBatches: Math.max(1, Number(run.totalBatches ?? 1)),
    batchSize: Math.max(1, Number(run.batchSize ?? 1)),
  }));
}

function audit(state: any, action: string, ref: string, note: string) {
  return {
    ...state,
    audits: [
      ...(Array.isArray(state?.audits) ? state.audits : []),
      { id: makeId('AUD'), at: nowIso(), action, entity: 'workload_queue', ref, user: 'Local Admin', note },
    ],
  };
}

function createRunFromJob(job: V369HeavyJob, dryRun = true): V370WorkloadRun {
  const now = nowIso();
  return {
    id: makeId('WRUN'),
    jobId: job.id,
    jobName: job.job,
    module: job.module,
    lane: job.lane,
    priority: job.priority,
    status: 'queued',
    dryRun,
    totalRows: Math.max(0, Number(job.estimatedRows || 0)),
    batchSize: Math.max(1, Number(job.batchSize || 1)),
    totalBatches: Math.max(1, Number(job.batches || 1)),
    completedBatches: 0,
    failedBatches: 0,
    processedRows: 0,
    checkpoint: 'cursor:0',
    createdAt: now,
    updatedAt: now,
    evidence: [`Queued from ${job.id} (${job.module}) as ${dryRun ? 'dry-run' : 'live'} workload.`],
  };
}

function runOpen(run: V370WorkloadRun) {
  return ['queued', 'running', 'paused', 'failed'].includes(run.status);
}

export function buildV370Candidates(state: any, totals: any = {}): V370QueueCandidate[] {
  const workload = buildV369WorkloadSnapshot(state, totals);
  const runs = runsFromState(state);
  const openJobIds = new Set(runs.filter(runOpen).map((run) => run.jobId));
  const recommendedJobId = workload.jobs.find((job) => job.priority === 'P0' && !openJobIds.has(job.id))?.id ?? workload.jobs.find((job) => !openJobIds.has(job.id))?.id ?? '';
  return workload.jobs.map((job) => ({
    jobId: job.id,
    module: job.module,
    job: job.job,
    lane: job.lane,
    priority: job.priority,
    estimatedRows: job.estimatedRows,
    batchSize: job.batchSize,
    batches: job.batches,
    status: job.status,
    alreadyQueued: openJobIds.has(job.id),
    recommended: job.id === recommendedJobId,
    action: openJobIds.has(job.id) ? 'Open run exists; advance, pause, or complete that run first.' : job.id === recommendedJobId ? 'Queue this run first.' : 'Queue when the current priority work is clear.',
  }));
}

export function enqueueV370Run(state: any, totals: any, jobId: string, dryRun = true) {
  const workload = buildV369WorkloadSnapshot(state, totals);
  const job = workload.jobs.find((item) => item.id === jobId);
  if (!job) return audit(state, 'v370.queue_missing_job', jobId, `Could not queue unknown workload job ${jobId}.`);
  const runs = runsFromState(state);
  if (runs.some((run) => run.jobId === jobId && runOpen(run))) {
    return audit(state, 'v370.queue_duplicate_blocked', jobId, `Open workload run already exists for ${jobId}.`);
  }
  const run = createRunFromJob(job, dryRun);
  return audit({ ...state, workloadRuns: [run, ...runs] }, 'v370.queue_enqueued', run.id, `Queued ${job.job} with ${run.totalBatches} batch(es).`);
}

export function advanceV370Run(run: V370WorkloadRun, batches = 1): V370WorkloadRun {
  if (['completed', 'cancelled'].includes(run.status)) return run;
  const now = nowIso();
  const nextCompleted = Math.min(run.totalBatches, Math.max(0, run.completedBatches) + Math.max(1, batches));
  const processedRows = Math.min(run.totalRows, nextCompleted * run.batchSize);
  const completed = nextCompleted >= run.totalBatches || processedRows >= run.totalRows;
  return {
    ...run,
    status: completed ? 'completed' : 'running',
    startedAt: run.startedAt ?? now,
    completedAt: completed ? now : run.completedAt,
    updatedAt: now,
    completedBatches: nextCompleted,
    processedRows,
    checkpoint: `cursor:${processedRows}`,
    lastError: undefined,
    evidence: [
      ...arr<string>(run.evidence),
      completed ? `Completed at ${now}; processed ${processedRows} row(s).` : `Advanced to batch ${nextCompleted}/${run.totalBatches}; checkpoint cursor:${processedRows}.`,
    ],
  };
}

export function advanceV370RunInState(state: any, runId: string, batches = 1) {
  const runs = runsFromState(state);
  let changed: V370WorkloadRun | undefined;
  const nextRuns = runs.map((run) => {
    if (run.id !== runId) return run;
    changed = advanceV370Run(run, batches);
    return changed;
  });
  if (!changed) return audit(state, 'v370.queue_run_missing', runId, `Could not advance missing workload run ${runId}.`);
  return audit({ ...state, workloadRuns: nextRuns }, changed.status === 'completed' ? 'v370.queue_completed' : 'v370.queue_advanced', runId, `${changed.jobName} is ${changed.status} at ${changed.completedBatches}/${changed.totalBatches} batches.`);
}

export function pauseV370RunInState(state: any, runId: string, reason = 'Operator pause') {
  const runs = runsFromState(state);
  const now = nowIso();
  let changed = false;
  const nextRuns = runs.map((run) => {
    if (run.id !== runId || ['completed', 'cancelled'].includes(run.status)) return run;
    changed = true;
    return { ...run, status: 'paused' as V370RunStatus, updatedAt: now, evidence: [...arr<string>(run.evidence), `Paused at ${now}: ${reason}`] };
  });
  if (!changed) return audit(state, 'v370.queue_pause_skipped', runId, `No open workload run paused for ${runId}.`);
  return audit({ ...state, workloadRuns: nextRuns }, 'v370.queue_paused', runId, reason);
}

export function resumeV370RunInState(state: any, runId: string) {
  const runs = runsFromState(state);
  const now = nowIso();
  let changed = false;
  const nextRuns = runs.map((run) => {
    if (run.id !== runId || run.status !== 'paused') return run;
    changed = true;
    return { ...run, status: 'queued' as V370RunStatus, updatedAt: now, evidence: [...arr<string>(run.evidence), `Resumed at ${now}.`] };
  });
  if (!changed) return audit(state, 'v370.queue_resume_skipped', runId, `No paused workload run resumed for ${runId}.`);
  return audit({ ...state, workloadRuns: nextRuns }, 'v370.queue_resumed', runId, 'Run returned to queued state.');
}

export function failV370RunInState(state: any, runId: string, message = 'Manual failure marker') {
  const runs = runsFromState(state);
  const now = nowIso();
  let changed = false;
  const nextRuns = runs.map((run) => {
    if (run.id !== runId || ['completed', 'cancelled'].includes(run.status)) return run;
    changed = true;
    return { ...run, status: 'failed' as V370RunStatus, failedBatches: run.failedBatches + 1, lastError: message, updatedAt: now, evidence: [...arr<string>(run.evidence), `Marked failed at ${now}: ${message}`] };
  });
  if (!changed) return audit(state, 'v370.queue_fail_skipped', runId, `No open workload run failed for ${runId}.`);
  return audit({ ...state, workloadRuns: nextRuns }, 'v370.queue_failed', runId, message);
}

export function buildV370QueueSnapshot(state: any, totals: any = {}): V370QueueSnapshot {
  const runs = runsFromState(state);
  const candidates = buildV370Candidates(state, totals);
  const statuses: V370RunStatus[] = ['queued', 'running', 'paused', 'completed', 'failed', 'cancelled'];
  const count = (status: V370RunStatus) => runs.filter((run) => run.status === status).length;
  const laneConcurrency: Record<V369LaneKey, number> = { interactive: 1, background: 2, scheduled: 1, archive: 1 };
  const lanes: V369LaneKey[] = ['interactive', 'background', 'scheduled', 'archive'];
  const laneRows = lanes.map<V370LaneQueueRow>((lane) => {
    const laneRuns = runs.filter((run) => run.lane === lane);
    const running = laneRuns.filter((run) => run.status === 'running').length;
    const failed = laneRuns.filter((run) => run.status === 'failed').length;
    return {
      lane,
      queued: laneRuns.filter((run) => run.status === 'queued').length,
      running,
      paused: laneRuns.filter((run) => run.status === 'paused').length,
      completed: laneRuns.filter((run) => run.status === 'completed').length,
      failed,
      maxConcurrency: laneConcurrency[lane],
      status: failed ? 'blocked' : running > laneConcurrency[lane] ? 'watch' : 'ready',
      action: failed ? 'Review failed run evidence before starting more work in this lane.' : running > laneConcurrency[lane] ? 'Reduce concurrent runs in this lane.' : 'Lane is inside concurrency guardrail.',
    };
  });
  const processedRows = runs.reduce((sum, run) => sum + run.processedRows, 0);
  const totalRows = runs.reduce((sum, run) => sum + run.totalRows, 0);
  const openRows = Math.max(0, totalRows - processedRows);
  const failedPenalty = count('failed') * 20;
  const pausedPenalty = count('paused') * 6;
  const backlogPenalty = Math.min(25, count('queued') * 4 + count('running') * 2);
  const queueScore = clampScore(100 - failedPenalty - pausedPenalty - backlogPenalty + (count('completed') ? 4 : 0));
  const recommended = candidates.find((candidate) => candidate.recommended && !candidate.alreadyQueued);
  return {
    version: 'v370 Resumable Work Queue Patch',
    generatedAt: nowIso(),
    queueScore,
    candidates,
    runs,
    laneRows,
    counts: {
      totalRuns: runs.length,
      queued: count('queued'),
      running: count('running'),
      paused: count('paused'),
      completed: count('completed'),
      failed: count('failed'),
      cancelled: count('cancelled'),
      openRows,
      processedRows,
    },
    nextAction: count('failed') ? 'Resolve failed run evidence before queueing additional heavy work.' : recommended ? `Queue ${recommended.jobId}: ${recommended.job}.` : count('queued') || count('running') ? 'Advance open queue runs in small batches.' : 'Queue a dry-run heavy job rehearsal.',
  };
}

export function v370RunStatusTone(status: V370RunStatus): V369Tone {
  if (status === 'completed') return 'ready';
  if (status === 'failed' || status === 'cancelled') return 'bad';
  if (status === 'paused') return 'warn';
  return 'info';
}

export function v370RowsToCsv(rows: any[]) {
  return v369RowsToCsv(rows);
}
