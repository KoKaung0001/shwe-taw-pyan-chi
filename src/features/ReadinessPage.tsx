import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Check,
  CircleAlert,
  Download,
  FileCheck2,
  Landmark,
} from 'lucide-react';
import {
  evaluateBankReadiness,
  readinessBanks,
  type ReadinessBankId,
} from '../domain/creditReadiness';
import { clockForTimeZone } from '../services/clock';
import { downloadReadinessPdf } from '../services/readinessPdf';
import { useDemoStore } from '../store/demoStore';

const formatMoney = (amount: number) => `${amount.toLocaleString('en-US')} MMK`;

export function ReadinessPage() {
  const { t } = useTranslation();
  const [bankId, setBankId] = useState<ReadinessBankId>('a_bank');
  const data = useDemoStore((state) => state.data);
  const timeZone = useDemoStore((state) => state.timeZone);
  const setBankDocument = useDemoStore(
    (state) => state.setBankReadinessDocument,
  );
  const today = clockForTimeZone(timeZone).today();
  const evaluation = evaluateBankReadiness(data, bankId, today);
  const score = evaluation.flowScore;

  return (
    <>
      <header className="page-heading">
        <h1 tabIndex={-1}>
          {t('readiness.title', { defaultValue: 'Credit readiness' })}
        </h1>
        <p className="mt-2 max-w-3xl text-sm text-muted">
          {t('readiness.description', {
            defaultValue:
              'Choose a bank to see how your existing records match its example requirements.',
          })}
        </p>
      </header>

      <p className="mb-6 rounded-2xl border border-[#e7dcb8] bg-[#fff9e9] p-4 text-sm text-[#654f20]">
        {t('readiness.disclaimer', {
          defaultValue:
            'These bank requirements are user-provided examples and have not been confirmed by the lenders. FlowScore is an app-only cash-flow indicator, not a bank score or loan approval prediction.',
        })}
      </p>

      <section
        aria-labelledby="readiness-bank-title"
        className="rounded-3xl border border-[#dce4ee] bg-white p-5 sm:p-7"
      >
        <div className="mb-4">
          <h2 id="readiness-bank-title" className="text-xl font-semibold">
            {t('readiness.chooseBank', {
              defaultValue: '1. Choose a target bank',
            })}
          </h2>
          <p className="mt-1 text-sm text-muted">
            {t('readiness.chooseBankHelp', {
              defaultValue:
                'Select one of the example bank profiles to review its checklist.',
            })}
          </p>
        </div>
        <div
          className="grid gap-3 sm:grid-cols-3"
          role="group"
          aria-label={t('readiness.bankOptions', {
            defaultValue: 'Target bank',
          })}
        >
          {readinessBanks.map((bank) => {
            const selected = bank.id === bankId;
            return (
              <button
                key={bank.id}
                type="button"
                aria-pressed={selected}
                onClick={() => setBankId(bank.id)}
                className={`flex min-h-20 items-start gap-3 rounded-2xl border p-4 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 ${selected ? 'border-accent bg-[#f0efff]' : 'border-[#dce4ee] bg-white hover:bg-canvas'}`}
              >
                <Landmark
                  aria-hidden="true"
                  className={`mt-0.5 size-5 shrink-0 ${selected ? 'text-accent' : 'text-muted'}`}
                />
                <span className="min-w-0">
                  <span className="block font-semibold">{bank.name}</span>
                  <span className="mt-1 block text-sm text-muted">
                    {bank.subtitle}
                  </span>
                </span>
              </button>
            );
          })}
        </div>
      </section>

      <section
        aria-labelledby="readiness-checklist-title"
        className="mt-5 rounded-3xl border border-[#dce4ee] bg-white p-5 sm:p-7"
      >
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-sm font-semibold text-accent">
              {t('readiness.stepTwo', { defaultValue: '2. Review checklist' })}
            </p>
            <h2
              id="readiness-checklist-title"
              className="mt-1 text-xl font-semibold"
            >
              {evaluation.bank.name} requirements
            </h2>
            <p className="mt-1 text-sm text-muted">
              {evaluation.bank.subtitle}
            </p>
          </div>
          <div className="min-w-36 text-right" role="status" aria-live="polite">
            <p className="text-2xl font-semibold tabular-nums">
              {evaluation.completionPercent}%
            </p>
            <p className="text-sm text-muted">
              {t('readiness.checklistReady', {
                defaultValue: 'checklist ready',
              })}
            </p>
          </div>
        </div>
        <div
          className="mt-4 h-2.5 overflow-hidden rounded-full bg-canvas"
          role="progressbar"
          aria-label={t('readiness.checklistProgress', {
            defaultValue: 'Bank checklist completion',
          })}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={evaluation.completionPercent}
        >
          <div
            className="h-full rounded-full bg-accent transition-[width]"
            style={{ width: `${evaluation.completionPercent}%` }}
          />
        </div>

        <ul className="mt-5 divide-y divide-[#e5eaf1]">
          {evaluation.requirements.map((requirement, index) => {
            const isManual = requirement.proof === 'self_reported';
            const complete = requirement.status !== 'incomplete';
            const statusLabel =
              requirement.status === 'self_reported'
                ? t('readiness.userReported', {
                    defaultValue: 'You marked this available',
                  })
                : requirement.status === 'app_alternative'
                  ? t('readiness.appAlternativeAvailable', {
                      defaultValue: 'App-generated alternative available',
                    })
                  : t('readiness.incomplete', { defaultValue: 'Incomplete' });
            return (
              <li
                key={`${requirement.id}-${index}`}
                className="flex flex-wrap items-start justify-between gap-3 py-4"
              >
                <div className="flex min-w-0 flex-1 items-start gap-3">
                  <span
                    aria-hidden="true"
                    className={`mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full ${complete ? 'bg-[#e9f5ee] text-[#157347]' : 'bg-[#fff4df] text-[#8b5c08]'}`}
                  >
                    {complete ? (
                      <Check className="size-4" />
                    ) : (
                      <CircleAlert className="size-4" />
                    )}
                  </span>
                  <div className="min-w-0">
                    <p className="font-semibold">{requirement.title}</p>
                    <p className="mt-1 text-sm text-muted">
                      {requirement.detail}
                    </p>
                    <p
                      className={`mt-2 text-sm font-medium ${complete ? 'text-[#17643c]' : 'text-[#80560b]'}`}
                    >
                      {statusLabel}
                    </p>
                    {requirement.proof !== 'self_reported' &&
                      requirement.proof !== 'flow_score' &&
                      requirement.status === 'incomplete' && (
                        <p className="mt-1 text-xs text-muted">
                          {t('readiness.monthCoverage', {
                            defaultValue:
                              'Settled records currently cover {{months}} of 12 months.',
                            months: evaluation.summary.activeMonths,
                          })}
                        </p>
                      )}
                    {requirement.status === 'app_alternative' && (
                      <p className="mt-1 text-xs text-muted">
                        {t('readiness.lenderAcceptance', {
                          defaultValue: 'Lender acceptance is not confirmed.',
                        })}
                      </p>
                    )}
                  </div>
                </div>
                {isManual && requirement.checklistKey && (
                  <label className="flex min-h-11 shrink-0 items-center gap-2 rounded-xl px-2 text-sm font-medium hover:bg-canvas">
                    <input
                      className="size-5 accent-[#3158d5]"
                      type="checkbox"
                      checked={Boolean(
                        data.checklist[requirement.checklistKey],
                      )}
                      onChange={(event) =>
                        setBankDocument(
                          bankId,
                          requirement.id,
                          event.currentTarget.checked,
                        )
                      }
                      aria-label={t('readiness.documentAvailable', {
                        defaultValue: 'I have this document: {{name}}',
                        name: requirement.title,
                      })}
                    />
                    <span>
                      {t('readiness.available', { defaultValue: 'Available' })}
                    </span>
                  </label>
                )}
              </li>
            );
          })}
        </ul>
        <p className="mt-4 rounded-xl bg-canvas p-4 text-sm text-muted">
          {t('readiness.selfReportedHelp', {
            defaultValue:
              'Checked documents are self-reported. No document files are uploaded or stored.',
          })}
        </p>
      </section>

      <section
        aria-labelledby="flow-score-title"
        className="mt-5 rounded-3xl border border-[#dce4ee] bg-white p-5 sm:p-7"
      >
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 id="flow-score-title" className="text-xl font-semibold">
              {t('readiness.flowScoreTitle', {
                defaultValue: 'App-only FlowScore',
              })}
            </h2>
            <p className="mt-1 max-w-3xl text-sm text-muted">
              {t('readiness.flowScoreHelp', {
                defaultValue:
                  'A transparent cash-flow indicator based on your last 12 months of settled records. It is not a bank score or approval likelihood.',
              })}
            </p>
          </div>
          <div className="rounded-2xl bg-[#f0efff] px-4 py-3 text-center">
            <p className="text-3xl font-semibold tabular-nums">
              {score.score === null ? '—' : score.score}
            </p>
            <p className="text-xs text-muted">
              {score.score === null
                ? t('readiness.scoreUnavailable', {
                    defaultValue: 'Not enough history',
                  })
                : t('readiness.outOfHundred', { defaultValue: 'out of 100' })}
            </p>
          </div>
        </div>
        {score.score === null && (
          <p
            className="mt-4 rounded-xl bg-canvas p-3 text-sm text-muted"
            role="status"
          >
            {t('readiness.scoreNeedsMonths', {
              defaultValue:
                'A FlowScore appears after settled records span at least 6 distinct months. Current coverage: {{active}} of 12 months.',
              active: score.activeMonths,
            })}
          </p>
        )}
        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          {(
            [
              [
                'historyCoverage',
                t('readiness.components.historyCoverage', {
                  defaultValue: 'History coverage',
                }),
              ],
              [
                'incomeConsistency',
                t('readiness.components.incomeConsistency', {
                  defaultValue: 'Monthly income consistency',
                }),
              ],
              [
                'netCashFlowStability',
                t('readiness.components.netCashFlowStability', {
                  defaultValue: 'Net cash-flow stability',
                }),
              ],
              [
                'reviewedReceiptEvidence',
                t('readiness.components.reviewedReceiptEvidence', {
                  defaultValue: 'Reviewed receipt evidence',
                }),
              ],
            ] as const
          ).map(([key, label]) => (
            <div key={key}>
              <div className="mb-1 flex justify-between gap-3 text-sm">
                <span>{label}</span>
                <span className="tabular-nums text-muted">
                  {score.components[key]}%
                </span>
              </div>
              <div
                className="h-2 overflow-hidden rounded-full bg-canvas"
                aria-hidden="true"
              >
                <div
                  className="h-full rounded-full bg-accent"
                  style={{ width: `${score.components[key]}%` }}
                />
              </div>
            </div>
          ))}
        </div>
        <p className="mt-4 text-sm text-muted">
          {t('readiness.receiptCoverage', {
            defaultValue:
              'Receipt evidence: {{reviewed}} reviewed of {{total}} settled receipt or screenshot records.',
            reviewed: evaluation.summary.reviewedReceiptCount,
            total: evaluation.summary.receiptEvidenceCount,
          })}
        </p>
      </section>

      <section
        aria-labelledby="readiness-summary-title"
        className="mt-5 rounded-3xl border border-[#dce4ee] bg-white p-5 sm:p-7"
      >
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 id="readiness-summary-title" className="text-xl font-semibold">
              {t('readiness.summaryTitle', {
                defaultValue: 'Transaction summary',
              })}
            </h2>
            <p className="mt-1 text-sm text-muted">
              {evaluation.summary.range.startDate} to{' '}
              {evaluation.summary.range.endDate}
            </p>
            <p className="mt-1 text-sm text-muted">
              {t('readiness.summaryCoverage', {
                defaultValue:
                  '{{active}} of 12 months contain settled records · {{count}} records',
                active: evaluation.summary.activeMonths,
                count: evaluation.summary.transactionCount,
              })}
            </p>
          </div>
          <button
            type="button"
            onClick={() => downloadReadinessPdf(evaluation)}
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-accent px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:brightness-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2"
          >
            <Download aria-hidden="true" className="size-4" />
            {t('readiness.export', {
              defaultValue: 'Export loan application kit',
            })}
          </button>
        </div>
        <dl className="mt-5 grid gap-3 sm:grid-cols-3">
          {[
            [
              t('readiness.income', { defaultValue: 'Income' }),
              formatMoney(evaluation.summary.income),
            ],
            [
              t('readiness.expenses', { defaultValue: 'Expenses' }),
              formatMoney(evaluation.summary.expenses),
            ],
            [
              t('readiness.net', { defaultValue: 'Net cash flow' }),
              formatMoney(evaluation.summary.net),
            ],
          ].map(([label, value]) => (
            <div key={label} className="rounded-2xl bg-canvas p-4">
              <dt className="text-sm text-muted">{label}</dt>
              <dd className="mt-1 text-lg font-semibold tabular-nums">
                {value}
              </dd>
            </div>
          ))}
        </dl>
        <p className="mt-4 flex items-start gap-2 rounded-xl bg-canvas p-3 text-sm text-muted">
          <FileCheck2 aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
          <span>
            {t('readiness.reportHelp', {
              defaultValue:
                'The one-page PDF contains a transaction summary, checklist, record coverage, and limitations. It does not include original receipt images.',
            })}
          </span>
        </p>
      </section>
    </>
  );
}
