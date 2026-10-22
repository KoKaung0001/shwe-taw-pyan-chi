import { describe, expect, it } from 'vitest';
import { calculateRecordedAvailableBalance } from './availableBalance';
import { fixedClock } from '../services/clock';
import type { BalanceAdjustment, OpeningBalance, Transaction } from './types';

const opening: OpeningBalance = {
  amount: 470_000,
  referenceAt: '2026-10-21T00:00:00+06:30',
  timeZone: 'Asia/Rangoon',
};
const transaction = (
  overrides: Partial<Transaction> & Pick<Transaction, 'id'>,
): Transaction => ({
  type: 'income',
  amount: 100_000,
  currency: 'MMK',
  date: '2026-10-22',
  categoryId: null,
  counterpartyId: null,
  cashStatus: 'settled',
  confirmationStatus: 'not_applicable',
  source: 'manual',
  ocrReviewStatus: 'not_applicable',
  createdAt: '2026-10-22T00:00:00Z',
  updatedAt: '2026-10-22T00:00:00Z',
  ...overrides,
});

describe('recorded available balance reference point', () => {
  it('applies signed balance adjustments after the opening time and keeps pending entries out', () => {
    const adjustment = (overrides: Partial<BalanceAdjustment> & Pick<BalanceAdjustment, 'id'>): BalanceAdjustment => ({
      amount: -10_000,
      currency: 'MMK',
      date: '2026-10-22',
      occurredAt: '2026-10-22T08:00:00Z',
      description: 'Reconciliation',
      createdAt: '2026-10-22T08:00:00Z',
      ...overrides,
    });
    const result = calculateRecordedAvailableBalance(opening, [
      transaction({ id: 'salary', amount: 100_000 }),
      transaction({ id: 'pending-expense', type: 'expense', amount: 900_000, cashStatus: 'pending', dueDate: '2026-10-22' }),
    ], [
      adjustment({ id: 'reconcile-down' }),
      adjustment({ id: 'same-as-opening', amount: 500_000, occurredAt: opening.referenceAt }),
      adjustment({ id: 'reconcile-up', amount: 5_000, occurredAt: '2026-10-22T09:00:00Z' }),
    ]);
    expect(result.amount).toBe(565_000);
    expect(result.includedAdjustmentIds).toEqual(['reconcile-down', 'reconcile-up']);
  });

  it('adds only settled movements after the opening reference', () => {
    const result = calculateRecordedAvailableBalance(opening, [
      transaction({
        id: 'before',
        type: 'expense',
        amount: 30_000,
        date: '2026-10-20',
      }),
      transaction({
        id: 'equal-instant',
        occurredAt: opening.referenceAt,
        date: '2026-10-21',
      }),
      transaction({
        id: 'after-instant',
        occurredAt: '2026-10-21T00:00:01+06:30',
        date: '2026-10-21',
      }),
      transaction({
        id: 'same-day-already-in-opening',
        date: '2026-10-21',
        openingDayDisposition: 'already_in_opening',
      }),
      transaction({
        id: 'same-day-after',
        type: 'expense',
        date: '2026-10-21',
        openingDayDisposition: 'after_reference',
      }),
      transaction({ id: 'future-date', date: '2026-10-22' }),
      transaction({ id: 'pending', date: '2026-10-23', cashStatus: 'pending' }),
    ]);
    expect(result.amount).toBe(570_000);
    expect(result.includedTransactionIds).toEqual([
      'after-instant',
      'same-day-after',
      'future-date',
    ]);
    expect(result.excludedAlreadyIncludedIds).toEqual([
      'before',
      'equal-instant',
      'same-day-already-in-opening',
    ]);
    expect(result.unclassifiedOpeningDayIds).toEqual([]);
  });
  it('requires explicit classification for a date-only movement on opening day', () => {
    const result = calculateRecordedAvailableBalance(opening, [
      transaction({ id: 'ambiguous', date: '2026-10-21' }),
    ]);
    expect(result.amount).toBe(470_000);
    expect(result.unclassifiedOpeningDayIds).toEqual(['ambiguous']);
  });
  it('uses the business timezone and safely handles a missing opening balance', () => {
    expect(fixedClock('2026-10-20T19:00:00Z').today()).toBe('2026-10-21');
    expect(
      calculateRecordedAvailableBalance(null, [transaction({ id: 'ignored' })]),
    ).toEqual({
      amount: null,
      includedTransactionIds: [],
      includedAdjustmentIds: [],
      excludedAlreadyIncludedIds: [],
      unclassifiedOpeningDayIds: [],
    });
  });
});
