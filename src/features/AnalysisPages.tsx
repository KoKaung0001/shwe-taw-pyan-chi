import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
import { SendHorizontal } from 'lucide-react';
import { answerRecordedQuestion } from '../domain/analysis';
import { summarizeOutstanding } from '../domain/reporting';
import { clockForTimeZone } from '../services/clock';
import { useDemoStore } from '../store/demoStore';

const money = (amount: number | null) =>
  amount === null
    ? '—'
    : new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(
        amount,
      );

function translationValues(
  values: Record<string, string | number>,
  t: TFunction,
): Record<string, string | number> {
  return Object.fromEntries(
    Object.entries(values).map(([key, value]) => [
      key,
      key === 'category' && typeof value === 'string'
        ? t(`category.${value}`)
        : typeof value === 'number' &&
            !['count', 'percent', 'completed', 'total'].includes(key)
          ? money(value)
          : value,
    ]),
  );
}

export function OwedPage() {
  const { t } = useTranslation();
  const data = useDemoStore((state) => state.data);
  const timeZone = useDemoStore((state) => state.timeZone);
  const today = clockForTimeZone(timeZone).today();
  const summary = summarizeOutstanding(data, today);
  return (
    <>
      <header className="page-heading">
        <h1 tabIndex={-1}>{t('payments.title')}</h1>
        <nav className="section-tabs" aria-label={t('payments.nav')}>
          <Link className="section-tab" to="/payments/upcoming">{t('payments.upcoming')}</Link>
          <Link className="section-tab section-tab-active" aria-current="page" to="/payments/owed">{t('payments.owed')}</Link>
        </nav>
      </header>
      <div className="grid gap-4 sm:grid-cols-2">
        <SummaryCard
          title={t('owed.receivableTotal')}
          amount={summary.receivableTotal}
        />
        <SummaryCard
          title={t('owed.payableTotal')}
          amount={summary.payableTotal}
        />
      </div>
      {summary.unconfirmedPaidCount > 0 ? (
        <p
          className="mt-4 rounded-xl bg-amber-50 p-4 text-sm text-amber-950"
          role="status"
        >
          {t('balance.unconfirmedDisclosure', {
            count: summary.unconfirmedPaidCount,
          })}{' '}
          {t('owed.assumptionsExcluded')}
        </p>
      ) : null}
      <OutstandingList
        title={t('owed.receivables')}
        empty={t('owed.noReceivables')}
        items={summary.receivables}
        typeLabel={t('owed.incoming')}
        overdueLabel={t('owed.overdue')}
        updateLabel={t('owed.updatePayment')}
      />
      <OutstandingList
        title={t('owed.payables')}
        empty={t('owed.noPayables')}
        items={summary.payables}
        typeLabel={t('owed.outgoing')}
        overdueLabel={t('owed.overdue')}
        updateLabel={t('owed.updatePayment')}
      />
    </>
  );
}

function SummaryCard({ title, amount }: { title: string; amount: number }) {
  return (
    <article className="rounded-3xl border border-[#dce4dc] bg-white p-6">
      <p className="text-sm text-muted">{title}</p>
      <p className="mt-3 text-3xl font-semibold">
        {money(amount)} <span className="text-base font-medium">MMK</span>
      </p>
    </article>
  );
}

