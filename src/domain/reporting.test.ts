import { describe, expect, it } from 'vitest';
import { emptyAppData, type Transaction } from './types';
import {
  buildFinancialChartSeries,
  getReportingRange,
  summarizeDailyMovement,
  summarizeMonthlyMovement,
  summarizeOutstanding,
  summarizePeriod,
} from './reporting';

const record = (
  overrides: Partial<Transaction> & Pick<Transaction, 'id'>,
): Transaction => ({
  type: 'income',
  amount: 100_000,
  currency: 'MMK',
  date: '2026-10-10',
  categoryId: null,
  counterpartyId: null,
  cashStatus: 'settled',
  confirmationStatus: 'not_applicable',
  source: 'manual',
  ocrReviewStatus: 'not_applicable',
  createdAt: '2026-10-10T00:00:00Z',
  updatedAt: '2026-10-10T00:00:00Z',
  ...overrides,
});

describe('reporting selectors', () => {
  it('selects this month, last month and rolling 30-day date ranges', () => {
    expect(getReportingRange('this_month', '2026-03-04')).toEqual({
      startDate: '2026-03-01',
      endDate: '2026-03-04',
    });
    expect(getReportingRange('last_month', '2026-03-04')).toEqual({
      startDate: '2026-02-01',
      endDate: '2026-02-28',
    });
    expect(getReportingRange('last_30_days', '2026-03-04')).toEqual({
      startDate: '2026-02-03',
      endDate: '2026-03-04',
    });
  });

  it('summarizes settled income and expenses, excluding pending items', () => {
    const result = summarizePeriod(
      [
        record({ id: 'income' }),
        record({ id: 'expense', type: 'expense', amount: 35_000 }),
        record({
          id: 'pending',
          amount: 500_000,
          cashStatus: 'pending',
          dueDate: '2026-10-15',
        }),
        record({ id: 'outside', date: '2026-09-30' }),
      ],
      { startDate: '2026-10-01', endDate: '2026-10-31' },
    );
    expect(result).toMatchObject({
      income: 100_000,
      expenses: 35_000,
      net: 65_000,
      transactionCount: 2,
    });
  });

  it('returns one daily chart value for every date and excludes pending transactions', () => {
    const series = summarizeDailyMovement(
      [
        record({ id: 'monday', date: '2026-10-19', amount: 12_000 }),
        record({ id: 'monday-expense', date: '2026-10-19', type: 'expense', amount: 4_000 }),
        record({ id: 'wednesday', date: '2026-10-21', amount: 7_000 }),
        record({ id: 'pending', date: '2026-10-20', cashStatus: 'pending', dueDate: '2026-10-20', amount: 90_000 }),
        record({ id: 'outside', date: '2026-10-26' }),
      ],
      { startDate: '2026-10-19', endDate: '2026-10-25' },
    );

    expect(series).toHaveLength(7);
    expect(series.map(({ date }) => date)).toEqual([
      '2026-10-19', '2026-10-20', '2026-10-21', '2026-10-22',
      '2026-10-23', '2026-10-24', '2026-10-25',
    ]);
    expect(series[0]).toMatchObject({ income: 12_000, expenses: 4_000 });
    expect(series[1]).toMatchObject({ income: 0, expenses: 0 });
    expect(series[2]).toMatchObject({ income: 7_000, expenses: 0 });
    expect(series[6]).toMatchObject({ income: 0, expenses: 0 });
  });

  it('creates a six-month chart series from settled records', () => {
    const series = summarizeMonthlyMovement(
      [
        record({ id: 'aug', date: '2026-08-20', amount: 15_000 }),
        record({ id: 'oct', type: 'expense', amount: 5_000 }),
        record({ id: 'pending', cashStatus: 'pending', dueDate: '2026-10-15' }),
      ],
      '2026-10-21',
    );
    expect(series).toHaveLength(6);
    expect(series[0].month).toBe('2026-05');
    expect(series[3]).toMatchObject({ month: '2026-08', income: 15_000 });
    expect(series[5]).toMatchObject({
      month: '2026-10',
      income: 0,
      expenses: 5_000,
    });
  });

  it('separates pending receivables and payables and derives overdue by due date', () => {
    const result = summarizeOutstanding(
      {
        ...emptyAppData(),
        receivables: [{ id: 'invoice', amount: 400_000, currency: 'MMK', date: '2026-10-01', counterparty: 'Client', status: 'unpaid', categoryId: 'client-income', createdAt: '2026-10-01T00:00:00Z', updatedAt: '2026-10-01T00:00:00Z' }],
        transactions: [
          record({
            id: 'invoice',
            amount: 400_000,
            cashStatus: 'pending',
            dueDate: '2026-10-20',
          }),
          record({
            id: 'bill',
            type: 'expense',
            amount: 60_000,
            cashStatus: 'pending',
            dueDate: '2026-10-25',
          }),
          record({ id: 'settled', amount: 20_000 }),
        ],
      },
      '2026-10-21',
    );
    expect(result.receivableTotal).toBe(400_000);
    expect(result.payableTotal).toBe(60_000);
    expect(result.receivables).toHaveLength(0);
    expect(result.payables[0].overdue).toBe(false);
  });
});

