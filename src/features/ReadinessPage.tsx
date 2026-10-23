import { useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  ArrowUpRight,
  Check,
  CircleAlert,
  Download,
  FileCheck2,
  FileText,
  Landmark,
  ReceiptText,
  Upload,
} from 'lucide-react';
import { SlidingSelector } from '../components/SlidingSelector';
import { AnimatedDisclosure } from '../components/Motion';
import { CreditReport } from '../components/CreditReport';
import {
  bankChecklists,
  buildCreditReadiness,
  creditChecklistKey,
} from '../domain/creditReadiness';
import { clockForTimeZone } from '../services/clock';
import { useDemoStore } from '../store/demoStore';

const money = (value: number) =>
  new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(value);

export function ReadinessPage() {
  const { t } = useTranslation();
  const data = useDemoStore((state) => state.data);
  const timeZone = useDemoStore((state) => state.timeZone);
  const setProfile = useDemoStore((state) => state.setCreditProfile);
  const setDocumentAvailable = useDemoStore(
    (state) => state.setReadinessDocument,
  );
  const profile = data.creditProfile ?? {
    bankId: 'yoma' as const,
    applicantName: '',
    businessName: '',
  };
  const bank =
    bankChecklists.find((item) => item.id === profile.bankId) ??
    bankChecklists[1];
  const bankName = t(`banks.${bank.id}.name`, { defaultValue: bank.name });
  const bankSummary = t(`banks.${bank.id}.summary`, {
    defaultValue: bank.summary,
  });
  const bankSourceNote = t(`banks.${bank.id}.sourceNote`, {
    defaultValue: bank.sourceNote,
  });
  const summary = buildCreditReadiness(
    data,
    bank,
    clockForTimeZone(timeZone).today(),
  );
  const reportRef = useRef<HTMLDivElement>(null);
  const [exporting, setExporting] = useState(false);
  const [exportMessage, setExportMessage] = useState('');
  const [exportError, setExportError] = useState(false);

  async function exportReport() {
    if (!reportRef.current || exporting) return;
    setExporting(true);
    setExportMessage('');
    setExportError(false);
    try {
      const { downloadCreditReport } = await import('../services/creditReport');
      await downloadCreditReport(
        reportRef.current,
        `FlowCredit-${bank.id}-${summary.today}.pdf`,
      );
      setExportMessage(
        t('creditPage.exported'),
      );
    } catch {
      setExportError(true);
      setExportMessage(t('creditPage.exportError'));
    } finally {
      setExporting(false);
    }
  }

  return (
    <div className="credit-page">
      <header className="page-heading">
        <h1 tabIndex={-1}>{t('creditPage.title')}</h1>
        <p className="credit-page-intro">{t('creditPage.intro')}</p>
      </header>
      <section
        className="credit-bank-section"
        aria-labelledby="credit-bank-title"
      >
        <div className="credit-section-heading">
          <span className="credit-step">1</span>
          <div>
            <h2 id="credit-bank-title">{t('creditPage.chooseBank')}</h2>
            <p>{t('creditPage.chooseBankHelp')}</p>
          </div>
        </div>
        <SlidingSelector
          className="credit-bank-selector"
          selectionKey={bank.id}
          role="group"
          aria-label={t('creditPage.targetBank')}
        >
          {bankChecklists.map((item) => (
            <button
              type="button"
              key={item.id}
              aria-pressed={bank.id === item.id}
              disabled={exporting}
              onClick={() => {
                setProfile({ ...profile, bankId: item.id });
                setExportMessage('');
              }}
              className={
                bank.id === item.id
                  ? 'credit-bank-option is-selected'
                  : 'credit-bank-option'
              }
            >
              <span className="credit-bank-logo" aria-hidden="true">
                {item.abbreviation}
              </span>
                <strong>
                  {t(`banks.${item.id}.name`, { defaultValue: item.name })}
                </strong>
              {bank.id === item.id ? (
                <Check size={17} aria-hidden="true" />
              ) : (
                <Landmark size={17} aria-hidden="true" />
              )}
            </button>
          ))}
        </SlidingSelector>
      </section>
      <section
        className="credit-progress-card"
        aria-labelledby="credit-progress-title"
      >
        <div>
          <p id="credit-progress-title">{t('creditPage.documentPreparation')}</p>
          <strong className="credit-percent">
            {summary.percent}
            <span>{t('creditPage.ready')}</span>
          </strong>
          <p>
            {t('creditPage.groupsPrepared', {
              completed: summary.completed,
              bank: bankName,
            })}
          </p>
        </div>
        <div className="credit-progress-copy">
          <FileCheck2 size={26} aria-hidden="true" />
          <p>
            {summary.percent === 100
              ? t('creditPage.completeMessage')
              : t('creditPage.progressMessage')}
          </p>
        </div>
        <div
          className="credit-progress-track"
          role="progressbar"
          aria-label={t('creditPage.documentPreparation')}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={summary.percent}
        >
          <span style={{ width: `${summary.percent}%` }} />
        </div>
        <small>
          {t('creditPage.progressNote')}
        </small>
      </section>
      <div className="credit-content-grid">
        <section
          className="credit-checklist-panel"
          aria-labelledby="credit-checklist-title"
        >
          <div className="credit-section-heading">
            <span className="credit-step">2</span>
            <div>
              <h2 id="credit-checklist-title">
                {t('creditPage.checklist', { bank: bankName })}
              </h2>
              <p>{t('creditPage.checklistHelp')}</p>
            </div>
          </div>
          <ul className="credit-checklist" key={bank.id}>
            {summary.rows.map((row) => {
              const title = t(`banks.${bank.id}.requirements.${row.id}.title`, {
                defaultValue: row.title,
              });
              const detail = t(`banks.${bank.id}.requirements.${row.id}.detail`, {
                defaultValue: row.detail,
              });
              return (
                <li
                  key={row.id}
                  className={
                    row.complete
                      ? 'credit-requirement is-complete'
                      : 'credit-requirement'
                  }
                >
                <div className="credit-requirement-heading">
                  <span className="credit-status-icon" aria-hidden="true">
                    {row.complete ? (
                      <Check size={18} />
                    ) : (
                      <CircleAlert size={18} />
                    )}
                  </span>
                  <div>
                    <h3>{title}</h3>
                    <p>{detail}</p>
                  </div>
                </div>
                <div className="credit-requirement-bottom">
                  <label>
                    <input
                      type="checkbox"
                      disabled={exporting}
                      checked={row.declared}
                      onChange={(event) =>
                        setDocumentAvailable(
                          creditChecklistKey(bank.id, row.id),
                          event.currentTarget.checked,
                        )
                      }
                    />
                    <span>{t('creditPage.haveDocument', { document: title })}</span>
                  </label>
                  <span
                    className={`credit-status-label ${row.complete ? 'is-ready' : ''}`}
                  >
                    {row.declared
                      ? t('creditPage.availableSelfReported')
                      : row.supporting
                        ? t('creditPage.supportingReady')
                        : t('creditPage.incomplete')}
                  </span>
                </div>
                {row.match ? (
                  <div className="credit-match-note">
                    <ReceiptText size={15} aria-hidden="true" />
                    <span>
                      {row.match === 'financial'
                        ? t('creditPage.coverageMonths', { covered: summary.coveredMonths, history: bank.historyMonths })
                        : t('creditPage.receiptMonths', { covered: summary.voucherMonths })}
                      {row.supporting
                        ? t('creditPage.includedSummary')
                        : t('creditPage.addRecords')}
                    </span>
                  </div>
                ) : null}
                </li>
              );
            })}
          </ul>
          <p className="credit-checklist-note">
            {t('creditPage.checklistNote')}
          </p>
          <AnimatedDisclosure title={t('creditPage.sourcesScoring')}>
            <div className="credit-source-details">
              <p>{bankSourceNote}</p>
              {bank.source ? (
                <a href={bank.source} target="_blank" rel="noreferrer">
                  {t('creditPage.bankRequirements')}{' '}
                  <ArrowUpRight size={14} aria-hidden="true" />
                </a>
              ) : null}
              <p>
                Each of the six groups contributes equally. A declared document
                gives that group full preparation credit. Financial summaries
                earn progress from months with saved, settled records; voucher
                summaries use reviewed receipt / screenshot records. Month
                coverage does not establish complete or externally verified
                accounts.
              </p>
              <p>
                Pending, future and assumed unconfirmed payments are excluded
                from the financial summary.
              </p>
            </div>
          </AnimatedDisclosure>
        </section>
        <aside
          className="credit-evidence-panel"
          aria-label={t('creditPage.supportingEvidence')}
        >
          <div className="credit-evidence-heading">
            <span>
              <ReceiptText size={21} aria-hidden="true" />
            </span>
            <div>
              <h2>{t('creditPage.supportingEvidence')}</h2>
              <p>{t('creditPage.calculatedFromRecords')}</p>
            </div>
          </div>
          <p className="credit-evidence-summary">{bankSummary}</p>
          <div className="credit-money-stat">
            <span>{t('creditPage.recordedIncome')}</span>
            <strong>
              {money(summary.income)} <small>MMK</small>
            </strong>
          </div>
          <div className="credit-money-stat">
            <span>{t('creditPage.recordedExpenses')}</span>
            <strong>
              {money(summary.expenses)} <small>MMK</small>
            </strong>
          </div>
          <div className="credit-money-stat credit-net">
            <span>{t('creditPage.netMovement')}</span>
            <strong>
              {money(summary.net)} <small>MMK</small>
            </strong>
          </div>
          <p className="credit-date-range">
            {summary.startDate} – {summary.today}
          </p>
          <dl className="credit-evidence-counts">
            <div>
              <dt>{t('creditPage.settledRecords')}</dt>
              <dd>{summary.recordCount}</dd>
            </div>
            <div>
              <dt>{t('creditPage.reviewedReceipts')}</dt>
              <dd>{summary.reviewedImageCount}</dd>
            </div>
            <div>
              <dt>{t('creditPage.monthsWithRecords')}</dt>
              <dd>{summary.recentMonths} / 12</dd>
            </div>
          </dl>
          {summary.recordCount === 0 ? (
            <p className="credit-empty-evidence">
              {t('creditPage.emptyEvidence')}
            </p>
          ) : null}
          {summary.unconfirmedCount > 0 ? (
            <p className="credit-empty-evidence">
              {t('creditPage.unconfirmedEvidence', { count: summary.unconfirmedCount })}
            </p>
          ) : null}
          {summary.duplicateCount > 0 ? (
            <p className="credit-empty-evidence">
              {t('creditPage.duplicateEvidence', { count: summary.duplicateCount })}{' '}
              <Link to="/insights">{t('creditPage.review')}</Link>
            </p>
          ) : null}
          <Link className="credit-evidence-action" to="/capture">
            <Upload size={17} aria-hidden="true" /> {t('creditPage.addReceiptRecords')}
          </Link>
          <Link className="credit-records-link" to="/transactions">
            {t('creditPage.reviewAllRecords')} <ArrowUpRight size={15} aria-hidden="true" />
          </Link>
        </aside>
      </div>
      <section
        className="credit-export-panel"
        aria-labelledby="credit-export-title"
      >
        <div className="credit-section-heading">
          <span className="credit-step">3</span>
          <div>
            <h2 id="credit-export-title">{t('creditPage.applicationKit')}</h2>
            <p>{t('creditPage.applicationKitHelp')}</p>
          </div>
        </div>
        <div className="credit-profile-fields">
          <label>
            {t('creditPage.applicantName')} <span>({t('creditPage.optional')})</span>
            <input
              autoComplete="name"
              maxLength={100}
              disabled={exporting}
              value={profile.applicantName}
              onChange={(event) =>
                setProfile({ ...profile, applicantName: event.target.value })
              }
              placeholder={t('creditPage.yourNamePlaceholder')}
            />
          </label>
          <label>
            {t('creditPage.businessName')} <span>({t('creditPage.optional')})</span>
            <input
              autoComplete="organization"
              maxLength={100}
              disabled={exporting}
              value={profile.businessName}
              onChange={(event) =>
                setProfile({ ...profile, businessName: event.target.value })
              }
              placeholder={t('creditPage.yourBusinessPlaceholder')}
            />
          </label>
        </div>
        <div className="credit-export-bottom">
          <p>
            <FileText size={19} aria-hidden="true" />
            <span>
              {t('creditPage.onePagePdf', { bank: bankName })}
              <small>{t('creditPage.pdfNote')}</small>
            </span>
          </p>
          <button
            type="button"
            className="action-button credit-export-button"
            disabled={exporting}
            onClick={() => void exportReport()}
          >
            <Download size={18} aria-hidden="true" />
            {exporting ? t('creditPage.preparingPdf') : t('creditPage.export')}
          </button>
        </div>
        {exportMessage ? (
          <p
            className={
              exportError
                ? 'credit-export-message is-error'
                : 'credit-export-message'
            }
            role={exportError ? 'alert' : 'status'}
          >
            {exportMessage}
          </p>
        ) : null}
      </section>
      <CreditReport
        ref={reportRef}
        summary={summary}
        applicantName={profile.applicantName}
        businessName={profile.businessName}
      />
    </div>
  );
}
