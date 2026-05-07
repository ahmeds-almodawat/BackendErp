
import { useMemo, useState } from 'react';
import { CheckCircle2, Download, Play, ShieldAlert, Sparkles, Trash2 } from 'lucide-react';
import { V452_PILOT_STEPS, applyAllPilotSteps, applyPilotStep, pilotAutomationSnapshot, resetPilotAutomation } from '../engines/enterpriseV452PilotAutomationEngine';

type Locale = 'en' | 'ar';
type ToastType = 'success' | 'warning' | 'error';
function L(locale: Locale, en: string, ar: string) { return locale === 'ar' ? ar : en; }
function money(value: number, locale: Locale) { return new Intl.NumberFormat(locale === 'ar' ? 'ar-SA' : 'en-US', { style: 'currency', currency: 'SAR', maximumFractionDigits: 2 }).format(Number(value || 0)); }
function saveFile(fileName: string, content: string, mime = 'text/plain;charset=utf-8') { const blob = new Blob([content], { type: mime }); const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = fileName; a.click(); URL.revokeObjectURL(url); }
function rowsToCsv(rows: Array<Record<string, unknown>>) { if (!rows.length) return ''; const headers = Object.keys(rows[0]); const esc = (value: unknown) => { const text = String(value ?? ''); return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text; }; return [headers.join(','), ...rows.map((row) => headers.map((h) => esc(row[h])).join(','))].join('\n'); }
function Card({ title, children, action }: { title: string; children: React.ReactNode; action?: React.ReactNode }) { return <section className="card"><div className="card-header"><div className="card-title"><Sparkles size={18}/>{title}</div>{action}</div>{children}</section>; }
function Pill({ tone, children }: { tone: 'good' | 'warn' | 'info' | 'bad'; children: React.ReactNode }) { return <span className={`stock-pill ${tone}`}>{children}</span>; }

export default function EnterpriseV452PilotAutomationPage({ state, setState, locale, notify }: { state: any; setState: (state: any) => void; locale: Locale; notify: (type: ToastType, message: string) => void }) {
  const [lastResult, setLastResult] = useState<any>(null);
  const [confirmReset, setConfirmReset] = useState(false);
  const snapshot = useMemo(() => pilotAutomationSnapshot(state), [state]);
  const applied = new Set(snapshot.appliedSteps);
  const runStep = (stepKey: string) => { const result = applyPilotStep(state, stepKey); setLastResult(result); if (result.ok) { setState(result.state); notify('success', result.message); } else notify('error', result.message); };
  const runAll = () => { const result = applyAllPilotSteps(state); setLastResult(result); if (result.ok) { setState(result.state); notify('success', result.message); } else notify('error', result.message); };
  const reset = () => { if (!confirmReset) { setConfirmReset(true); notify('warning', L(locale, 'Click reset again to remove pilot-generated records.', 'اضغط مرة أخرى لحذف سجلات التجربة.')); return; } setState(resetPilotAutomation(state)); setConfirmReset(false); notify('success', L(locale, 'Pilot automation records removed.', 'تم حذف سجلات التجربة.')); };
  const exportEvidence = () => saveFile('pilot-automation-evidence-v452.json', JSON.stringify({ snapshot, lastResult, exportedAt: new Date().toISOString() }, null, 2), 'application/json;charset=utf-8');
  const exportSteps = () => saveFile('pilot-automation-steps-v452.csv', rowsToCsv(V452_PILOT_STEPS.map((s) => ({ ...s, applied: applied.has(s.key) }))), 'text/csv;charset=utf-8');
  return <div className="page-stack">
    <Card title={L(locale, 'Pilot Automation', 'أتمتة التجربة')} action={<div className="button-row"><button onClick={exportSteps}><Download size={16}/>{L(locale, 'Export steps', 'تصدير الخطوات')}</button><button onClick={exportEvidence}><Download size={16}/>{L(locale, 'Export evidence', 'تصدير الإثبات')}</button></div>}>
      <div className="notice warning"><ShieldAlert size={18}/>{L(locale, 'Safe local/demo mode: this simulates manual pilot entry with PILOT-* records. Do not use it as a production data loader.', 'وضع محلي/تجريبي آمن: يحاكي الإدخال اليدوي بسجلات PILOT-*. لا تستخدمه كمحمل بيانات إنتاج.')}</div>
      <div className="kpi-grid"><div className="kpi"><div className="kpi-icon"><CheckCircle2/></div><div><span>{L(locale, 'Progress', 'التقدم')}</span><strong>{snapshot.score}%</strong><small>{snapshot.appliedSteps.length} / {V452_PILOT_STEPS.length}</small></div></div><div className="kpi"><div className="kpi-icon"><Sparkles/></div><div><span>{L(locale, 'Journals', 'القيود')}</span><strong>{snapshot.counts.journals}</strong><small>{L(locale, 'posted evidence', 'إثبات ترحيل')}</small></div></div><div className="kpi"><div className="kpi-icon"><Sparkles/></div><div><span>{L(locale, 'Stock moves', 'حركات المخزون')}</span><strong>{snapshot.counts.stockMovements}</strong><small>{L(locale, 'inventory evidence', 'إثبات المخزون')}</small></div></div><div className="kpi"><div className="kpi-icon"><Sparkles/></div><div><span>{L(locale, 'GL difference', 'فرق القيود')}</span><strong>{money(snapshot.journalDifference, locale)}</strong><small>{L(locale, 'debit-credit', 'مدين-دائن')}</small></div></div></div>
      <div className="button-row"><button onClick={runAll}><Play size={16}/>{L(locale, 'Run full pilot automatically', 'تشغيل التجربة بالكامل')}</button><button className="danger" onClick={reset}><Trash2 size={16}/>{confirmReset ? L(locale, 'Confirm reset', 'تأكيد الحذف') : L(locale, 'Reset pilot data', 'حذف بيانات التجربة')}</button></div>
    </Card>
    <Card title={L(locale, 'Step-by-step simulation', 'محاكاة خطوة بخطوة')}>
      <div className="table-wrap"><table><thead><tr><th>#</th><th>{L(locale, 'Step', 'الخطوة')}</th><th>{L(locale, 'Module', 'الموديول')}</th><th>{L(locale, 'Effect', 'الأثر')}</th><th>{L(locale, 'Status', 'الحالة')}</th><th>{L(locale, 'Action', 'الإجراء')}</th></tr></thead><tbody>{V452_PILOT_STEPS.map((step) => <tr key={step.key}><td>{step.sequence}</td><td><strong>{step.title}</strong><br/><small>{step.safety}</small></td><td>{step.module}</td><td>{step.effect}</td><td>{applied.has(step.key) ? <Pill tone="good">{L(locale, 'Applied', 'مطبقة')}</Pill> : <Pill tone="info">{L(locale, 'Ready', 'جاهزة')}</Pill>}</td><td><button onClick={() => runStep(step.key)}><Play size={14}/>{L(locale, 'Apply', 'تطبيق')}</button></td></tr>)}</tbody></table></div>
    </Card>
    {lastResult && <Card title={L(locale, 'Last result', 'آخر نتيجة')}><div className={`notice ${lastResult.ok ? '' : 'warning'}`}>{lastResult.message}</div><pre className="code-block">{JSON.stringify({ ok: lastResult.ok, stepKey: lastResult.stepKey, proof: lastResult.proof, warnings: lastResult.warnings }, null, 2)}</pre></Card>}
  </div>;
}
