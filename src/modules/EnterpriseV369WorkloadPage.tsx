import { isValidElement, useMemo, useState, type ReactNode } from 'react';
import {
  Activity,
  AlertTriangle,
  BadgeCheck,
  ClipboardCheck,
  Database,
  Download,
  FileJson,
  Gauge,
  Layers,
  ListChecks,
  LockKeyhole,
  Rocket,
  ShieldCheck,
  Table2,
} from 'lucide-react';
import {
  buildV369WorkloadSnapshot,
  v369RowsToCsv,
  v369StatusTone,
  type V369Status,
} from '../engines/enterpriseV369WorkloadEngine';
import {
  advanceV370RunInState,
  buildV370QueueSnapshot,
  enqueueV370Run,
  failV370RunInState,
  pauseV370RunInState,
  resumeV370RunInState,
  v370RunStatusTone,
  type V370RunStatus,
} from '../engines/enterpriseV370JobRunnerEngine';
import { buildV371WorkerSnapshot, v371ContractsToRows } from '../engines/enterpriseV371WorkerContractEngine';

type Locale = 'en' | 'ar';
type Props = {
  state: any;
  totals: any;
  update?: (fn: (s: any) => any, success?: string) => void;
  locale: Locale;
  notify?: (type: 'success' | 'warning' | 'error', message: string) => void;
};

const tabs = ['command', 'queue', 'workers', 'datasets', 'jobs', 'lanes', 'guardrails', 'runbook', 'exports'] as const;
type Tab = typeof tabs[number];

const L = (_locale: Locale, en: string, _ar: string) => en;