describe('movement chart series', () => {
  it('plots daily settled income and expenses and cumulative net change across every date', () => {
    const series = buildFinancialChartSeries([
      record({ id: 'monday-income', date: '2026-10-19', amount: 30_000 }),
      record({ id: 'monday-expense', date: '2026-10-19', type: 'expense', amount: 4_000 }),
      record({ id: 'wednesday-expense', date: '2026-10-21', type: 'expense', amount: 40_000 }),
      record({ id: 'thursday-income', date: '2026-10-22', amount: 20_000 }),
      record({ id: 'pending', date: '2026-10-21', type: 'expense', amount: 900_000, cashStatus: 'pending', dueDate: '2026-10-21' }),
    ], { startDate: '2026-10-19', endDate: '2026-10-25' });

    expect(series.days).toHaveLength(7);
    expect(series.days.map(({ date }) => date)).toEqual([
      '2026-10-19', '2026-10-20', '2026-10-21', '2026-10-22',
      '2026-10-23', '2026-10-24', '2026-10-25',
    ]);
    expect(series.days[0]).toMatchObject({ income: 30_000, expenses: 4_000, dailyNetChange: 26_000, cumulativeNetChange: 26_000 });
    expect(series.days[1]).toMatchObject({ income: 0, expenses: 0, dailyNetChange: 0, cumulativeNetChange: 26_000 });
    expect(series.days[2]).toMatchObject({ income: 0, expenses: 40_000, dailyNetChange: -40_000, cumulativeNetChange: -14_000 });
    expect(series).toMatchObject({ income: 50_000, expenses: 44_000, netChange: 6_000 });
  });

  it('updates the plotted dates and totals when the selected period changes', () => {
    const transactions = [
      record({ id: 'in-range', date: '2026-10-20', amount: 30_000 }),
      record({ id: 'outside-range', date: '2026-10-27', amount: 12_000 }),
    ];
    const firstRange = buildFinancialChartSeries(transactions, getReportingRange('this_week', '2026-10-21'));
    const nextWeek = buildFinancialChartSeries(transactions, { startDate: '2026-10-26', endDate: '2026-11-01' });
    expect(firstRange.days).toHaveLength(7);
    expect(firstRange.income).toBe(30_000);
    expect(nextWeek.days.map((day) => day.date)).toEqual([
      '2026-10-26', '2026-10-27', '2026-10-28', '2026-10-29', '2026-10-30', '2026-10-31', '2026-11-01',
    ]);
    expect(nextWeek.income).toBe(12_000);
    expect(nextWeek.days[1].cumulativeNetChange).toBe(12_000);
  });
});