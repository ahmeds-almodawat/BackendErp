import { useMemo, useState, type ReactNode } from 'react';
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
  buildV367MegaUpgradeSnapshot,
  rowsToCsv,
  statusTone,
  type V367Status,
} from '../engines/enterpriseV367Engine';

type Locale = 'en' | 'ar';
type Props = {
  state: any;
  totals: any;
  update?: (fn: (s: any) => any, success?: string) => void;
  locale: Locale;
  notify?: (type: 'success' | 'warning' | 'error', message: string) => void;
};

const tabs = ['command', 'gates', 'modules', 'waves', 'qa', 'exports'] as const;
type Tab = typeof tabs[number];

const L = (locale: Locale, en: string, ar: string) => locale === 'ar' ? ar : en;

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
  download(filename, `\ufeff${rowsToCsv(rows)}`, 'text/csv;charset=utf-8;');
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

function Badge({ status, children }: { status: V367Status; children?: ReactNode }) {
  return <span className={`v240-badge ${statusTone(status)}`}>{children ?? status}</span>;
}

function Table({ rows }: { rows: Array<Record<string, any>> }) {
  if (!rows.length) return <div className="notice">No rows</div>;
  const headers = Array.from(rows.reduce<Set<string>>((set, row) => {
    Object.keys(row || {}).forEach((key) => set.add(key));
    return set;
  }, new Set<string>()));
  return <div className="v240-table"><table><thead><tr>{headers.map((header) => <th key={header}>{header}</th>)}</tr></thead><tbody>{rows.map((row, idx) => <tr key={idx}>{headers.map((header) => <td key={header}>{renderCell(row?.[header])}</td>)}</tr>)}</tbody></table></div>;
}

function renderCell(value: any) {
  if (['ready', 'warning', 'critical', 'manual'].includes(String(value))) {
    return <Badge status={value as V367Status}>{String(value)}</Badge>;
  }
  if (Array.isArray(value)) return value.join(', ');
  if (value && typeof value === 'object') return JSON.stringify(value);
  return String(value ?? '');
}

function tabLabel(tab: Tab, locale: Locale) {
  const labels: Record<Tab, string> = {
    command: L(locale, 'Command', 'Command'),
    gates: L(locale, 'Gates', 'Gates'),
    modules: L(locale, 'Modules', 'Modules'),
    waves: L(locale, 'Upgrade Waves', 'Upgrade Waves'),
    qa: L(locale, 'QA', 'QA'),
    exports: L(locale, 'Exports', 'Exports'),
  };
  return labels[tab];
}

