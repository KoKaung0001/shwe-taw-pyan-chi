import { forwardRef } from 'react';
import { useTranslation } from 'react-i18next';
import type { CreditReadiness } from '../domain/creditReadiness';

const money = (value: number) =>
  new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(value);

export const CreditReport = forwardRef<
  HTMLDivElement,
  {
    summary: CreditReadiness;
    applicantName: string;
    businessName: string;
  }
>(function CreditReport({ summary: s, applicantName, businessName }, ref) {
  const { t } = useTranslation();
  const bankName = t(`banks.${s.bank.id}.name`, { defaultValue: s.bank.name });
  return (
    <div ref={ref} className="credit-report" aria-hidden="true">
      <header className="credit-report-header">
        <span>SHWE TAW PYAN CHI</span>
        <span>{t('report.prepared', { date: s.today })}</span>
      </header>
      <h1>{t('report.title')}</h1>
      <p className="credit-report-subtitle">
        {t('report.subtitle', { bank: bankName })}
      </p>
      <div className="credit-report-identity">
        <div>
          <span>{t('report.applicant')}</span>
          <strong>{applicantName.trim() || t('report.notProvided')}</strong>
        </div>
        <div>
          <span>{t('report.business')}</span>
          <strong>{businessName.trim() || t('report.notProvided')}</strong>
        </div>
      </div>
      <section className="credit-report-progress">
        <div>
          <span>{t('report.documentPreparation')}</span>
          <strong>{s.percent}%</strong>
        </div>
        <p>
          {t('report.groupsPrepared', { completed: s.completed })}
        </p>
      </section>
      <div className="credit-report-section-heading">
        <h2>{t('report.recordedCashFlow')}</h2>
        <span>
          {s.startDate} to {s.today} • MMK
        </span>
      </div>
      <div className="credit-report-metrics">
        <div>
          <span>{t('report.income')}</span>
          <strong>{money(s.income)}</strong>
        </div>
        <div>
          <span>{t('report.expenses')}</span>
          <strong>{money(s.expenses)}</strong>
        </div>
        <div>
          <span>{t('report.netMovement')}</span>
          <strong>{money(s.net)}</strong>
        </div>
      </div>
      <table className="credit-report-table">
        <thead>
          <tr>
            <th>{t('report.month')}</th>
            <th>{t('report.records')}</th>
            <th>{t('report.incomeMmk')}</th>
            <th>{t('report.expensesMmk')}</th>
            <th>{t('report.netMmk')}</th>
          </tr>
        </thead>
        <tbody>
          {s.monthly.map((row) => (
            <tr key={row.month}>
              <td>{row.month}</td>
              <td>{row.count}</td>
              <td>{money(row.income)}</td>
              <td>{money(row.expenses)}</td>
              <td>{money(row.income - row.expenses)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="credit-report-section-heading">
        <h2>
          {bankName} {t('report.preparationChecklist')}
        </h2>
        <span>{t('report.summaryGroups')}</span>
      </div>
      <table className="credit-report-checklist">
        <tbody>
          {s.rows.map((row) => {
            const title = t(`banks.${s.bank.id}.requirements.${row.id}.title`, {
              defaultValue: row.title,
            });
            return (
            <tr key={row.id}>
              <td>{title}</td>
              <td>
                {row.declared
                  ? t('report.availableSelfReported')
                  : row.supporting
                    ? t('report.supportingReady')
                    : row.completion > 0
                      ? t('report.incompleteCoverage', { percent: Math.round(row.completion * 100) })
                      : t('report.incomplete')}
              </td>
            </tr>
            );
          })}
        </tbody>
      </table>
      <section className="credit-report-evidence">
        <h2>{t('report.evidenceCoverage')}</h2>
        <p>
          {t('report.settledEvidence', {
            records: s.recordCount,
            reviewed: s.reviewedImageCount,
            manual: s.manualCount,
            recurring: s.recurringCount,
            months: s.recentMonths,
          })}
        </p>
        <p>
          {t('report.historyEvidence', {
            history: s.bank.historyMonths,
            covered: s.coveredMonths,
            pending: s.pendingCount,
            unconfirmed: s.unconfirmedCount,
          })}
          {s.duplicateCount > 0
            ? t('report.duplicates', { count: s.duplicateCount })
            : ''}
        </p>
      </section>
      <footer className="credit-report-footer">
        <strong>
          {t('report.footerWarning')}
        </strong>
        <p>
          {t('report.footerNote')}
        </p>
        <p>
          {s.bank.id === 'abank'
            ? t('report.aBankReference')
            : `Checklist reference: ${s.bank.source}`}
        </p>
        <span>{t('report.preparedLocally')}</span>
      </footer>
    </div>
  );
});
