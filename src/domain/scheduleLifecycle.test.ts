import { describe, expect, it, vi } from 'vitest';
import { emptyAppData, occurrenceIdFor } from './types';
import {
  monthlyDueDatesThrough,
  processOneTimeSchedules,
  processSchedules,
} from './scheduleLifecycle';
import { fixedClock } from '../services/clock';

function oneTimeData(dueDate = '2026-11-05') {
  return {
    ...emptyAppData(),
    scheduleRules: [
      {
        id: 'rent-one-time',
        type: 'expense' as const,
        amount: 220_000,
        categoryId: 'rent',
        description: 'One-time rent',
        counterpartyId: null,
        schedule: { kind: 'one_time' as const, dueDate },
        active: true,
        createdAt: '2026-10-20T10:00:00Z',
        updatedAt: '2026-10-20T10:00:00Z',
      },
    ],
  };
}

describe('one-time schedule lifecycle', () => {
  it('keeps future items scheduled, then catches them up once on their original due date', () => {
    const beforeDue = processOneTimeSchedules(
      oneTimeData(),
      fixedClock('2026-11-01T12:00:00+06:30'),
    );
    expect(beforeDue.paymentOccurrences).toEqual([
      {
        id: occurrenceIdFor('rent-one-time', '2026-11-05'),
        ruleId: 'rent-one-time',
        originalDueDate: '2026-11-05',
        status: 'scheduled',
      },
    ]);
    expect(beforeDue.transactions).toHaveLength(0);

    const dueClock = fixedClock('2026-11-07T09:00:00+06:30');
    const caughtUp = processOneTimeSchedules(
      beforeDue,
      dueClock,
      () => 'payment-1',
    );
    expect(caughtUp.paymentOccurrences[0]).toMatchObject({
      id: 'rent-one-time:2026-11-05',
      status: 'assumed_unconfirmed',
      originalDueDate: '2026-11-05',
      paymentDate: '2026-11-05',
      paymentTransactionId: 'payment-1',
      history: [{ action: 'assumed', at: '2026-11-07T02:30:00.000Z' }],
    });
    expect(caughtUp.transactions[0]).toMatchObject({
      id: 'payment-1',
      date: '2026-11-05',
      dueDate: '2026-11-05',
      cashStatus: 'settled',
      confirmationStatus: 'unconfirmed',
      source: 'recurring',
    });

    const idFactory = vi.fn(() => 'should-not-be-used');
    const repeated = processOneTimeSchedules(caughtUp, dueClock, idFactory);
    expect(idFactory).not.toHaveBeenCalled();
    expect(repeated.transactions).toHaveLength(1);
    expect(repeated.paymentOccurrences).toEqual(caughtUp.paymentOccurrences);
  });

  it('preserves an explicitly unpaid occurrence on later app-load processing', () => {
    const dueClock = fixedClock('2026-11-07T09:00:00+06:30');
    const assumed = processOneTimeSchedules(
      oneTimeData(),
      dueClock,
      () => 'payment-1',
    );
    const unpaid = {
      ...assumed,
      transactions: assumed.transactions.map((transaction) => ({
        ...transaction,
        cashStatus: 'pending' as const,
        confirmationStatus: 'not_applicable' as const,
      })),
      paymentOccurrences: assumed.paymentOccurrences.map((occurrence) =>
        occurrence.status === 'scheduled'
          ? occurrence
          : { ...occurrence, status: 'explicitly_unpaid' as const },
      ),
    };
    const processedAgain = processOneTimeSchedules(
      unpaid,
      fixedClock('2026-11-10T09:00:00+06:30'),
      () => 'duplicate-payment',
    );
    expect(processedAgain.transactions).toHaveLength(1);
    expect(processedAgain.paymentOccurrences[0].status).toBe(
      'explicitly_unpaid',
    );
  });
});

function monthlyRule(overrides: Record<string, unknown> = {}) {
  return {
    id: 'monthly-rent',
    type: 'expense' as const,
    amount: 220_000,
    categoryId: 'rent',
    description: 'Monthly rent',
    counterpartyId: null,
    schedule: {
      kind: 'monthly' as const,
      startDate: '2026-01-31',
      dayOfMonth: 31,
      ...((overrides.schedule as Record<string, unknown> | undefined) ?? {}),
    },
    active: true,
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
  };
}

describe('monthly schedule lifecycle', () => {
  it('clamps short months while retaining the original day for later months', () => {
    expect(
      monthlyDueDatesThrough(
        { kind: 'monthly', startDate: '2026-01-31', dayOfMonth: 31 },
        '2026-04-30',
      ),
    ).toEqual(['2026-01-31', '2026-02-28', '2026-03-31', '2026-04-30']);
  });

  it('skips a monthly date that falls before a mid-month start date and honors the end date', () => {
    expect(
      monthlyDueDatesThrough(
        {
          kind: 'monthly',
          startDate: '2026-01-15',
          dayOfMonth: 5,
          endDate: '2026-03-05',
        },
        '2026-12-31',
      ),
    ).toEqual(['2026-02-05', '2026-03-05']);
  });

  it('catches up due months, forecasts future months, and stays idempotent', () => {
    const data = {
      ...emptyAppData(),
      scheduleRules: [monthlyRule()],
    };
    let id = 0;
    const clock = fixedClock('2026-02-28T12:00:00+06:30');
    const processed = processSchedules(
      data,
      clock,
      () => `monthly-payment-${++id}`,
    );
    expect(
      processed.paymentOccurrences
        .filter((item) => item.status === 'assumed_unconfirmed')
        .map((item) => item.originalDueDate),
    ).toEqual(['2026-01-31', '2026-02-28']);
    expect(processed.transactions.map((item) => item.date)).toEqual([
      '2026-01-31',
      '2026-02-28',
    ]);
    expect(
      processed.paymentOccurrences.find(
        (item) => item.originalDueDate === '2026-03-31',
      ),
    ).toMatchObject({
      id: 'monthly-rent:2026-03-31',
      status: 'scheduled',
    });

    const repeated = processSchedules(
      processed,
      clock,
      () => `duplicate-${++id}`,
    );
    expect(repeated).toBe(processed);
    expect(id).toBe(2);
    expect(processed.paymentOccurrences.length).toBeGreaterThan(10);
  });
});
