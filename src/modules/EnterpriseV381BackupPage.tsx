import { useMemo, useRef, useState, type ChangeEvent, type ReactNode } from 'react';
import { Archive, CheckCircle2, Database, Download, FileArchive, RefreshCw, ShieldCheck, Upload, XCircle } from 'lucide-react';
import {
  createV381PlatformBackupPackage,
  downloadV381Blob,
  previewV381RestoreFile,
  v381EntityCounts,
  v381BackupWarnings,
  type V381RestorePreview,
} from '../engines/enterpriseV381PlatformBackupEngine';

type Locale = 'en' | 'ar';

type Props = {
  state: any;
  totals?: any;
  update?: (fn: (current: any) => any, success?: string) => void;
  locale: Locale;
  notify?: (type: 'success' | 'warning' | 'error', message: string) => void;
};

function L(locale: Locale, en: string, ar: string) { return locale === 'ar' ? ar : en; }

function Card({ title, icon, children, action }: { title: string; icon?: ReactNode; children: ReactNode; action?: ReactNode }) {
  return <section className="card"><div className="card-header"><div className="card-title">{icon}{title}</div>{action}</div>{children}</section>;
}

function KPI({ label, value, hint, icon }: { label: string; value: string | number; hint: string; icon: ReactNode }) {
  return <div className="kpi"><div className="kpi-icon">{icon}</div><div><span>{label}</span><strong>{value}</strong><small>{hint}</small></div></div>;
}

function Table({ rows }: { rows: Array<Record<string, any>> }) {
  if (!rows.length) return <div className="notice">No rows</div>;
  const headers = Object.keys(rows[0]);
  return <div className="table-wrap"><table><thead><tr>{headers.map((h) => <th key={h}>{h}</th>)}</tr></thead><tbody>{rows.map((row, idx) => <tr key={idx}>{headers.map((h) => <td key={h}>{String(row[h] ?? '')}</td>)}</tr>)}</tbody></table></div>;
}

