import { lazy, Suspense, useMemo, useState, type ReactNode } from 'react';
import { Database, Download, FileSpreadsheet, ListChecks, Upload } from 'lucide-react';

const ImportStagingPanel = lazy(() => import('./ImportStagingPanel'));

type Locale = 'en' | 'ar';
type ImportTab = 'staging' | 'templates' | 'backup' | 'history';

const L = (_locale: Locale, en: string, _ar: string) => en;

const templates = [
  { key: 'branches', label: 'Branches', columns: ['code', 'nameEn', 'nameAr', 'location', 'active'] },
  { key: 'stores', label: 'Stores', columns: ['code', 'nameEn', 'nameAr', 'branchCode', 'type', 'active'] },
  { key: 'suppliers', label: 'Suppliers', columns: ['code', 'name', 'vatNo', 'paymentTerms', 'contactName', 'phone', 'email', 'bankName', 'bankAccount', 'active'] },
  { key: 'items', label: 'Items / SKUs', columns: ['sku', 'nameEn', 'nameAr', 'category', 'purchaseUnit', 'consumptionUnit', 'conversionFactor', 'minStock', 'maxStock', 'reorderPoint', 'active'] },
  { key: 'menu_items', label: 'Menu Items', columns: ['code', 'nameEn', 'nameAr', 'category', 'sellingPrice', 'vatRate', 'priceIncludesVat', 'active'] },
  { key: 'recipe_lines', label: 'Recipe Lines', columns: ['menuCode', 'itemSku', 'qty', 'unit', 'wastagePct', 'note'] },
  { key: 'cost_centers', label: 'Cost Centers', columns: ['code', 'nameEn', 'nameAr', 'branchCode', 'budget', 'active'] },
  { key: 'employees', label: 'Employees', columns: ['code', 'name', 'branchCode', 'department', 'jobTitle', 'salary', 'active'] },
];

function today() {
  return new Date().toISOString().slice(0, 10);
}

function rowsToCsv(rows: Array<Record<string, unknown>>) {
  if (!rows.length) return '';
  const headers = Object.keys(rows[0]);
  const escape = (value: unknown) => {
    const text = String(value ?? '');
    return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
  };
  return [headers.join(','), ...rows.map((row) => headers.map((header) => escape(row[header])).join(','))].join('\n');
}

function saveFile(fileName: string, content: string, mime = 'text/plain;charset=utf-8') {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  link.click();
  URL.revokeObjectURL(url);
}

function Card({ title, children, icon, action }: { title: string; children: ReactNode; icon?: ReactNode; action?: ReactNode }) {
  return <section className="card"><div className="card-header"><div className="card-title">{icon}{title}</div>{action}</div>{children}</section>;
}

function Table({ headers, rows }: { headers: ReactNode[]; rows: ReactNode[][] }) {
  return <div className="table-wrap"><table><thead><tr>{headers.map((header, index) => <th key={index}>{header}</th>)}</tr></thead><tbody>{rows.length ? rows.map((row, index) => <tr key={index}>{row.map((cell, cellIndex) => <td key={cellIndex}>{cell}</td>)}</tr>) : <tr><td colSpan={headers.length}>-</td></tr>}</tbody></table></div>;
}

function countRows(state: any) {
  const keys = ['branches', 'stores', 'suppliers', 'items', 'menuItems', 'recipeLines', 'costCenters', 'employees', 'importProfiles', 'audits'];
  return keys.map((key) => ({ key, rows: Array.isArray(state?.[key]) ? state[key].length : 0 }));
}

