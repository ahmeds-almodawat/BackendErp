import React, { useMemo, useState } from 'react';
import {
  buildV451PilotScenarioPack,
  exportV451PackJson,
  exportV451ReconciliationCsv,
  exportV451ScenarioCsv,
  type V451Locale,
} from '../engines/enterpriseV451PilotScenarioEngine';

type Notify = (message: string, type?: 'success' | 'error' | 'info') => void;

interface EnterpriseV451PilotScenarioPageProps {
  locale?: V451Locale;
  notify?: Notify;
}

const L = (locale: V451Locale, en: string, ar: string) => (locale === 'ar' ? ar : en);

function downloadText(filename: string, content: string, mimeType: string) {
  const blob = new Blob([content], { type: `${mimeType};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

export default function EnterpriseV451PilotScenarioPage({
  locale = 'en',
  notify,
}: EnterpriseV451PilotScenarioPageProps) {
  const pack = useMemo(() => buildV451PilotScenarioPack(locale), [locale]);
  const [activeStepId, setActiveStepId] = useState(pack.steps[0]?.id ?? '');
  const activeStep = pack.steps.find((step) => step.id === activeStepId) ?? pack.steps[0];

  const criticalChecks = pack.reconciliationChecks.filter((check) => check.severity === 'critical').length;
  const warningChecks = pack.reconciliationChecks.filter((check) => check.severity === 'warning').length;

  const onExport = (kind: 'scenario' | 'reconciliation' | 'json') => {
    if (kind === 'scenario') {
      downloadText('v451-pilot-scenario-steps.csv', exportV451ScenarioCsv(pack), 'text/csv');
    } else if (kind === 'reconciliation') {
      downloadText('v451-pilot-reconciliation-checks.csv', exportV451ReconciliationCsv(pack), 'text/csv');
    } else {
      downloadText('v451-real-pilot-scenario-pack.json', exportV451PackJson(pack), 'application/json');
    }
    notify?.(L(locale, 'Pilot scenario evidence exported.', 'تم تصدير أدلة سيناريو التشغيل.'), 'success');
  };

  return (
    <div className="module-page pilot-scenario-page">
      <section className="hero-card">
        <div>
          <span className="eyebrow">v451</span>
          <h2>{pack.title}</h2>
          <p>{pack.subtitle}</p>
        </div>
        <div className="hero-actions">
          <button onClick={() => onExport('scenario')}>{L(locale, 'Export steps CSV', 'تصدير الخطوات CSV')}</button>
          <button onClick={() => onExport('reconciliation')}>{L(locale, 'Export checks CSV', 'تصدير الفحوصات CSV')}</button>
          <button onClick={() => onExport('json')}>{L(locale, 'Export full pack JSON', 'تصدير الحزمة JSON')}</button>
        </div>
      </section>

      <section className="kpi-grid">
        <article className="kpi-card">
          <span>{L(locale, 'Readiness target', 'مؤشر الجاهزية')}</span>
          <strong>{pack.readinessScore}%</strong>
          <p>{L(locale, 'Pilot can start after QA, reset, and build pass.', 'يمكن بدء التشغيل التجريبي بعد نجاح الفحص وإعادة ضبط قاعدة البيانات والبناء.')}</p>
        </article>
        <article className="kpi-card">
          <span>{L(locale, 'Scenario steps', 'خطوات السيناريو')}</span>
          <strong>{pack.steps.length}</strong>
          <p>{L(locale, 'One-month flow from opening balances to close.', 'تدفق شهر كامل من الأرصدة الافتتاحية حتى الإقفال.')}</p>
        </article>
        <article className="kpi-card">
          <span>{L(locale, 'Critical checks', 'الفحوصات الحرجة')}</span>
          <strong>{criticalChecks}</strong>
          <p>{L(locale, 'Must pass before staging sign-off.', 'يجب نجاحها قبل اعتماد بيئة الاختبار.')}</p>
        </article>
        <article className="kpi-card">
          <span>{L(locale, 'Warnings', 'تنبيهات')}</span>
          <strong>{warningChecks}</strong>
          <p>{L(locale, 'Operational evidence recommended before pilot.', 'أدلة تشغيلية موصى بها قبل التجربة.')}</p>
        </article>
      </section>

      <section className="content-grid two">
        <article className="panel-card">
          <div className="panel-header">
            <div>
              <span className="eyebrow">{L(locale, 'Seed data', 'بيانات التشغيل التجريبي')}</span>
              <h3>{L(locale, 'Pilot data pack', 'حزمة بيانات التجربة')}</h3>
            </div>
          </div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>{L(locale, 'Category', 'الفئة')}</th>
                  <th>{L(locale, 'Count', 'العدد')}</th>
                  <th>{L(locale, 'Purpose', 'الهدف')}</th>
                </tr>
              </thead>
              <tbody>
                {pack.entities.map((entity) => (
                  <tr key={entity.category}>
                    <td>
                      <strong>{entity.category}</strong>
                      <small>{entity.examples.join(' · ')}</small>
                    </td>
                    <td>{entity.count}</td>
                    <td>{entity.purpose}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </article>

        <article className="panel-card">
          <div className="panel-header">
            <div>
              <span className="eyebrow">{L(locale, 'Go / No-Go', 'قرار الإطلاق')}</span>
              <h3>{L(locale, 'Non-negotiable rules', 'قواعد لا تقبل التنازل')}</h3>
            </div>
          </div>
          <div className="stack-list">
            {pack.goNoGoRules.map((rule) => (
              <div className="stack-item critical" key={rule}>
                <strong>{rule}</strong>
              </div>
            ))}
          </div>
        </article>
      </section>

      <section className="content-grid two">
        <article className="panel-card">
          <div className="panel-header">
            <div>
              <span className="eyebrow">{L(locale, 'Execution', 'التنفيذ')}</span>
              <h3>{L(locale, 'Scenario runbook', 'دليل تشغيل السيناريو')}</h3>
            </div>
          </div>
          <div className="scenario-list">
            {pack.steps.map((step) => (
              <button
                className={`scenario-step ${activeStep?.id === step.id ? 'active' : ''}`}
                key={step.id}
                onClick={() => setActiveStepId(step.id)}
              >
                <span>{String(step.sequence).padStart(2, '0')}</span>
                <div>
                  <strong>{step.title}</strong>
                  <small>{step.module} · {step.actor}</small>
                </div>
              </button>
            ))}
          </div>
        </article>

        <article className="panel-card">
          {activeStep ? (
            <>
              <div className="panel-header">
                <div>
                  <span className="eyebrow">{activeStep.module}</span>
                  <h3>{activeStep.title}</h3>
                </div>
              </div>
              <p className="muted">{activeStep.input}</p>
              <div className="mini-grid">
                <div>
                  <h4>{L(locale, 'Backend proof', 'دليل الخلفية')}</h4>
                  <ul>{activeStep.expectedBackendProof.map((item) => <li key={item}>{item}</li>)}</ul>
                </div>
                <div>
                  <h4>{L(locale, 'Reports to verify', 'التقارير للتحقق')}</h4>
                  <ul>{activeStep.expectedReports.map((item) => <li key={item}>{item}</li>)}</ul>
                </div>
              </div>
              <h4>{L(locale, 'Pass criteria', 'معايير النجاح')}</h4>
              <ul>{activeStep.passCriteria.map((item) => <li key={item}>{item}</li>)}</ul>
              <div className="alert-card warning">
                <strong>{L(locale, 'Risk if failed', 'المخاطر عند الفشل')}</strong>
                <p>{activeStep.riskIfFailed}</p>
              </div>
            </>
          ) : null}
        </article>
      </section>

      <section className="panel-card">
        <div className="panel-header">
          <div>
            <span className="eyebrow">{L(locale, 'Reconciliation', 'المطابقة')}</span>
            <h3>{L(locale, 'Report truth checks', 'فحوصات موثوقية التقارير')}</h3>
          </div>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>{L(locale, 'Area', 'المجال')}</th>
                <th>{L(locale, 'Severity', 'الأهمية')}</th>
                <th>{L(locale, 'Check', 'الفحص')}</th>
                <th>{L(locale, 'Expected result', 'النتيجة المتوقعة')}</th>
                <th>{L(locale, 'Evidence', 'الدليل')}</th>
              </tr>
            </thead>
            <tbody>
              {pack.reconciliationChecks.map((check) => (
                <tr key={check.id}>
                  <td>{check.area}</td>
                  <td><span className={`pill ${check.severity}`}>{check.severity}</span></td>
                  <td>{check.check}</td>
                  <td>{check.expectedResult}</td>
                  <td>{check.evidenceSource}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="content-grid two">
        <article className="panel-card">
          <div className="panel-header">
            <div>
              <span className="eyebrow">{L(locale, 'Operator checklist', 'قائمة المشغل')}</span>
              <h3>{L(locale, 'Before pilot run', 'قبل تشغيل التجربة')}</h3>
            </div>
          </div>
          <div className="stack-list">
            {pack.operatorChecklist.map((item) => (
              <label className="check-row" key={item}>
                <input type="checkbox" />
                <span>{item}</span>
              </label>
            ))}
          </div>
        </article>

        <article className="panel-card">
          <div className="panel-header">
            <div>
              <span className="eyebrow">{L(locale, 'Next actions', 'الخطوات التالية')}</span>
              <h3>{L(locale, 'How to use this pack', 'طريقة استخدام الحزمة')}</h3>
            </div>
          </div>
          <div className="stack-list">
            {pack.nextActions.map((item) => (
              <div className="stack-item" key={item}>{item}</div>
            ))}
          </div>
        </article>
      </section>
    </div>
  );
}