export default function EnterpriseV381BackupPage({ state, totals, update, locale, notify }: Props) {
  const fileRef = useRef<HTMLInputElement | null>(null);
  const [preview, setPreview] = useState<V381RestorePreview | null>(null);
  const [confirmReplace, setConfirmReplace] = useState(false);
  const [busy, setBusy] = useState(false);
  const counts = useMemo(() => v381EntityCounts(state), [state]);
  const warnings = useMemo(() => v381BackupWarnings(state), [state]);
  const topCounts = Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 12).map(([entity, rows]) => ({ entity, rows }));
  const totalRows = Object.values(counts).reduce((sum, value) => sum + Number(value || 0), 0);

  const exportBackup = async () => {
    try {
      setBusy(true);
      const pack = await createV381PlatformBackupPackage(state, totals, 'full-platform');
      downloadV381Blob(pack.filename, pack.blob);
      notify?.('success', L(locale, 'Full platform backup ZIP exported', 'تم تصدير نسخة احتياطية كاملة بصيغة ZIP'));
    } catch (error) {
      notify?.('error', error instanceof Error ? error.message : String(error));
    } finally {
      setBusy(false);
    }
  };

  const onFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    setConfirmReplace(false);
    if (!file) return;
    setBusy(true);
    const result = await previewV381RestoreFile(file);
    setPreview(result);
    setBusy(false);
    if (!result.ok) notify?.('error', result.error ?? L(locale, 'Backup preview failed', 'فشل فحص ملف النسخة الاحتياطية'));
  };

  const restore = () => {
    if (!preview?.ok || !preview.state || !confirmReplace) return;
    update?.((current: any) => ({
      ...preview.state,
      audits: [
        ...(Array.isArray(preview.state?.audits) ? preview.state.audits : []),
        {
          id: `AUD-${Date.now()}`,
          at: new Date().toISOString(),
          action: 'v381.restore_platform_backup',
          entity: 'platform_backup',
          ref: preview.manifest?.stateHash ?? 'RESTORE',
          user: 'Local Admin',
          note: `Restored ${preview.manifest?.version ?? 'backup'} generated ${preview.manifest?.generatedAt ?? 'unknown'}.`,
        },
      ],
    }), L(locale, 'Platform backup restored', 'تمت استعادة النسخة الاحتياطية'));
    notify?.('success', L(locale, 'Restore completed. Review dashboards and reports now.', 'تمت الاستعادة. راجع اللوحات والتقارير الآن.'));
    setPreview(null);
    setConfirmReplace(false);
    if (fileRef.current) fileRef.current.value = '';
  };

  return <div className="v240-page v367-page">
    <div className="v240-hero">
      <div>
        <span className="eyebrow">v381 Backup / Restore</span>
        <h2>{L(locale, 'Platform backup and restore center', 'مركز النسخ الاحتياطي والاستعادة')}</h2>
        <p>{L(locale, 'Export the full local ERP platform state into one portable ZIP, preview a backup before restore, and replace the current platform state only after explicit confirmation.', 'صدّر حالة النظام المحلية كاملة في ملف ZIP واحد، وافحص النسخة قبل الاستعادة، ولا يتم استبدال الحالة الحالية إلا بعد تأكيد صريح.')}</p>
      </div>
      <div className="v240-score">
        <span>{L(locale, 'Backed-up rows', 'صفوف قابلة للنسخ')}</span>
        <strong>{totalRows.toLocaleString()}</strong>
        <small>{Object.keys(counts).length} entity collection(s)</small>
      </div>
    </div>

    <div className="v240-grid">
      <Card title={L(locale, 'Full platform backup ZIP', 'نسخة احتياطية كاملة ZIP')} icon={<FileArchive/>} action={<button onClick={exportBackup} disabled={busy}><Download size={16}/>{L(locale, 'Download one ZIP', 'تحميل ZIP واحد')}</button>}>
        <div className="v240-kpi-grid">
          <KPI label={L(locale, 'Entities', 'الكيانات')} value={Object.keys(counts).length} hint={L(locale, 'Array-backed platform collections', 'مجموعات بيانات النظام')} icon={<Database/>}/>
          <KPI label={L(locale, 'Rows', 'الصفوف')} value={totalRows.toLocaleString()} hint={L(locale, 'Estimated local state rows', 'تقدير صفوف الحالة المحلية')} icon={<Archive/>}/>
          <KPI label={L(locale, 'Audit rows', 'سجلات التدقيق')} value={(Array.isArray(state?.audits) ? state.audits.length : 0).toLocaleString()} hint={L(locale, 'Included in backup', 'مضمنة في النسخة')} icon={<ShieldCheck/>}/>
          <KPI label={L(locale, 'Warnings', 'تنبيهات')} value={warnings.length} hint={warnings.length ? warnings[0] : L(locale, 'No local backup warning', 'لا توجد تنبيهات محلية')} icon={warnings.length ? <XCircle/> : <CheckCircle2/>}/>
        </div>
        <div className="notice">{L(locale, 'This ZIP contains manifest.json, erp-state.json, summary.json, audit-extract.json, and restore instructions. For real production Supabase later, keep scheduled database/storage backups too.', 'يحتوي ملف ZIP على manifest.json و erp-state.json و summary.json و audit-extract.json وتعليمات الاستعادة. عند الإنتاج الحقيقي على Supabase لاحقًا يجب الاحتفاظ أيضًا بنسخ قاعدة البيانات والتخزين المجدولة.')}</div>
      </Card>

      <Card title={L(locale, 'Restore from one backup file', 'الاستعادة من ملف واحد')} icon={<Upload/>} action={<button onClick={() => fileRef.current?.click()}><Upload size={16}/>{L(locale, 'Choose backup', 'اختيار نسخة')}</button>}>
        <input ref={fileRef} type="file" accept=".zip,.erpbackup,.json,application/zip,application/json" style={{ display: 'none' }} onChange={onFile}/>
        {!preview && <div className="notice">{L(locale, 'Upload a v381 ZIP backup or a legacy JSON state backup. The restore will show a preview before replacing current data.', 'ارفع نسخة v381 بصيغة ZIP أو نسخة JSON قديمة. ستظهر معاينة قبل استبدال البيانات الحالية.')}</div>}
        {busy && <div className="notice"><RefreshCw size={16}/>{L(locale, 'Reading backup file...', 'جاري قراءة ملف النسخة الاحتياطية...')}</div>}
        {preview && !preview.ok && <div className="notice danger">{preview.error}</div>}
        {preview?.ok && <div className="v240-grid compact">
          <div className="v240-kpi-grid">
            <KPI label={L(locale, 'Backup version', 'إصدار النسخة')} value={preview.manifest?.version ?? '—'} hint={preview.source} icon={<FileArchive/>}/>
            <KPI label={L(locale, 'Generated', 'تاريخ الإنشاء')} value={(preview.manifest?.generatedAt ?? '—').slice(0, 19)} hint={preview.manifest?.scope ?? 'full-platform'} icon={<Database/>}/>
            <KPI label={L(locale, 'Backup rows', 'صفوف النسخة')} value={Object.values(preview.manifest?.entityCounts ?? {}).reduce((s, v) => s + Number(v || 0), 0).toLocaleString()} hint={`${Object.keys(preview.manifest?.entityCounts ?? {}).length} collections`} icon={<Archive/>}/>
            <KPI label={L(locale, 'Hash', 'بصمة الملف')} value={(preview.manifest?.stateHash ?? '—').slice(0, 12)} hint={L(locale, 'Integrity evidence', 'دليل سلامة البيانات')} icon={<ShieldCheck/>}/>
          </div>
          {Boolean(preview.warnings.length) && <div className="notice danger">{preview.warnings.join(' · ')}</div>}
          <label className="field"><span>{L(locale, 'Confirmation', 'التأكيد')}</span><label className="check"><input type="checkbox" checked={confirmReplace} onChange={(e) => setConfirmReplace(e.target.checked)}/>{L(locale, 'I understand this will replace the current local platform state.', 'أفهم أن هذا سيستبدل حالة النظام المحلية الحالية.')}</label></label>
          <div className="button-row"><button className="danger" disabled={!confirmReplace} onClick={restore}><Upload size={16}/>{L(locale, 'Restore and replace current data', 'استعادة واستبدال البيانات الحالية')}</button><button onClick={() => { setPreview(null); setConfirmReplace(false); if (fileRef.current) fileRef.current.value = ''; }}><XCircle size={16}/>{L(locale, 'Cancel', 'إلغاء')}</button></div>
        </div>}
      </Card>

      <Card title={L(locale, 'Largest backed-up collections', 'أكبر مجموعات البيانات في النسخة')} icon={<Database/>}>
        <Table rows={topCounts}/>
      </Card>

      <Card title={L(locale, 'Production note', 'ملاحظة الإنتاج')} icon={<ShieldCheck/>}>
        <div className="notice">{L(locale, 'This page protects the current local/browser ERP state and is perfect for your testing phase. When you connect a real Supabase project, full production backup must also include database dumps, storage buckets, Edge Function secrets, and restore drills on staging.', 'هذه الصفحة تحمي حالة النظام المحلية/المتصفح الحالية وهي مناسبة جدًا لمرحلة الاختبار. عند ربط مشروع Supabase حقيقي، يجب أن تشمل النسخة الإنتاجية أيضًا نسخ قاعدة البيانات وملفات التخزين وأسرار Edge Functions وتجارب الاستعادة على بيئة اختبار.')}</div>
      </Card>
    </div>
  </div>;
}
