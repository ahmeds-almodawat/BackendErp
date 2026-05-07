import { buildV370QueueSnapshot, type V370WorkloadRun } from './enterpriseV370JobRunnerEngine';
import { getSupabaseConfig } from '../services/supabaseCutoverBridge';

export type V371ContractStatus = 'ready' | 'watch' | 'blocked';

export interface V371RetryPolicy {
  maxAttempts: number;
  backoffSeconds: number;
  deadLetterAfterAttempts: number;
}

export interface V371WorkerContract {
  contractId: string;
  runId: string;
  jobId: string;
  worker: string;
  lane: string;
  status: V371ContractStatus;
  leaseSeconds: number;
  idempotencyKey: string;
  retryPolicy: V371RetryPolicy;
  payload: {
    dryRun: boolean;
    batchSize: number;
    checkpoint: string;
    totalRows: number;
    module: string;
    jobName: string;
  };
  requiredSecrets: string;
  blockedBy: string;
  handoffAction: string;
}

export interface V371WorkerSnapshot {
  version: string;
  generatedAt: string;
  backendConfigured: boolean;
  contracts: V371WorkerContract[];
  counts: {
    contracts: number;
    ready: number;
    watch: number;
    blocked: number;
  };
  workerScore: number;
  nextAction: string;
}

function workerName(run: V370WorkloadRun) {
  const key = `${run.module}-${run.jobName}`.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
  return `worker-${key || run.jobId.toLowerCase()}`;
}

function leaseSeconds(lane: string) {
  if (lane === 'interactive') return 30;
  if (lane === 'background') return 120;
  if (lane === 'scheduled') return 600;
  return 900;
}

function retryPolicy(lane: string): V371RetryPolicy {
  if (lane === 'interactive') return { maxAttempts: 2, backoffSeconds: 5, deadLetterAfterAttempts: 2 };
  if (lane === 'background') return { maxAttempts: 4, backoffSeconds: 30, deadLetterAfterAttempts: 4 };
  if (lane === 'scheduled') return { maxAttempts: 5, backoffSeconds: 120, deadLetterAfterAttempts: 5 };
  return { maxAttempts: 3, backoffSeconds: 300, deadLetterAfterAttempts: 3 };
}

function statusForRun(run: V370WorkloadRun, backendConfigured: boolean): V371ContractStatus {
  if (run.status === 'failed' || run.status === 'cancelled') return 'blocked';
  if (!backendConfigured || run.status === 'paused') return 'watch';
  return 'ready';
}

function requiredSecrets(run: V370WorkloadRun) {
  if (run.lane === 'archive') return 'SUPABASE_URL,SUPABASE_SERVICE_ROLE_KEY,BACKUP_SIGNING_KEY';
  return 'SUPABASE_URL,SUPABASE_SERVICE_ROLE_KEY';
}

export function buildV371WorkerContracts(state: any, totals: any = {}): V371WorkerContract[] {
  const queue = buildV370QueueSnapshot(state, totals);
  const backendConfigured = getSupabaseConfig().configured;
  const runs = queue.runs.length ? queue.runs : queue.candidates.filter((candidate) => candidate.recommended).map((candidate) => ({
    id: `planned-${candidate.jobId}`,
    jobId: candidate.jobId,
    jobName: candidate.job,
    module: candidate.module,
    lane: candidate.lane,
    priority: candidate.priority,
    status: 'queued',
    dryRun: true,
    totalRows: candidate.estimatedRows,
    batchSize: candidate.batchSize,
    totalBatches: candidate.batches,
    completedBatches: 0,
    failedBatches: 0,
    processedRows: 0,
    checkpoint: 'cursor:0',
    createdAt: queue.generatedAt,
    updatedAt: queue.generatedAt,
    evidence: ['Planned worker contract generated before queue run exists.'],
  } as V370WorkloadRun));

  return runs.map((run) => {
    const status = statusForRun(run, backendConfigured);
    const retry = retryPolicy(run.lane);
    const idempotencyKey = `${run.jobId}:${run.id}:${run.checkpoint}:${run.dryRun ? 'dry' : 'live'}`;
    return {
      contractId: `V371-CONTRACT-${run.id}`,
      runId: run.id,
      jobId: run.jobId,
      worker: workerName(run),
      lane: run.lane,
      status,
      leaseSeconds: leaseSeconds(run.lane),
      idempotencyKey,
      retryPolicy: retry,
      payload: {
        dryRun: run.dryRun,
        batchSize: run.batchSize,
        checkpoint: run.checkpoint,
        totalRows: run.totalRows,
        module: run.module,
        jobName: run.jobName,
      },
      requiredSecrets: requiredSecrets(run),
      blockedBy: status === 'blocked' ? `Run status is ${run.status}.` : !backendConfigured ? 'Supabase backend is not configured in this runtime.' : '',
      handoffAction: status === 'ready' ? 'Ready for backend worker lease acquisition.' : status === 'watch' ? 'Keep as local dry-run until backend secrets and worker runtime are ready.' : 'Resolve run failure/cancellation before handoff.',
    };
  });
}

export function buildV371WorkerSnapshot(state: any, totals: any = {}): V371WorkerSnapshot {
  const contracts = buildV371WorkerContracts(state, totals);
  const backendConfigured = getSupabaseConfig().configured;
  const ready = contracts.filter((contract) => contract.status === 'ready').length;
  const watch = contracts.filter((contract) => contract.status === 'watch').length;
  const blocked = contracts.filter((contract) => contract.status === 'blocked').length;
  const workerScore = Math.max(0, Math.min(100, Math.round(100 - watch * 8 - blocked * 30 + (backendConfigured ? 8 : 0))));
  return {
    version: 'v371 Backend Worker Contract Patch',
    generatedAt: new Date().toISOString(),
    backendConfigured,
    contracts,
    counts: { contracts: contracts.length, ready, watch, blocked },
    workerScore,
    nextAction: blocked ? 'Resolve blocked queue runs before backend handoff.' : backendConfigured ? 'Attach contracts to backend worker execution.' : 'Configure Supabase secrets, then replay these contracts as worker jobs.',
  };
}

export function v371ContractsToRows(contracts: V371WorkerContract[]) {
  return contracts.map((contract) => ({
    contractId: contract.contractId,
    runId: contract.runId,
    jobId: contract.jobId,
    worker: contract.worker,
    lane: contract.lane,
    status: contract.status,
    leaseSeconds: contract.leaseSeconds,
    idempotencyKey: contract.idempotencyKey,
    maxAttempts: contract.retryPolicy.maxAttempts,
    backoffSeconds: contract.retryPolicy.backoffSeconds,
    deadLetterAfterAttempts: contract.retryPolicy.deadLetterAfterAttempts,
    requiredSecrets: contract.requiredSecrets,
    blockedBy: contract.blockedBy,
    handoffAction: contract.handoffAction,
  }));
}