export default function ImportExportPage({ state, setState, locale, notify }: { state: any; setState: (state: any) => void; locale: Locale; notify: (type: 'success' | 'warning' | 'error', message: string) => void }) {
  const [tab, setTab] = useState<ImportTab>('staging');
  const counts = useMemo(() => countRows(state), [state]);

  const exportJson = () => {
    saveFile(`restaurant-erp-backup-${today()}.json`, JSON.stringify(state, null, 2), 'application/json;charset=utf-8');
  };

  const importJson = (file: File) => {
    file.text().then((text) => {
      try {
        const parsed = JSON.parse(text);
        const audit = {
          id: `AUD-${Date.now()}`,
          at: new Date().toISOString(),
          action: 'import',
          entity: 'system',
          ref: file.name,
          user: 'local-admin',
          note: 'Full JSON restore through v368 route-owned import page',
        };
        setState({ ...parsed, audits: [audit, ...(Array.isArray(parsed?.audits) ? parsed.audits : [])] });
        notify('success', L(locale, 'JSON backup imported', 'JSON backup imported'));
      } catch {
        notify('error', L(locale, 'Invalid JSON backup file', 'Invalid JSON backup file'));
      }
    });
  };

  const exportTemplate = (template: typeof templates[number]) => {
    const row = Object.fromEntries(template.columns.map((column) => [column, column.includes('active') ? 'true' : '']));
    saveFile(`${template.key}_template_v368.csv`, `\ufeff${rowsToCsv([row])}`, 'text/csv;charset=utf-8');
  };

  return <div className="page-grid">
    <Card title={L(locale, 'Import / Export Center', 'Import / Export Center')} icon={<FileSpreadsheet/>}>
      <div className="tab-row">
        {(['staging', 'templates', 'backup', 'history'] as const).map((item) => <button key={item} className={tab === item ? 'active-tab' : ''} onClick={() => setTab(item)}>{item}</button>)}
      </div>
      <div className="notice">{L(locale, 'This route is now module-owned. Bulk import staging and cutover controls remain separated from AppShell.', 'This route is now module-owned.')}</div>
    </Card>

    {tab === 'staging' && <Suspense fallback={<div className="notice">{L(locale, 'Loading import staging controls', 'Loading import staging controls')}</div>}>
      <ImportStagingPanel/>
    </Suspense>}

    {tab === 'templates' && <Card title={L(locale, 'Startup CSV templates', 'Startup CSV templates')} icon={<Download/>}>
      <Table headers={['Template', 'Columns', 'Action']} rows={templates.map((template) => [template.label, template.columns.join(', '), <button onClick={() => exportTemplate(template)}><Download size={16}/>Download</button>])}/>
    </Card>}

    {tab === 'backup' && <div className="page-grid two">
      <Card title={L(locale, 'Full local backup', 'Full local backup')} icon={<Database/>}>
        <div className="button-row">
          <button onClick={exportJson}><Download size={16}/>{L(locale, 'Export JSON backup', 'Export JSON backup')}</button>
          <label className="upload-button"><Upload size={16}/>{L(locale, 'Import JSON backup', 'Import JSON backup')}<input type="file" accept="application/json,.json" onChange={(event) => event.target.files?.[0] && importJson(event.target.files[0])}/></label>
        </div>
        <div className="notice warning">{L(locale, 'JSON restore replaces local browser state. Use staging import tables for governed production cutover.', 'JSON restore replaces local browser state.')}</div>
      </Card>
      <Card title={L(locale, 'Current row counts', 'Current row counts')} icon={<ListChecks/>}>
        <Table headers={['Dataset', 'Rows']} rows={counts.map((row) => [row.key, `${row.rows}`])}/>
      </Card>
    </div>}

    {tab === 'history' && <Card title={L(locale, 'Recent import and export audit trail', 'Recent import and export audit trail')} icon={<ListChecks/>}>
      <Table headers={['Time', 'Action', 'Entity', 'Reference', 'Note']} rows={(Array.isArray(state?.audits) ? state.audits : []).filter((audit: any) => String(audit?.action || '').includes('import') || String(audit?.action || '').includes('export')).slice(0, 60).map((audit: any) => [String(audit?.at || '').slice(0, 19).replace('T', ' '), audit?.action, audit?.entity, audit?.ref, audit?.note])}/>
    </Card>}
  </div>;
}
