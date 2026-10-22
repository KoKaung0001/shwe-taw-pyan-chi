import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { buildRecordChecks, readinessDocumentIds } from '../domain/readiness';
import { useDemoStore } from '../store/demoStore';

export function ReadinessPage() {
  const { t } = useTranslation();
  const data = useDemoStore((state) => state.data);
  const setDocumentAvailable = useDemoStore(
    (state) => state.setReadinessDocument,
  );
  const checks = buildRecordChecks(data);
  const completedChecks = checks.filter((check) => check.complete).length;
  const completedDocuments = readinessDocumentIds.filter(
    (id) => data.checklist[id],
  ).length;
  const missingChecks = checks.filter((check) => !check.complete);

  return (
    <>
      <header className="page-heading">
        <h1 tabIndex={-1}>{t('readiness.title')}</h1>
      </header>

      <p className="mb-6 rounded-xl bg-[#edf3ec] p-4 text-sm text-muted">
        {t('readiness.disclaimer')}
      </p>

      <section className="rounded-3xl border border-[#dce4dc] bg-white p-5 sm:p-7">
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <div>
            <h2 className="text-xl font-semibold">
              {t('readiness.recordChecksTitle')}
            </h2>
          </div>
          <p className="text-sm font-semibold" role="status">
            {t('readiness.checkCount', {
              completed: completedChecks,
              total: checks.length,
            })}
          </p>
        </div>
        <ul className="mt-5 grid gap-3 sm:grid-cols-2">
          {checks.map(({ id, complete, values }) => (
            <li
              key={id}
              className="flex min-h-20 items-start gap-3 rounded-2xl bg-canvas p-4"
            >
              <span
                aria-hidden="true"
                className={`mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full text-sm font-bold ${complete ? 'bg-accent text-white' : 'border border-[#aebbb0] text-muted'}`}
              >
                {complete ? '✓' : '·'}
              </span>
              <div>
                <p className="font-medium">{t(`readiness.checks.${id}`)}</p>
                <p className={`mt-1 text-sm font-semibold ${complete ? 'text-green-800' : 'text-amber-800'}`}>{t(`readiness.status.${complete ? 'complete' : 'missing'}`, { defaultValue: complete ? 'Complete' : 'Missing' })}</p>
                <p className="mt-1 text-sm text-muted">
                  {values
                    ? t('readiness.categorizedCount', values)
                    : t(
                        `readiness.checkStatus.${complete ? 'complete' : 'missing'}`,
                      )}
                </p>
              </div>
            </li>
          ))}
        </ul>
        <p className="mt-5 rounded-xl bg-canvas p-4 text-sm text-muted">
          {missingChecks.length ? `${t('readiness.missingSummary', { defaultValue: 'Still missing:' })} ${missingChecks.map((check) => t(`readiness.checks.${check.id}`)).join(', ')}. ${t('readiness.nextStep', { defaultValue: 'Add or review records to update these checks.' })}` : t('readiness.allComplete', { defaultValue: 'All six readiness items are complete.' })}
        </p>
        <div className="mt-5 flex flex-wrap gap-3">
          <Link
            className="min-h-11 rounded-xl bg-accent px-4 py-2 text-sm font-semibold text-white"
            to="/add"
          >
            {t('readiness.addAction', { defaultValue: 'Add a record' })}
          </Link>
          <Link className="min-h-11 rounded-xl border border-[#bccbc0] px-4 py-2 text-sm font-semibold" to="/transactions">
            {t('readiness.transactionsAction')}
          </Link>
        </div>
      </section>

      <section className="mt-6 rounded-3xl border border-[#dce4dc] bg-white p-5 sm:p-7">
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <div>
            <h2 className="text-xl font-semibold">
              {t('readiness.documentsTitle')}
            </h2>
            <p className="mt-1 text-sm text-muted">
              {t('readiness.documentsHelp')}
            </p>
          </div>
          <p className="text-sm font-semibold">
            {t('readiness.checkCount', {
              completed: completedDocuments,
              total: readinessDocumentIds.length,
            })}
          </p>
        </div>
        <ul className="mt-4 divide-y divide-[#e4e9e2]">
          {readinessDocumentIds.map((id) => (
            <li key={id} className="py-3">
              <label className="flex min-h-11 items-center gap-3">
                <input
                  className="size-5 accent-[#176b4d]"
                  type="checkbox"
                  checked={Boolean(data.checklist[id])}
                  onChange={(event) =>
                    setDocumentAvailable(id, event.currentTarget.checked)
                  }
                />
                <span>{t(`readiness.documents.${id}`)}</span>
              </label>
            </li>
          ))}
        </ul>
      </section>
    </>
  );
}
