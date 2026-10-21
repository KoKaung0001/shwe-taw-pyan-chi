import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  buildCashFlowForecast,
  summarizeOutstanding,
} from '../domain/reporting';
import { systemClock } from '../services/clock';
import { useDemoStore } from '../store/demoStore';

const money = (amount: number | null) =>
  amount === null
    ? '—'
    : new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(
        amount,
      );

export function OwedPage() {
  const { t } = useTranslation();
  const data = useDemoStore((state) => state.data);
  const summary = summarizeOutstanding(data, systemClock.today());
  return (
    <>
      <section className="mb-7">
        <p className="mb-3 text-xs font-bold tracking-[.18em] text-accent">
          {t('prototype')}
        </p>
        <h1 tabIndex={-1} className="text-3xl font-semibold sm:text-5xl">
          {t('owed.title')}
        </h1>
        <p className="mt-4 max-w-2xl text-lg text-muted">
          {t('owed.description')}
        </p>
      </section>
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

export function ForecastPage() {
  const { t } = useTranslation();
  const data = useDemoStore((state) => state.data);
  const forecast = buildCashFlowForecast(data, systemClock.today());
  return (
    <>
      <section className="mb-7">
        <p className="mb-3 text-xs font-bold tracking-[.18em] text-accent">
          {t('prototype')}
        </p>
        <h1 tabIndex={-1} className="text-3xl font-semibold sm:text-5xl">
          {t('insights.title')}
        </h1>
        <p className="mt-4 max-w-2xl text-lg text-muted">
          {t('insights.description')}
        </p>
      </section>
      {!data.openingBalance ? (
        <p className="rounded-xl bg-amber-50 p-4 text-amber-950">
          {t('forecast.openingRequired')}{' '}
          <Link className="font-semibold underline" to="/settings">
            {t('settings.nav')}
          </Link>
        </p>
      ) : (
        <>
          <p className="mb-5 rounded-xl bg-[#edf3ec] p-4 text-sm text-muted">
            {t('forecast.disclaimer')}
          </p>
          <div className="grid gap-4 sm:grid-cols-2">
            <ForecastSummaryCard
              title={t('forecast.baseCase')}
              minimum={forecast.base.minimumBalance}
              date={forecast.base.minimumBalanceDate}
              shortfall={forecast.base.shortfall}
              shortfallLabel={t('forecast.noShortfall')}
              lowLabel={t('forecast.lowPoint')}
            />
            <ForecastSummaryCard
              title={t('forecast.lateCase')}
              minimum={forecast.lateInflows.minimumBalance}
              date={forecast.lateInflows.minimumBalanceDate}
              shortfall={forecast.lateInflows.shortfall}
              shortfallLabel={t('forecast.noShortfall')}
              lowLabel={t('forecast.lowPoint')}
            />
          </div>
          <section className="mt-6 rounded-3xl border border-[#dce4dc] bg-white p-5 sm:p-7">
            <div className="mb-4">
              <h2 className="text-xl font-semibold">
                {t('forecast.dailyTitle')}
              </h2>
              <p className="mt-1 text-sm text-muted">
                {forecast.startDate} – {forecast.endDate}
              </p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[42rem] border-collapse text-left text-sm">
                <thead>
                  <tr className="border-b text-muted">
                    <th className="py-3 pr-3 font-medium">
                      {t('forecast.date')}
                    </th>
                    <th className="py-3 pr-3 text-right font-medium">
                      {t('forecast.inflows')}
                    </th>
                    <th className="py-3 pr-3 text-right font-medium">
                      {t('forecast.outflows')}
                    </th>
                    <th className="py-3 pr-3 text-right font-medium">
                      {t('forecast.baseBalance')}
                    </th>
                    <th className="py-3 text-right font-medium">
                      {t('forecast.lateBalance')}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {forecast.base.days.map((day, index) => (
                    <tr key={day.date} className="border-b border-[#e4e9e2]">
                      <th scope="row" className="py-3 pr-3 font-medium">
                        {day.date}
                      </th>
                      <td className="py-3 pr-3 text-right">
                        {day.income ? `${money(day.income)} MMK` : '—'}
                      </td>
                      <td className="py-3 pr-3 text-right">
                        {day.expenses ? `${money(day.expenses)} MMK` : '—'}
                      </td>
                      <td className="py-3 pr-3 text-right">
                        {money(day.closingBalance)}
                      </td>
                      <td className="py-3 text-right">
                        {money(
                          forecast.lateInflows.days[index]?.closingBalance ??
                            null,
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}
    </>
  );
}

function ForecastSummaryCard({
  title,
  minimum,
  date,
  shortfall,
  shortfallLabel,
  lowLabel,
}: {
  title: string;
  minimum: number | null;
  date: string | null;
  shortfall: number;
  shortfallLabel: string;
  lowLabel: string;
}) {
  const { t } = useTranslation();
  return (
    <article className="rounded-3xl border border-[#dce4dc] bg-white p-6">
      <h2 className="font-semibold">{title}</h2>
      <p className="mt-3 text-sm text-muted">
        {lowLabel}
        {date ? ` · ${date}` : ''}
      </p>
      <p className="mt-1 text-2xl font-semibold">
        {money(minimum)} <span className="text-sm font-medium">MMK</span>
      </p>
      <p
        className={`mt-3 text-sm ${shortfall ? 'font-semibold text-red-800' : 'text-accent'}`}
      >
        {shortfall
          ? t('forecast.shortfall', { amount: money(shortfall) })
          : shortfallLabel}
      </p>
    </article>
  );
}