function download(filename: string, content: string, mime = 'text/plain;charset=utf-8') {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

function downloadCsv(filename: string, rows: any[]) {
  download(filename, `\ufeff${v369RowsToCsv(rows)}`, 'text/csv;charset=utf-8;');
}

function downloadJson(filename: string, data: unknown) {
  download(filename, JSON.stringify(data, null, 2), 'application/json;charset=utf-8;');
}

function Card({ title, icon, children, action }: { title: string; icon?: ReactNode; children: ReactNode; action?: ReactNode }) {
  return <section className="v240-card"><div className="v240-card-head"><div className="v240-title">{icon}<h3>{title}</h3></div>{action}</div>{children}</section>;
}

function KPI({ label, value, hint, icon }: { label: string; value: string | number; hint: string; icon: ReactNode }) {
  return <div className="v240-kpi"><div className="v240-kpi-icon">{icon}</div><div><span>{label}</span><strong>{value}</strong><small>{hint}</small></div></div>;
}

function Badge({ status, children }: { status: V369Status; children?: ReactNode }) {
  return <span className={`v240-badge ${v369StatusTone(status)}`}>{children ?? status}</span>;
}

function renderCell(value: any) {
  if (isValidElement(value)) return value;
  if (['ready', 'watch', 'limit', 'blocked'].includes(String(value))) return <Badge status={value as V369Status}>{String(value)}</Badge>;
  if (['queued', 'running', 'paused', 'completed', 'failed', 'cancelled'].includes(String(value))) return <span className={`v240-badge ${v370RunStatusTone(value as V370RunStatus)}`}>{String(value)}</span>;
  if (Array.isArray(value)) return value.join(', ');
  if (value && typeof value === 'object') return JSON.stringify(value);
  return String(value ?? '');
}

function Table({ rows }: { rows: Array<Record<string, any>> }) {
  if (!rows.length) return <div className="notice">No rows</div>;
  const headers = Array.from(rows.reduce<Set<string>>((set, row) => {
    Object.keys(row || {}).forEach((key) => set.add(key));
    return set;
  }, new Set<string>()));
  return <div className="v240-table"><table><thead><tr>{headers.map((header) => <th key={header}>{header}</th>)}</tr></thead><tbody>{rows.map((row, index) => <tr key={index}>{headers.map((header) => <td key={header}>{renderCell(row?.[header])}</td>)}</tr>)}</tbody></table></div>;
}

function tabLabel(tab: Tab, locale: Locale) {
  const labels: Record<Tab, string> = {
    command: L(locale, 'Command', 'Command'),
    queue: L(locale, 'Queue', 'Queue'),
    workers: L(locale, 'Workers', 'Workers'),
    datasets: L(locale, 'Datasets', 'Datasets'),
    jobs: L(locale, 'Heavy Jobs', 'Heavy Jobs'),
    lanes: L(locale, 'Lanes', 'Lanes'),
    guardrails: L(locale, 'Guardrails', 'Guardrails'),
    runbook: L(locale, 'Runbook', 'Runbook'),
    exports: L(locale, 'Exports', 'Exports'),
  };
  return labels[tab];
}

function flattenSnapshot(snapshot: ReturnType<typeof buildV369WorkloadSnapshot>) {
  return {
    generatedAt: snapshot.generatedAt,
    version: snapshot.version,
    posture: snapshot.posture,
    platformScore: snapshot.scores.platformScore,
    capacityScore: snapshot.scores.capacityScore,
    batchSafetyScore: snapshot.scores.batchSafetyScore,
    dataReadinessScore: snapshot.scores.dataReadinessScore,
    totalRows: snapshot.counts.totalRows,
    mode: snapshot.runtime.mode,
    supabaseConfigured: snapshot.runtime.supabaseConfigured,
    browserStateBytes: snapshot.runtime.browserStateBytes,
  };
}

export default function EnterpriseV369WorkloadPage({ state, totals, update, locale, notify }: Props) {
  const [tab, setTab] = useState<Tab>('command');
  const snapshot = useMemo(() => buildV369WorkloadSnapshot(state, totals), [state, totals]);
  const queue = useMemo(() => buildV370QueueSnapshot(state, totals), [state, totals]);
  const workers = useMemo(() => buildV371WorkerSnapshot(state, totals), [state, totals]);
  const pressureDatasets = snapshot.datasets.filter((row) => row.status !== 'ready').slice(0, 8);
  const priorityJobs = snapshot.jobs.filter((row) => row.priority === 'P0' || row.status !== 'ready').slice(0, 8);

  const logRehearsal = () => {
    const note = `v369 platform score ${snapshot.scores.platformScore}/100; total rows ${snapshot.counts.totalRows}; heavy jobs ${snapshot.counts.heavyJobs}; blocked guardrails ${snapshot.counts.blockedGuardrails}.`;
    update?.((current: any) => ({
      ...current,
      audits: [
        ...(Array.isArray(current?.audits) ? current.audits : []),
        { id: `AUD-${Date.now()}`, at: new Date().toISOString(), action: 'v369.heavy_work_rehearsal', entity: 'workload_ops', ref: 'V369', user: 'Local Admin', note },
      ],
    }), L(locale, 'v369 heavy-work rehearsal logged', 'v369 heavy-work rehearsal logged'));
    notify?.('success', L(locale, 'v369 heavy-work rehearsal logged', 'v369 heavy-work rehearsal logged'));
  };

  const exportPack = () => {
    downloadJson('v369_workload_snapshot.json', snapshot);
    downloadJson('v370_queue_snapshot.json', queue);
    downloadJson('v371_worker_contracts.json', workers);
    downloadCsv('v369_dataset_budgets.csv', snapshot.datasets);
    downloadCsv('v369_heavy_jobs.csv', snapshot.jobs);
    downloadCsv('v369_guardrails.csv', snapshot.guardrails);
    downloadCsv('v370_queue_runs.csv', queue.runs);
    downloadCsv('v371_worker_contracts.csv', v371ContractsToRows(workers.contracts));
  };

  const queueRun = (jobId: string) => {
    update?.((current: any) => enqueueV370Run(current, totals, jobId, true), L(locale, 'v370 workload run queued', 'v370 workload run queued'));
    notify?.('success', L(locale, 'v370 workload run queued', 'v370 workload run queued'));
    setTab('queue');
  };

  const advanceRun = (runId: string) => update?.((current: any) => advanceV370RunInState(current, runId, 1), L(locale, 'v370 workload run advanced', 'v370 workload run advanced'));
  const pauseRun = (runId: string) => update?.((current: any) => pauseV370RunInState(current, runId), L(locale, 'v370 workload run paused', 'v370 workload run paused'));
  const resumeRun = (runId: string) => update?.((current: any) => resumeV370RunInState(current, runId), L(locale, 'v370 workload run resumed', 'v370 workload run resumed'));
  const failRun = (runId: string) => update?.((current: any) => failV370RunInState(current, runId, 'Operator marked run for review'), L(locale, 'v370 workload run marked for review', 'v370 workload run marked for review'));

  return <div className="v240-page v367-page">
    <div className="v240-hero">
      <div>
        <span className="eyebrow">v370 Resumable Work Queue Patch</span>
        <h2>{L(locale, 'Workload operations center', 'Workload operations center')}</h2>
        <p>{L(locale, 'A pragmatic platform posture: keep the ERP mid-range and affordable, while heavy imports, posting replay, report rebuilds, reconciliation, and archive work run as resumable queue jobs.', 'A pragmatic platform posture: keep the ERP mid-range and affordable, while heavy imports, posting replay, report rebuilds, reconciliation, and archive work run as resumable queue jobs.')}</p>
      </div>
      <div className="v240-score">
        <span>{L(locale, 'Queue score', 'Queue score')}</span>
        <strong>{queue.queueScore}%</strong>
        <small>{queue.counts.totalRuns} run(s), {queue.counts.openRows.toLocaleString()} open row(s)</small>
      </div>
    </div>

    <div className="v240-tabs">{tabs.map((item) => <button key={item} className={tab === item ? 'active' : ''} onClick={() => setTab(item)}>{tabLabel(item, locale)}</button>)}</div>

    {tab === 'command' && <div className="v240-grid">
      <Card title={L(locale, 'Mid-range command board', 'Mid-range command board')} icon={<Gauge/>} action={<button onClick={logRehearsal}><ClipboardCheck size={16}/>{L(locale, 'Log rehearsal', 'Log rehearsal')}</button>}>
        <div className="v240-kpi-grid">
          <KPI label={L(locale, 'Capacity score', 'Capacity score')} value={`${snapshot.scores.capacityScore}%`} hint={`${snapshot.counts.readyDatasets}/${snapshot.datasets.length} datasets inside budget`} icon={<Database/>}/>
          <KPI label={L(locale, 'Batch safety', 'Batch safety')} value={`${snapshot.scores.batchSafetyScore}%`} hint={`${snapshot.jobs.length} resumable heavy jobs mapped`} icon={<Layers/>}/>
          <KPI label={L(locale, 'Queue score', 'Queue score')} value={`${queue.queueScore}%`} hint={`${queue.counts.queued} queued / ${queue.counts.running} running`} icon={<Activity/>}/>
          <KPI label={L(locale, 'Worker score', 'Worker score')} value={`${workers.workerScore}%`} hint={`${workers.counts.contracts} contract(s), ${workers.counts.ready} ready`} icon={<LockKeyhole/>}/>
          <KPI label={L(locale, 'Data readiness', 'Data readiness')} value={`${snapshot.scores.dataReadinessScore}%`} hint={`${snapshot.counts.blockedGuardrails} blocked guardrails`} icon={<ShieldCheck/>}/>
          <KPI label={L(locale, 'Runtime mode', 'Runtime mode')} value={snapshot.runtime.mode} hint={snapshot.runtime.supabaseConfigured ? 'Backend configured' : 'Local rehearsal mode'} icon={<Rocket/>}/>
        </div>
        <div className="notice">{snapshot.posture} Queue next action: {queue.nextAction}</div>
      </Card>

      <div className="v240-two">
        <Card title={L(locale, 'Current pressure points', 'Current pressure points')} icon={<AlertTriangle/>}>
          <Table rows={pressureDatasets.length ? pressureDatasets.map((row) => ({ dataset: row.dataset, rows: row.rows, usagePct: `${row.usagePct}%`, lane: row.lane, status: row.status, action: row.action })) : [{ dataset: 'No pressure point', rows: 0, usagePct: '0%', lane: 'interactive', status: 'ready', action: 'Current local data remains inside mid-range limits.' }]}/>
        </Card>
        <Card title={L(locale, 'Priority heavy jobs', 'Priority heavy jobs')} icon={<Activity/>}>
          <Table rows={priorityJobs.map((row) => ({ id: row.id, module: row.module, job: row.job, lane: row.lane, batches: row.batches, status: row.status, output: row.output }))}/>
        </Card>
      </div>
    </div>}

    {tab === 'queue' && <div className="v240-grid">
      <Card title={L(locale, 'Resumable queue control', 'Resumable queue control')} icon={<Activity/>} action={<button onClick={() => downloadJson('v370_queue_snapshot.json', queue)}><Download size={16}/>Queue JSON</button>}>
        <div className="v240-kpi-grid">
          <KPI label={L(locale, 'Queued', 'Queued')} value={queue.counts.queued} hint="Waiting for operator advance" icon={<ListChecks/>}/>
          <KPI label={L(locale, 'Running', 'Running')} value={queue.counts.running} hint="Currently in progress" icon={<Rocket/>}/>
          <KPI label={L(locale, 'Processed rows', 'Processed rows')} value={queue.counts.processedRows.toLocaleString()} hint={`${queue.counts.openRows.toLocaleString()} remaining`} icon={<Gauge/>}/>
          <KPI label={L(locale, 'Failed', 'Failed')} value={queue.counts.failed} hint="Requires review before more work" icon={<AlertTriangle/>}/>
        </div>
        <div className="notice">{queue.nextAction}</div>
      </Card>

      <div className="v240-two">
        <Card title={L(locale, 'Queue candidates', 'Queue candidates')} icon={<ListChecks/>} action={<button onClick={() => downloadCsv('v370_queue_candidates.csv', queue.candidates)}><Download size={16}/>CSV</button>}>
          <Table rows={queue.candidates.map((candidate) => ({ jobId: candidate.jobId, priority: candidate.priority, module: candidate.module, job: candidate.job, lane: candidate.lane, batches: candidate.batches, alreadyQueued: candidate.alreadyQueued ? 'yes' : 'no', recommended: candidate.recommended ? 'yes' : 'no', action: <button disabled={candidate.alreadyQueued || !update} onClick={() => queueRun(candidate.jobId)}>Queue dry-run</button> }))}/>
        </Card>
        <Card title={L(locale, 'Lane queue pressure', 'Lane queue pressure')} icon={<Layers/>} action={<button onClick={() => downloadCsv('v370_lane_queue.csv', queue.laneRows)}><Download size={16}/>CSV</button>}>
          <Table rows={queue.laneRows.map((lane) => ({ lane: lane.lane, queued: lane.queued, running: lane.running, paused: lane.paused, completed: lane.completed, failed: lane.failed, maxConcurrency: lane.maxConcurrency, status: lane.status, action: lane.action }))}/>
        </Card>
      </div>

      <Card title={L(locale, 'Open and recent runs', 'Open and recent runs')} icon={<Table2/>} action={<button onClick={() => downloadCsv('v370_queue_runs.csv', queue.runs)}><Download size={16}/>CSV</button>}>
        <Table rows={queue.runs.slice(0, 25).map((run) => ({ id: run.id, jobId: run.jobId, module: run.module, jobName: run.jobName, lane: run.lane, status: run.status, dryRun: run.dryRun ? 'yes' : 'no', progress: `${run.completedBatches}/${run.totalBatches}`, processedRows: run.processedRows, checkpoint: run.checkpoint, lastError: run.lastError ?? '', controls: <div className="button-row compact"><button disabled={!update || ['completed', 'cancelled'].includes(run.status)} onClick={() => advanceRun(run.id)}>Advance</button><button disabled={!update || run.status !== 'paused'} onClick={() => resumeRun(run.id)}>Resume</button><button disabled={!update || ['completed', 'cancelled', 'paused'].includes(run.status)} onClick={() => pauseRun(run.id)}>Pause</button><button disabled={!update || ['completed', 'cancelled', 'failed'].includes(run.status)} onClick={() => failRun(run.id)}>Review</button></div> }))}/>
      </Card>
    </div>}

    {tab === 'workers' && <div className="v240-grid">
      <Card title={L(locale, 'Backend worker contracts', 'Backend worker contracts')} icon={<LockKeyhole/>} action={<button onClick={() => downloadJson('v371_worker_contracts.json', workers)}><Download size={16}/>Contracts JSON</button>}>
        <div className="v240-kpi-grid">
          <KPI label={L(locale, 'Worker score', 'Worker score')} value={`${workers.workerScore}%`} hint={workers.backendConfigured ? 'Backend configured' : 'Local contract rehearsal'} icon={<Gauge/>}/>
          <KPI label={L(locale, 'Contracts', 'Contracts')} value={workers.counts.contracts} hint={`${workers.counts.ready} ready / ${workers.counts.watch} watch`} icon={<ListChecks/>}/>
          <KPI label={L(locale, 'Blocked', 'Blocked')} value={workers.counts.blocked} hint="Needs queue/run review" icon={<AlertTriangle/>}/>
          <KPI label={L(locale, 'Backend', 'Backend')} value={workers.backendConfigured ? 'configured' : 'local'} hint={workers.nextAction} icon={<Database/>}/>
        </div>
        <div className="notice">{workers.nextAction}</div>
      </Card>
      <Card title={L(locale, 'Worker handoff manifest', 'Worker handoff manifest')} icon={<Table2/>} action={<button onClick={() => downloadCsv('v371_worker_contracts.csv', v371ContractsToRows(workers.contracts))}><Download size={16}/>CSV</button>}>
        <Table rows={v371ContractsToRows(workers.contracts)}/>
      </Card>
    </div>}

    {tab === 'datasets' && <Card title={L(locale, 'Dataset budgets and batch sizing', 'Dataset budgets and batch sizing')} icon={<Table2/>} action={<button onClick={() => downloadCsv('v369_dataset_budgets.csv', snapshot.datasets)}><Download size={16}/>CSV</button>}>
      <Table rows={snapshot.datasets.map((row) => ({ dataset: row.dataset, rows: row.rows, midRangeBudget: row.midRangeBudget, heavyWorkBudget: row.heavyWorkBudget, usagePct: `${row.usagePct}%`, status: row.status, lane: row.lane, recommendedBatchSize: row.recommendedBatchSize, action: row.action }))}/>
    </Card>}

    {tab === 'jobs' && <Card title={L(locale, 'Heavy-work job catalog', 'Heavy-work job catalog')} icon={<ListChecks/>} action={<button onClick={() => downloadCsv('v369_heavy_jobs.csv', snapshot.jobs)}><Download size={16}/>CSV</button>}>
      <Table rows={snapshot.jobs.map((row) => ({ id: row.id, priority: row.priority, module: row.module, job: row.job, lane: row.lane, estimatedRows: row.estimatedRows, batchSize: row.batchSize, batches: row.batches, status: row.status, trigger: row.trigger, guardrail: row.guardrail, output: row.output }))}/>
    </Card>}

    {tab === 'lanes' && <Card title={L(locale, 'Execution lanes', 'Execution lanes')} icon={<Layers/>} action={<button onClick={() => downloadCsv('v369_job_lanes.csv', snapshot.lanes)}><Download size={16}/>CSV</button>}>
      <Table rows={snapshot.lanes.map((row) => ({ lane: row.lane, title: row.title, status: row.status, concurrency: row.concurrency, maxBatchRows: row.maxBatchRows, maxRuntimeSeconds: row.maxRuntimeSeconds, throttle: row.throttle, useFor: row.useFor }))}/>
    </Card>}

    {tab === 'guardrails' && <Card title={L(locale, 'Heavy-work guardrails', 'Heavy-work guardrails')} icon={<LockKeyhole/>} action={<button onClick={() => downloadCsv('v369_guardrails.csv', snapshot.guardrails)}><Download size={16}/>CSV</button>}>
      <Table rows={snapshot.guardrails.map((row) => ({ area: row.area, status: row.status, signal: row.signal, action: row.action }))}/>
    </Card>}

    {tab === 'runbook' && <Card title={L(locale, 'Operator runbook', 'Operator runbook')} icon={<BadgeCheck/>} action={<button onClick={() => downloadCsv('v369_runbook.csv', snapshot.runbook)}><Download size={16}/>CSV</button>}>
      <Table rows={snapshot.runbook}/>
    </Card>}

    {tab === 'exports' && <div className="v240-grid">
      <Card title={L(locale, 'Evidence export pack', 'Evidence export pack')} icon={<FileJson/>} action={<button onClick={exportPack}><Download size={16}/>{L(locale, 'Export pack', 'Export pack')}</button>}>
        <Table rows={[flattenSnapshot(snapshot)]}/>
        <div className="button-row">
          <button onClick={() => downloadJson('v369_workload_snapshot.json', snapshot)}><FileJson size={16}/>Snapshot JSON</button>
          <button onClick={() => downloadJson('v370_queue_snapshot.json', queue)}><FileJson size={16}/>Queue JSON</button>
          <button onClick={() => downloadJson('v371_worker_contracts.json', workers)}><FileJson size={16}/>Worker JSON</button>
          <button onClick={() => downloadCsv('v369_dataset_budgets.csv', snapshot.datasets)}><Download size={16}/>Dataset CSV</button>
          <button onClick={() => downloadCsv('v369_heavy_jobs.csv', snapshot.jobs)}><Download size={16}/>Jobs CSV</button>
          <button onClick={() => downloadCsv('v370_queue_runs.csv', queue.runs)}><Download size={16}/>Queue CSV</button>
          <button onClick={() => downloadCsv('v371_worker_contracts.csv', v371ContractsToRows(workers.contracts))}><Download size={16}/>Worker CSV</button>
          <button onClick={() => downloadCsv('v369_guardrails.csv', snapshot.guardrails)}><Download size={16}/>Guardrails CSV</button>
        </div>
      </Card>
    </div>}
  </div>;
}
