import { describe, expect, it } from 'vitest';
import { emptyAppData, type Transaction } from './types';
import {
  buildCashFlowForecast,
  getReportingRange,
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
    expect(result.receivables[0].overdue).toBe(true);
    expect(result.payables[0].overdue).toBe(false);
  });
});

describe('14-day cash-flow forecast', () => {
  it('reproduces the 180,000 late-inflow shortfall and shifts only income by seven days', () => {
    const today = '2026-10-21';
    const input = {
      ...emptyAppData(),
      openingBalance: {
        amount: 470_000,
        referenceAt: '2026-10-20T23:59:00+06:30',
        timeZone: 'Asia/Rangoon' as const,
      },
      transactions: [
        record({
          id: 'invoice',
          amount: 400_000,
          date: today,
          cashStatus: 'pending',
          dueDate: '2026-10-23',
        }),
        record({
          id: 'bill',
          type: 'expense',
          amount: 650_000,
          date: today,
          cashStatus: 'pending',
          dueDate: '2026-10-24',
        }),
      ],
    };
    const forecast = buildCashFlowForecast(input, today);
    expect(forecast.startingBalance).toBe(470_000);
    expect(forecast.base.minimumBalance).toBe(220_000);
    expect(forecast.lateInflows.minimumBalance).toBe(-180_000);
    expect(forecast.lateInflows.shortfall).toBe(180_000);
    expect(
      forecast.base.days.find((day) => day.date === '2026-10-23')?.income,
    ).toBe(400_000);
    expect(
      forecast.lateInflows.days.find((day) => day.date === '2026-10-30')
        ?.income,
    ).toBe(400_000);
  });

  it('moves overdue items to today and does not forecast a processed payment twice', () => {
    const today = '2026-10-21';
    const due = record({
      id: 'linked-payment',
      type: 'expense',
      amount: 10_000,
      date: '2026-10-20',
      dueDate: '2026-10-20',
      source: 'recurring',
      cashStatus: 'settled',
      confirmationStatus: 'unconfirmed',
      paymentOccurrenceId: 'rent:2026-10-20',
    });
    const forecast = buildCashFlowForecast(
      {
        ...emptyAppData(),
        openingBalance: {
          amount: 100_000,
          referenceAt: '2026-10-19T23:59:00+06:30',
          timeZone: 'Asia/Rangoon',
        },
        transactions: [due],
        scheduleRules: [
          {
            id: 'rent',
            type: 'expense',
            amount: 10_000,
            categoryId: 'rent',
            counterpartyId: null,
            schedule: { kind: 'one_time', dueDate: '2026-10-20' },
            active: true,
            createdAt: '2026-10-19T00:00:00Z',
            updatedAt: '2026-10-19T00:00:00Z',
          },
        ],
        paymentOccurrences: [
          {
            id: 'rent:2026-10-20',
            ruleId: 'rent',
            originalDueDate: '2026-10-20',
            status: 'assumed_unconfirmed',
            paymentTransactionId: due.id,
            paymentDate: due.date,
            paymentAmount: due.amount,
            history: [{ action: 'assumed', at: '2026-10-20T00:00:00Z' }],
          },
        ],
      },
      today,
    );
    expect(forecast.startingBalance).toBe(90_000);
    expect(forecast.base.days[0].expenses).toBe(0);
    expect(forecast.base.days[0].closingBalance).toBe(90_000);
  });

  it('places overdue unpaid obligations on the first forecast day', () => {
    const forecast = buildCashFlowForecast(
      {
        ...emptyAppData(),
        openingBalance: {
          amount: 100_000,
          referenceAt: '2026-10-19T23:59:00+06:30',
          timeZone: 'Asia/Rangoon',
        },
        transactions: [
          record({
            id: 'overdue-bill',
            type: 'expense',
            amount: 25_000,
            date: '2026-10-18',
            dueDate: '2026-10-19',
            cashStatus: 'pending',
          }),
        ],
      },
      '2026-10-21',
    );
    expect(forecast.base.days[0]).toMatchObject({
      date: '2026-10-21',
      expenses: 25_000,
      closingBalance: 75_000,
    });
  });
});