function OutstandingList({
  title,
  empty,
  items,
  typeLabel,
  overdueLabel,
  updateLabel,
}: {
  title: string;
  empty: string;
  items: ReturnType<typeof summarizeOutstanding>['receivables'];
  typeLabel: string;
  overdueLabel: string;
  updateLabel: string;
}) {
  const { t } = useTranslation();
  return (
    <section className="mt-6 rounded-3xl border border-[#dce4dc] bg-white p-5 sm:p-7">
      <h2 className="text-xl font-semibold">{title}</h2>
      {items.length ? (
        <ul className="mt-4 divide-y divide-[#e4e9e2]">
          {items.map(({ transaction, dueDate, overdue }) => (
            <li
              key={transaction.id}
              className="flex flex-wrap items-center justify-between gap-4 py-4"
            >
              <div className="min-w-0">
                <p className="font-semibold">
                  {transaction.description ||
                    t(`category.${transaction.categoryId ?? 'uncategorized'}`)}
                </p>
                <p className="mt-1 text-sm text-muted">
                  {typeLabel} ·{' '}
                  {t('owed.recordedOn', { date: transaction.date })} ·{' '}
                  {t('owed.dueOn', { date: dueDate })}
                </p>
                <p
                  className={`mt-1 text-sm font-medium ${overdue ? 'text-red-800' : 'text-accent'}`}
                >
                  {overdue ? overdueLabel : t('owed.upcoming')}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <strong>{money(transaction.amount)} MMK</strong>
                <Link
                  className="min-h-11 rounded-lg border border-[#bccbc0] px-3 py-2 text-sm font-medium"
                  to={`/transactions?edit=${encodeURIComponent(transaction.id)}`}
                >
                  {updateLabel}
                </Link>
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-4 text-muted">{empty}</p>
      )}
    </section>
  );
}

export function ChatPage() {
  const { t } = useTranslation();
  const data = useDemoStore((state) => state.data);
  const timeZone = useDemoStore((state) => state.timeZone);
  const today = clockForTimeZone(timeZone).today();
  const [question, setQuestion] = useState('');
  const [messages, setMessages] = useState<Array<{ question: string; answer: ReturnType<typeof answerRecordedQuestion> }>>([]);
  const transcriptRef = useRef<HTMLElement>(null);
  // The transcript owns the scroll on desktop, so a new answer has to be
  // brought into view the way a page-level scroll used to do on its own.
  useEffect(() => {
    if (!messages.length) return;
    const region = transcriptRef.current;
    if (!region) return;
    region.scrollTop = region.scrollHeight;
  }, [messages.length]);
  const suggestions = t('chat.suggestedQuestions', { returnObjects: true }) as string[];
  function ask(text: string) {
    setQuestion(text);
    setMessages((current) => [...current, { question: text, answer: answerRecordedQuestion(data, today, text) }]);
  }
  function submit(event: FormEvent) {
    event.preventDefault();
    ask(question);
    setQuestion('');
  }
  return (
    <div className="chat-page">
      <header className="page-heading">
        <h1 tabIndex={-1}>{t('chat.title')}</h1>
      </header>
      <p className="mb-5 rounded-xl bg-[#edf3ec] p-4 text-sm text-muted">
        <strong>{t('chat.demoLabel', { defaultValue: 'Demo assistant' })}.</strong> {t('chat.limits')}
      </p>
      <section className="suggested-questions" aria-label={t('chat.suggestionsTitle', { defaultValue: 'Suggested questions' })}>
        <h2>{t('chat.suggestionsTitle', { defaultValue: 'Try asking' })}</h2>
        <div>{suggestions.map((suggestion) => <button key={suggestion} className="suggestion-chip" type="button" onClick={() => ask(suggestion)}>{suggestion}</button>)}</div>
      </section>
      {messages.length ? <section ref={transcriptRef} className="chat-transcript" aria-live="polite" aria-label={t('chat.answerTitle')}>
        {messages.map(({ question: asked, answer }, index) => <div key={`${index}-${asked}`} className="chat-turn">
          <p className="chat-user-message">{asked}</p>
          <div className="chat-assistant-message"><strong>{t('chat.answerTitle')}</strong><p>{t(answer.messageKey, translationValues(answer.values, t))}</p>
            {answer.evidence.length ? <div className="mt-4 border-t border-[#e4e7ef] pt-4"><h3 className="text-sm font-semibold">{t('chat.evidence')}</h3><ul className="mt-2 space-y-2 text-sm text-muted">{answer.evidence.map((item) => <li key={item.id}>{t('chat.evidenceRow', { description: item.description || t('chat.unnamedRecord'), date: item.date, amount: money(item.amount), due: item.dueDate ? t('chat.evidenceDueDate', { date: item.dueDate }) : '' })}</li>)}</ul></div> : null}
          </div>
        </div>)}
      </section> : null}
      <form className="chat-composer" onSubmit={submit}>
        <label className="sr-only" htmlFor="chat-question">
          {t('chat.questionLabel')}
        </label>
        <div className="chat-input-wrap">
          <input
            id="chat-question"
            className="chat-input"
            value={question}
            onChange={(event) => setQuestion(event.target.value)}
            maxLength={300}
            placeholder={t('chat.questionPlaceholder')}
            required
          />
        </div>
        <button className="chat-send" aria-label={t('chat.ask')}>
          <SendHorizontal size={20} aria-hidden="true" />
        </button>
      </form>
    </div>
  );
}
