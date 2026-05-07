import { useMemo } from 'react';
import { AlertTriangle, ClipboardCheck, Download, PackageCheck, RefreshCw, ShoppingCart, Store } from 'lucide-react';
import { buildRestaurantOpsSnapshot, restaurantOpsCsv, type RestaurantOpsTone } from '../engines/enterpriseV456V470RestaurantOpsEngine';

type Locale = 'en' | 'ar';

function L(locale: Locale, en: string, ar: string) {
  return locale === 'ar' ? ar : en;
}

function toneClass(tone: RestaurantOpsTone) {
  if (tone === 'good') return 'success';
  if (tone === 'bad') return 'danger';
  if (tone === 'warn') return 'warning';
  return '';
}

function downloadText(filename: string, content: string, mime = 'text/plain;charset=utf-8') {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

function MiniCard({ label, value, hint }: { label: string; value: string | number; hint: string }) {
  return <div className="kpi compact"><div><span>{label}</span><strong>{value}</strong><small>{hint}</small></div></div>;
}

export default function EnterpriseV456V470RestaurantOpsPage({ state, locale = 'en', notify }: { state: any; locale?: Locale; notify?: (type: 'success' | 'warning' | 'error', message: string) => void }) {
  const snapshot = useMemo(() => buildRestaurantOpsSnapshot(state, locale), [state, locale]);
  const statusLabel = snapshot.status === 'ready-for-pilot'
    ? L(locale, 'Ready for pilot', 'جاهز للتجربة')
    : snapshot.status === 'needs-review'
      ? L(locale, 'Needs manager review', 'يحتاج مراجعة المدير')
      : L(locale, 'Blocked', 'متوقف');

  const exportCsv = () => {
    downloadText('restaurant-workflow-evidence-v456-v470.csv', restaurantOpsCsv(snapshot), 'text/csv;charset=utf-8');
    notify?.('success', L(locale, 'Restaurant workflow evidence exported.', 'تم تصدير إثبات دورة التشغيل.'));
  };

  return <div className="page-grid">
    <section className="card hero-card">
      <div className="card-header">
        <div className="card-title"><Store />{L(locale, 'Restaurant Operations Flow', 'دورة تشغيل المطعم')}</div>
        <button onClick={exportCsv}><Download size={16}/>{L(locale, 'Export Evidence', 'تصدير الإثبات')}</button>
      </div>
      <div className="hero-content">
        <div>
          <span className="eyebrow">v456-v470</span>
          <h2>{L(locale, 'Material request to fulfillment control', 'التحكم من طلب المواد إلى الصرف')}</h2>
          <p>{L(locale, 'This page checks whether restaurant material requests end correctly as reservation, store transfer, internal issue, or supplier-specific shortage PO.', 'تتحقق هذه الصفحة من انتهاء طلبات المواد بشكل صحيح كحجز أو تحويل مخزني أو صرف داخلي أو أمر شراء للنقص حسب المورد.')}</p>
        </div>
        <div className={`status-pill ${snapshot.status === 'blocked' ? 'danger' : snapshot.status === 'needs-review' ? 'warning' : 'success'}`}>{statusLabel}</div>
      </div>
      <div className="kpi-grid">
        <MiniCard label={L(locale, 'Workflow score', 'درجة الدورة')} value={`${snapshot.score}%`} hint={snapshot.headline} />
        <MiniCard label={L(locale, 'Open decisions', 'قرارات مفتوحة')} value={snapshot.decisions.length} hint={L(locale, 'Request lines under review', 'بنود طلبات قيد المراجعة')} />
        <MiniCard label={L(locale, 'Supplier split POs', 'أوامر حسب المورد')} value={snapshot.supplierSplits.length} hint={L(locale, 'Suggested shortage PO groups', 'مجموعات أوامر النقص المقترحة')} />
        <MiniCard label={L(locale, 'Batch controls', 'رقابة الدفعات')} value={snapshot.batchControls.length} hint={L(locale, 'FEFO / expiry checks', 'فحص FEFO والانتهاء')} />
      </div>
    </section>

    <section className="card">
      <div className="card-header"><div className="card-title"><ClipboardCheck />{L(locale, 'Material request decisions', 'قرارات طلب المواد')}</div></div>
      <div className="table-wrap"><table><thead><tr>
        <th>{L(locale, 'Request', 'الطلب')}</th><th>{L(locale, 'Item', 'الصنف')}</th><th>{L(locale, 'Requested', 'المطلوب')}</th><th>{L(locale, 'Free stock', 'المتاح')}</th><th>{L(locale, 'Reserve', 'الحجز')}</th><th>{L(locale, 'Shortage', 'النقص')}</th><th>{L(locale, 'Decision', 'القرار')}</th><th>{L(locale, 'Supplier', 'المورد')}</th>
      </tr></thead><tbody>{snapshot.decisions.length ? snapshot.decisions.map((d, i) => <tr key={`${d.requestRef}-${i}`}>
        <td>{d.requestRef}</td><td>{d.itemName}</td><td>{d.requestedQty.toLocaleString()}</td><td>{d.freeQty.toLocaleString()}</td><td>{d.reserveQty.toLocaleString()}</td><td>{d.shortageQty.toLocaleString()}</td><td><span className="status-pill">{d.recommendedAction}</span></td><td>{d.supplierHint}</td>
      </tr>) : <tr><td colSpan={8}>{L(locale, 'No open request decisions detected.', 'لا توجد قرارات طلبات مفتوحة.')}</td></tr>}</tbody></table></div>
    </section>

    <section className="card">
      <div className="card-header"><div className="card-title"><ShoppingCart />{L(locale, 'Supplier split plan', 'خطة تقسيم الموردين')}</div></div>
      <div className="table-wrap"><table><thead><tr><th>{L(locale, 'Supplier', 'المورد')}</th><th>{L(locale, 'Lines', 'البنود')}</th><th>{L(locale, 'Estimated value', 'القيمة التقديرية')}</th><th>{L(locale, 'PO rule', 'قاعدة أمر الشراء')}</th></tr></thead><tbody>
        {snapshot.supplierSplits.length ? snapshot.supplierSplits.map((group) => <tr key={group.supplierId}><td>{group.supplierName}</td><td>{group.lines.map((l) => `${l.itemName}: ${l.shortageQty}`).join(' · ')}</td><td>{group.estimatedValue.toLocaleString(undefined, { maximumFractionDigits: 2 })}</td><td>{L(locale, 'Create one PO for this supplier only.', 'إنشاء أمر شراء واحد لهذا المورد فقط.')}</td></tr>) : <tr><td colSpan={4}>{L(locale, 'No shortage supplier split needed.', 'لا يوجد نقص يحتاج تقسيم الموردين.')}</td></tr>}
      </tbody></table></div>
    </section>

    <section className="card">
      <div className="card-header"><div className="card-title"><PackageCheck />{L(locale, 'Batch No. / FEFO controls', 'رقم الدفعة / رقابة FEFO')}</div></div>
      <div className="finding-list">{snapshot.batchControls.map((f, i) => <div key={i} className={`finding ${toneClass(f.tone)}`}><strong>{f.title}</strong><p>{f.detail}</p><small>{f.action}</small></div>)}</div>
    </section>

    <section className="card">
      <div className="card-header"><div className="card-title"><RefreshCw />{L(locale, 'End-to-end cycle', 'الدورة الكاملة')}</div></div>
      <div className="table-wrap"><table><thead><tr><th>#</th><th>{L(locale, 'Step', 'الخطوة')}</th><th>{L(locale, 'Owner', 'المسؤول')}</th><th>{L(locale, 'Outcome', 'النتيجة')}</th><th>{L(locale, 'Proof', 'الإثبات')}</th></tr></thead><tbody>{snapshot.cycle.map((step, index) => <tr key={step.step}><td>{index + 1}</td><td>{step.step}</td><td>{step.owner}</td><td>{step.outcome}</td><td>{step.proof}</td></tr>)}</tbody></table></div>
    </section>

    <section className="card">
      <div className="card-header"><div className="card-title"><AlertTriangle />{L(locale, 'Findings and next actions', 'الملاحظات والإجراءات التالية')}</div></div>
      <div className="finding-list">{snapshot.findings.map((f, i) => <div key={i} className={`finding ${toneClass(f.tone)}`}><span className="eyebrow">{f.area}</span><strong>{f.title}</strong><p>{f.detail}</p><small>{f.action}</small></div>)}</div>
    </section>
  </div>;
}
