import { useId, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { FinancialChartSeries } from '../domain/reporting';

export type FinancialChartView = 'cash_flow' | 'net_change';

interface FinancialChartProps {
  values: FinancialChartSeries;
  view: FinancialChartView;
  onViewChange: (view: FinancialChartView) => void;
}

const chartMoney = (amount: number | null) => amount === null
  ? '—'
  : new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(amount);

function axisMoney(amount: number) {
  const absolute = Math.abs(amount);
  if (absolute >= 1_000_000) return `${(amount / 1_000_000).toFixed(absolute % 1_000_000 ? 1 : 0)}M`;
  if (absolute >= 1_000) return `${(amount / 1_000).toFixed(absolute % 1_000 ? 1 : 0)}K`;
  return String(Math.round(amount));
}

const dateLabel = (date: string, options: Intl.DateTimeFormatOptions) =>
  new Intl.DateTimeFormat(undefined, { ...options, timeZone: 'UTC' }).format(new Date(`${date}T12:00:00Z`));

function valueDomain(values: readonly number[]) {
  const min = Math.min(0, ...values);
  let max = Math.max(0, ...values);
  if (min === max) max = min + 1;
  return { min, max };
}

function yFor(value: number, domain: { min: number; max: number }, top: number, bottom: number) {
  return bottom - ((value - domain.min) / (domain.max - domain.min)) * (bottom - top);
}

function axisTicks(domain: { min: number; max: number }) {
  return Array.from({ length: 4 }, (_, index) => domain.min + ((domain.max - domain.min) * index) / 3);
}

export function FinancialChart({ values, view, onViewChange }: FinancialChartProps) {
  const { t } = useTranslation();
  const descriptionId = useId();
  const tooltipId = useId();
  const chartRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const pointsRef = useRef<Array<SVGGElement | null>>([]);
  const [chartWidth, setChartWidth] = useState(800);
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const days = values.days;
  const isCashFlow = view === 'cash_flow';
  const lineLabel = t('dashboard.cumulativeNetChange', { defaultValue: 'Cumulative net change' });
  const chartAccessibleLabel = t(view === 'cash_flow'
    ? 'dashboard.cashFlowChartAccessible'
    : 'dashboard.netChangeChartAccessible', {
    startDate: values.startDate,
    endDate: values.endDate,
    defaultValue: `${lineLabel} and daily income and expense charts from ${values.startDate} to ${values.endDate}.`,
  });
  const lineValues = useMemo(() => days.map((day) => day.cumulativeNetChange), [days]);
  const topDomain = valueDomain(isCashFlow
    ? days.flatMap((day) => [day.income, day.expenses])
    : lineValues,
  );
  const expenseDomain = valueDomain(days.map((day) => day.expenses));
  const plotLeft = 58;
  const plotRight = chartWidth - 16;
  const plotWidth = Math.max(1, plotRight - plotLeft);
  const edgeInset = 14;
  const topPlot = { top: 50, bottom: 300 };
  const netChangePlot = { top: 48, bottom: 174 };
  const expensePlot = { top: 238, bottom: 310 };
  const xFor = (index: number) => days.length <= 1
    ? plotLeft + plotWidth / 2
    : plotLeft + edgeInset + (index * Math.max(1, plotWidth - edgeInset * 2)) / (days.length - 1);
  const selectedDay = activeIndex === null ? null : days[activeIndex] ?? null;
  const selectedXPercent = activeIndex === null || chartWidth <= 0
    ? 50
    : (xFor(activeIndex) / chartWidth) * 100;
  const tooltipAlignment = selectedXPercent < 28 ? 'is-left' : selectedXPercent > 72 ? 'is-right' : 'is-center';
  const maxTickCount = days.length <= 7
    ? days.length
    : Math.max(2, Math.min(7, Math.floor(plotWidth / 54) + 1));
  const tickIndices = days.length <= maxTickCount
    ? days.map((_, index) => index)
    : Array.from({ length: maxTickCount }, (_, index) =>
      Math.round((index * (days.length - 1)) / (maxTickCount - 1)),
    );
  const slotWidth = plotWidth / Math.max(days.length - 1, 1);
  const flowBarWidth = Math.min(12, Math.max(2, slotWidth * 0.32));
  const netExpenseBarWidth = Math.min(18, Math.max(3, slotWidth * 0.56));
  const lineTicks = axisTicks(topDomain);
  const expenseTicks = axisTicks(expenseDomain);
  const linePlot = isCashFlow ? topPlot : netChangePlot;
  const linePath = days.map((_, index) =>
    `${index === 0 ? 'M' : 'L'} ${xFor(index)} ${yFor(lineValues[index], topDomain, linePlot.top, linePlot.bottom)}`,
  ).join(' ');

  useLayoutEffect(() => {
    const element = chartRef.current;
    if (!element) return undefined;
    const updateWidth = () => setChartWidth(Math.max(320, element.clientWidth || 800));
    updateWidth();
    if (typeof ResizeObserver !== 'undefined') {
      const observer = new ResizeObserver(updateWidth);
      observer.observe(element);
      return () => observer.disconnect();
    }
    window.addEventListener('resize', updateWidth);
    return () => window.removeEventListener('resize', updateWidth);
  }, []);

  function selectAtPointer(clientX: number) {
    const bounds = svgRef.current?.getBoundingClientRect();
    if (!bounds || !days.length) return;
    const localX = ((clientX - bounds.left) / bounds.width) * chartWidth;
    const nearest = days.reduce((bestIndex, _, index) =>
      Math.abs(xFor(index) - localX) < Math.abs(xFor(bestIndex) - localX) ? index : bestIndex,
    0);
    setActiveIndex(nearest);
  }

  function moveSelection(index: number, direction: -1 | 1) {
    const next = Math.max(0, Math.min(days.length - 1, index + direction));
    setActiveIndex(next);
    requestAnimationFrame(() => pointsRef.current[next]?.focus());
  }

  function pointDescription(index: number) {
    const day = days[index];
    return `${dateLabel(day.date, { dateStyle: 'full' })}. ${t('dashboard.periodIncome')}: ${chartMoney(day.income)} MMK. ${t('dashboard.periodExpenses')}: ${chartMoney(day.expenses)} MMK. ${t('dashboard.dailyNetChange', { defaultValue: 'Daily net change' })}: ${chartMoney(day.dailyNetChange)} MMK.`;
  }

  const views: Array<{ id: FinancialChartView; label: string }> = [
    { id: 'cash_flow', label: t('dashboard.cashFlowView', { defaultValue: 'Cash flow' }) },
    { id: 'net_change', label: t('dashboard.netChangeView', { defaultValue: 'Net change' }) },
  ];

  return <div className="financial-chart">
    <div className="financial-chart-toolbar">
      <div className="financial-chart-view-switch" role="group" aria-label={t('dashboard.chartViews', { defaultValue: 'Chart view' })}>
        {views.map((option) => <button
          key={option.id}
          type="button"
          className={`financial-chart-view${view === option.id ? ' is-active' : ''}`}
          aria-pressed={view === option.id}
          onClick={() => onViewChange(option.id)}
        >{option.label}</button>)}
      </div>
      <div className="financial-chart-legend" aria-hidden="true">
        {isCashFlow ? <>
          <span><i className="financial-legend-bar is-income" />{t('dashboard.periodIncome')}</span>
          <span><i className="financial-legend-bar is-expense" />{t('dashboard.periodExpenses')}</span>
        </> : <>
          <span><i className="financial-legend-line" />{lineLabel}</span>
          <span><i className="financial-legend-bar is-expense" />{t('dashboard.periodExpenses')}</span>
        </>}
      </div>
    </div>

    <div className="financial-chart-canvas" ref={chartRef}>
      <svg
        ref={svgRef}
        className="financial-chart-svg"
        viewBox={`0 0 ${chartWidth} 354`}
        role="group"
        aria-label={chartAccessibleLabel}
        aria-describedby={descriptionId}
        onPointerMove={(event) => selectAtPointer(event.clientX)}
        onClick={(event) => selectAtPointer(event.clientX)}
      >
        <desc id={descriptionId}>{isCashFlow
          ? t('dashboard.cashFlowChartDescription', { defaultValue: 'Use the left and right arrow keys to inspect each date. Income and expenses share the same amount scale.' })
          : t('dashboard.chartDescription', { defaultValue: 'Use the left and right arrow keys to inspect each date. The chart shows cumulative net change from settled income and expenses.' })}</desc>
        <text className="financial-chart-axis-title" x={plotLeft} y="25">{isCashFlow ? t('dashboard.dailyAmounts', { defaultValue: 'Daily income and expenses (MMK)' }) : `${lineLabel} (MMK)`}</text>
        {!isCashFlow ? <text className="financial-chart-axis-title" x={plotLeft} y="218">{t('dashboard.periodExpenses')} (MMK)</text> : null}
        {isCashFlow ? <>
          {axisTicks(topDomain).map((tick, index) => {
            const y = topPlot.bottom - ((index / 3) * (topPlot.bottom - topPlot.top));
            return <g key={`flow-tick-${index}`}>
              <line className="financial-chart-gridline" x1={plotLeft} x2={plotRight} y1={y} y2={y} />
              <text className="financial-chart-y-label" x={plotLeft - 8} y={y + 4} textAnchor="end">{axisMoney(tick)}</text>
            </g>;
          })}
          {days.map((day, index) => {
            const x = xFor(index);
            const incomeY = yFor(day.income, topDomain, topPlot.top, topPlot.bottom);
            const expenseY = yFor(day.expenses, topDomain, topPlot.top, topPlot.bottom);
            return <g key={day.date}>
              <rect className="financial-chart-hit-area" x={x - Math.max(22, slotWidth / 2)} y={topPlot.top} width={Math.max(44, slotWidth)} height={topPlot.bottom - topPlot.top} />
              <rect className="financial-chart-income-bar" x={x - flowBarWidth - 1} y={incomeY} width={flowBarWidth} height={Math.max(0, topPlot.bottom - incomeY)} rx={Math.min(4, flowBarWidth / 2)} />
              <rect className="financial-chart-expense-bar" x={x + 1} y={expenseY} width={flowBarWidth} height={Math.max(0, topPlot.bottom - expenseY)} rx={Math.min(4, flowBarWidth / 2)} />
            </g>;
          })}
        </> : <>
          {lineTicks.map((tick, index) => {
            const y = netChangePlot.bottom - ((index / 3) * (netChangePlot.bottom - netChangePlot.top));
            return <g key={`balance-tick-${index}`}>
              <line className="financial-chart-gridline" x1={plotLeft} x2={plotRight} y1={y} y2={y} />
              <text className="financial-chart-y-label" x={plotLeft - 8} y={y + 4} textAnchor="end">{axisMoney(tick)}</text>
            </g>;
          })}
          {expenseTicks.map((tick, index) => {
            const y = expensePlot.bottom - ((index / 3) * (expensePlot.bottom - expensePlot.top));
            return <g key={`expense-tick-${index}`}>
              <line className="financial-chart-gridline" x1={plotLeft} x2={plotRight} y1={y} y2={y} />
              <text className="financial-chart-y-label" x={plotLeft - 8} y={y + 4} textAnchor="end">{axisMoney(tick)}</text>
            </g>;
          })}
          {days.map((day, index) => {
            const x = xFor(index);
            const expenseY = yFor(day.expenses, expenseDomain, expensePlot.top, expensePlot.bottom);
            return <g key={day.date}>
              <rect className="financial-chart-hit-area" x={x - Math.max(22, slotWidth / 2)} y={netChangePlot.top} width={Math.max(44, slotWidth)} height={expensePlot.bottom - netChangePlot.top} />
              <rect className="financial-chart-expense-bar" x={x - netExpenseBarWidth / 2} y={expenseY} width={netExpenseBarWidth} height={Math.max(0, expensePlot.bottom - expenseY)} rx={Math.min(5, netExpenseBarWidth / 2)} />
            </g>;
          })}
          <path className="financial-chart-net-change-line" d={linePath} />
          {days.map((day, index) => (days.length <= 31 && slotWidth >= 12) || activeIndex === index ? <circle
            key={`point-${day.date}`}
            className={`financial-chart-net-change-point${day.dailyNetChange > 0 ? ' is-positive' : day.dailyNetChange < 0 ? ' is-negative' : ''}${activeIndex === index ? ' is-selected' : ''}`}
            cx={xFor(index)}
            cy={yFor(lineValues[index], topDomain, netChangePlot.top, netChangePlot.bottom)}
            r={activeIndex === index ? 4 : days.length > 20 ? 2.5 : 4}
          /> : null)}
        </>}

        {days.map((day, index) => <g
          key={`date-${day.date}`}
          ref={(node) => { pointsRef.current[index] = node; }}
          className={`financial-chart-date-point${activeIndex === index ? ' is-active' : ''}`}
          role="button"
          tabIndex={activeIndex === index || (activeIndex === null && index === 0) ? 0 : -1}
          aria-label={pointDescription(index)}
          aria-describedby={activeIndex === index ? tooltipId : undefined}
          onFocus={() => setActiveIndex(index)}
          onKeyDown={(event) => {
            if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
              event.preventDefault();
              moveSelection(index, event.key === 'ArrowLeft' ? -1 : 1);
            }
          }}
        ><rect className="financial-chart-keyboard-target" x={xFor(index) - 18} y="40" width="36" height="278" /></g>)}

        {tickIndices.map((index) => <text
          key={`date-label-${days[index].date}`}
          className="financial-chart-x-label"
          x={xFor(index)}
          y="340"
          textAnchor={index === 0 ? 'start' : index === days.length - 1 ? 'end' : 'middle'}
        >{dateLabel(days[index].date, { month: 'short', day: 'numeric' })}</text>)}
      </svg>

      {selectedDay ? <div
        id={tooltipId}
        className={`financial-chart-tooltip ${tooltipAlignment}`}
        style={{ left: `${selectedXPercent}%` }}
        role="tooltip"
        aria-live="polite"
      >
        <strong>{dateLabel(selectedDay.date, { dateStyle: 'medium' })}</strong>
        <dl>
          <div><dt>{t('dashboard.periodIncome')}</dt><dd>{chartMoney(selectedDay.income)} MMK</dd></div>
          <div><dt>{t('dashboard.periodExpenses')}</dt><dd>{chartMoney(selectedDay.expenses)} MMK</dd></div>
          <div><dt>{t('dashboard.dailyNetChange', { defaultValue: 'Daily net change' })}</dt><dd>{chartMoney(selectedDay.dailyNetChange)} MMK</dd></div>
        </dl>
      </div> : null}
    </div>
    {!values.income && !values.expenses ? <p className="financial-chart-empty" role="status">{t('dashboard.emptyPeriod')}</p> : null}
  </div>;
}

