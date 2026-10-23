import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Plus, TrendingDown, TrendingUp } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { buildFinancialChartSeries, getReportingRange, summarizeOutstanding, summarizePeriod, type ReportingPeriod } from '../domain/reporting';
import { clockForTimeZone } from '../services/clock';
import { useDemoStore } from '../store/demoStore';
import { useAuthSession } from '../services/supabaseAuthSession';
import { FinancialChart, type FinancialChartView } from './FinancialChart';

const money = (amount: number) => new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(amount);

export function DashboardPage({ period, onPeriodChange, chartView, onChartViewChange }: {
  period: ReportingPeriod;
  onPeriodChange: (period: ReportingPeriod) => void;
  chartView: FinancialChartView;
  onChartViewChange: (view: FinancialChartView) => void;
}) {
  const { t } = useTranslation();
  const { user } = useAuthSession();
  const data = useDemoStore((state) => state.data);
  const timeZone = useDemoStore((state) => state.timeZone);
  const today = clockForTimeZone(timeZone).today();
  const range = useMemo(() => getReportingRange(period, today), [period, today]);
  const summary = useMemo(() => summarizePeriod(data.transactions, range), [data.transactions, range]);
  const outstanding = useMemo(() => summarizeOutstanding(data, today), [data, today]);
  const financialChart = useMemo(
    () => buildFinancialChartSeries(data.transactions, range),
    [data.transactions, range],
  );
  const recent = [...data.transactions].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 5);

  return <div className="dashboard-page page-stack">
    <header className="page-heading">
      <div><h1 tabIndex={-1}>{t('dashboard.welcome', { name: user?.name ?? '', defaultValue: user?.name ? `Welcome, ${user.name}` : 'Welcome' })}</h1><p className="text-muted">{t('dashboard.context', { defaultValue: 'Your recorded activity at a glance.' })}</p></div>
      <label className="period-control">{t('dashboard.reportingPeriod', { defaultValue: 'Period' })}
        <select className="app-select" value={period} onChange={(event) => onPeriodChange(event.target.value as ReportingPeriod)}>
          <option value="this_week">{t('dashboard.thisWeek', { defaultValue: 'This week' })}</option>
          <option value="last_week">{t('dashboard.lastWeek', { defaultValue: 'Last week' })}</option>
          <option value="this_month">{t('dashboard.thisMonth')}</option>
          <option value="last_month">{t('dashboard.lastMonth')}</option>
          <option value="last_3_months">{t('dashboard.last3Months')}</option>
          <option value="last_6_months">{t('dashboard.last6Months')}</option>
          <option value="last_year">{t('dashboard.lastYear')}</option>
        </select>
      </label>
    </header>

    <section className="dashboard-metrics" aria-label={t('dashboard.metrics', { defaultValue: 'Financial summary' })}>
      <Metric label={t('dashboard.periodIncome', { defaultValue: 'Income' })} amount={summary.income} tone="positive" />
      <Metric label={t('dashboard.periodExpenses', { defaultValue: 'Expenses' })} amount={summary.expenses} />
      <Metric label={t('dashboard.netBalance', { defaultValue: 'Net balance' })} amount={summary.net} note={t('dashboard.netHelp', { defaultValue: 'Recorded income minus recorded expenses; not a bank balance.' })} tone={summary.net >= 0 ? 'positive' : 'negative'} />
      <Metric label={t('dashboard.receivables', { defaultValue: 'Receivables' })} amount={outstanding.receivableTotal} note={t('dashboard.receivablesHelp', { defaultValue: 'Unpaid amounts owed to you, separate from expenses.' })} tone="soft" />
    </section>

    <section className="surface-card dashboard-chart">
      <header className="dashboard-chart-heading">
        <h2>{t('dashboard.chartTitle', { defaultValue: 'Income and expenses' })}</h2>
        <p className="dashboard-chart-hook">{t('dashboard.chartHook', { defaultValue: 'See the pace of your cash flow' })}</p>
        <p className="dashboard-chart-explanation">{t('dashboard.chartExplanation', { startDate: range.startDate, endDate: range.endDate, defaultValue: 'Daily settled income and expenses from {{startDate}} to {{endDate}}.' })}</p>
      </header>
      <FinancialChart key={period} values={financialChart} view={chartView} onViewChange={onChartViewChange} />
    </section>
    <section className="surface-card recent-card">
      <div className="section-heading-row"><h2>{t('dashboard.recent')}</h2><Link className="text-link" to="/transactions">{t('transactions.open')} <ArrowRight size={16} /></Link></div>
      {recent.length ? <ul className="transaction-list">{recent.map((item) => <li key={item.id}>
        <span className={`transaction-type-icon ${item.type === 'income' ? 'transaction-income' : 'transaction-expense'}`}>{item.type === 'income' ? <TrendingUp size={18} /> : <TrendingDown size={18} />}</span>
        <div className="transaction-description"><p>{item.description || t(`category.${item.categoryId ?? 'uncategorized'}`)}</p><span>{item.date} · {t(`transaction.${item.type}`)}</span></div>
        <strong className={item.type === 'income' ? 'transaction-amount-income' : ''}>{item.type === 'expense' ? '−' : '+'}{money(item.amount)} <small>MMK</small></strong>
      </li>)}</ul> : <div className="dashboard-empty"><p>{t('dashboard.empty', { defaultValue: 'Your records will appear here.' })}</p><Link className="pill-button pill-button-primary" to="/add"><Plus size={17} />{t('add.nav', { defaultValue: 'Add a record' })}</Link></div>}
    </section>
  </div>;
}

function Metric({ label, amount, note, tone = '' }: { label: string; amount: number | null; note?: string; tone?: string }) {
  return <article className={`metric-card surface-card ${tone ? `metric-${tone}` : ''}`}><p>{label}</p><strong>{amount === null ? '—' : money(amount)} {amount !== null ? <small>MMK</small> : null}</strong>{note ? <span>{note}</span> : null}</article>;
}