export default function EnterpriseV367UpgradePage({ state, totals, update, locale, notify }: Props) {
  const [tab, setTab] = useState<Tab>('command');
  const snapshot = useMemo(() => buildV367MegaUpgradeSnapshot(state, totals), [state, totals]);
  const criticalGates = snapshot.gates.filter((gate) => gate.status === 'critical');
  const warningGates = snapshot.gates.filter((gate) => gate.status === 'warning');
  const topFindings = [...criticalGates, ...warningGates].slice(0, 8);

  const recordReview = () => {
    const note = `v367 upgrade score ${snapshot.scores.upgradeScore}/100; critical gates ${snapshot.counts.criticalGates}; warning gates ${snapshot.counts.warningGates}; backend mode ${snapshot.runtime.mode}.`;
    update?.((current: any) => ({
      ...current,
      audits: [
        ...(Array.isArray(current?.audits) ? current.audits : []),
        { id: `AUD-${Date.now()}`, at: new Date().toISOString(), action: 'v367.mega_upgrade_review', entity: 'enterprise_upgrade', ref: 'V367', user: 'Local Admin', note },
      ],
    }), L(locale, 'v367 upgrade review logged', 'v367 upgrade review logged'));
    notify?.('success', L(locale, 'v367 upgrade review logged', 'v367 upgrade review logged'));
  };

  return <div className="v240-page v367-page">
    <div className="v240-hero">
      <div>
        <span className="eyebrow">v367 Mega Upgrade Patch</span>
        <h2>{L(locale, 'Enterprise upgrade command center', 'Enterprise upgrade command center')}</h2>
        <p>{L(locale, 'A live evaluator for the repair patch: it scores business data truth, module permission coverage, backend readiness, AppShell refactor pressure, release gates, and the next upgrade waves from the current ERP state.', 'A live evaluator for the repair patch: it scores business data truth, module permission coverage, backend readiness, AppShell refactor pressure, release gates, and the next upgrade waves from the current ERP state.')}</p>
      </div>
      <div className="v240-score">
        <span>{L(locale, 'Upgrade score', 'Upgrade score')}</span>
        <strong>{snapshot.scores.upgradeScore}%</strong>
        <small>{snapshot.counts.criticalGates} critical / {snapshot.counts.warningGates} warning gate(s)</small>
      </div>
    </div>

    <div className="v240-tabs">{tabs.map((item) => <button key={item} className={tab === item ? 'active' : ''} onClick={() => setTab(item)}>{tabLabel(item, locale)}</button>)}</div>

    {tab === 'command' && <div className="v240-grid">
      <Card title={L(locale, 'v367 command board', 'v367 command board')} icon={<Gauge/>} action={<button onClick={recordReview}><ClipboardCheck size={16}/>{L(locale, 'Log review', 'Log review')}</button>}>
        <div className="v240-kpi-grid">
          <KPI label={L(locale, 'Gate score', 'Gate score')} value={`${snapshot.scores.gateScore}%`} hint={`${snapshot.counts.readyGates}/${snapshot.counts.gates} ready`} icon={<BadgeCheck/>}/>
          <KPI label={L(locale, 'Module score', 'Module score')} value={`${snapshot.scores.moduleScore}%`} hint={`${snapshot.counts.readyModules}/${snapshot.counts.modules} modules covered`} icon={<Layers/>}/>
          <KPI label={L(locale, 'Backend score', 'Backend score')} value={`${snapshot.scores.backendScore}%`} hint={snapshot.runtime.supabaseConfigured ? 'Supabase configured' : 'Supabase not configured'} icon={<Database/>}/>
          <KPI label={L(locale, 'Refactor score', 'Refactor score')} value={`${snapshot.scores.refactorScore}%`} hint={`${snapshot.counts.appShellRefactorTasks} shell reduction tasks`} icon={<Activity/>}/>
        </div>

        <div className="v240-alerts">
          <h4>{L(locale, 'Highest priority findings', 'Highest priority findings')}</h4>
          {topFindings.map((row, index) => <div key={`${row.area}-${index}`} className={`v240-issue ${row.status === 'critical' ? 'critical' : 'warning'}`}><strong>{row.status}</strong><span>{row.area}: {row.gate}</span><small>{row.signal} - {row.action}</small></div>)}
          {!topFindings.length && <div className="notice success">{L(locale, 'No critical or warning gates detected in the current local state.', 'No critical or warning gates detected in the current local state.')}</div>}
        </div>
      </Card>

      <Card title={L(locale, 'Runtime summary', 'Runtime summary')} icon={<ShieldCheck/>}>
        <Table rows={[{
          version: snapshot.version,
          mode: snapshot.runtime.mode,
          supabaseConfigured: snapshot.runtime.supabaseConfigured ? 'yes' : 'no',
          productionFindings: snapshot.runtime.productionFindings.length,
          generatedAt: snapshot.generatedAt,
        }]}/>
        {snapshot.runtime.productionFindings.length > 0 && <div className="notice warning">{snapshot.runtime.productionFindings.join(' ')}</div>}
      </Card>
    </div>}

    {tab === 'gates' && <Card title={L(locale, 'Upgrade gates', 'Upgrade gates')} icon={<ListChecks/>} action={<button onClick={() => downloadCsv('v367_upgrade_gates.csv', snapshot.gates)}><Download size={16}/>{L(locale, 'Export gates', 'Export gates')}</button>}>
      <Table rows={snapshot.gates}/>
    </Card>}

    {tab === 'modules' && <Card title={L(locale, 'Module ownership and permission coverage', 'Module ownership and permission coverage')} icon={<LockKeyhole/>} action={<button onClick={() => downloadCsv('v367_module_coverage.csv', snapshot.modules)}><Download size={16}/>{L(locale, 'Export modules', 'Export modules')}</button>}>
      <Table rows={snapshot.modules}/>
    </Card>}

    {tab === 'waves' && <Card title={L(locale, 'Next upgrade waves', 'Next upgrade waves')} icon={<Rocket/>} action={<button onClick={() => downloadCsv('v367_upgrade_waves.csv', snapshot.waves)}><Download size={16}/>{L(locale, 'Export waves', 'Export waves')}</button>}>
      <Table rows={snapshot.waves}/>
    </Card>}

    {tab === 'qa' && <Card title={L(locale, 'v367 QA gate', 'v367 QA gate')} icon={<ClipboardCheck/>} action={<button onClick={() => downloadCsv('v367_qa_suite.csv', snapshot.qa)}><Download size={16}/>{L(locale, 'Export QA', 'Export QA')}</button>}>
      <Table rows={snapshot.qa}/>
      <div className="notice">{L(locale, 'Recommended local gate: npm run qa:v367, npm run qa:v366, npm run typecheck, npm run build.', 'Recommended local gate: npm run qa:v367, npm run qa:v366, npm run typecheck, npm run build.')}</div>
    </Card>}

    {tab === 'exports' && <div className="v240-grid">
      <Card title={L(locale, 'Evidence pack exports', 'Evidence pack exports')} icon={<FileJson/>}>
        <div className="button-row">
          <button onClick={() => downloadJson('v367_mega_upgrade_snapshot.json', snapshot)}><Download size={16}/>{L(locale, 'Snapshot JSON', 'Snapshot JSON')}</button>
          <button onClick={() => downloadCsv('v367_upgrade_gates.csv', snapshot.gates)}><Download size={16}/>{L(locale, 'Gates CSV', 'Gates CSV')}</button>
          <button onClick={() => downloadCsv('v367_module_coverage.csv', snapshot.modules)}><Download size={16}/>{L(locale, 'Modules CSV', 'Modules CSV')}</button>
          <button onClick={() => downloadCsv('v367_upgrade_waves.csv', snapshot.waves)}><Download size={16}/>{L(locale, 'Waves CSV', 'Waves CSV')}</button>
        </div>
        <div className="notice">{L(locale, 'Exports are local evidence artifacts. Production cutover still needs Supabase migration, RLS, posting RPC, backup/restore, and UAT evidence.', 'Exports are local evidence artifacts. Production cutover still needs Supabase migration, RLS, posting RPC, backup/restore, and UAT evidence.')}</div>
      </Card>
      <Card title={L(locale, 'Counts', 'Counts')} icon={<Table2/>}>
        <Table rows={[snapshot.counts]}/>
      </Card>
    </div>}
  </div>;
}
