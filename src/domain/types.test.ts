import { describe, expect, it } from 'vitest';
import {
  appDataSchema,
  emptyAppData,
  occurrenceIdFor,
  type AppData,
  type PaymentOccurrence,
  type Transaction,
} from './types';

const baseTransaction = (
  overrides: Partial<Transaction> & Pick<Transaction, 'id'>,
): Transaction => ({
  type: 'expense',
  amount: 200_000,
  currency: 'MMK',
  date: '2026-11-05',
  categoryId: null,
  counterpartyId: null,
  cashStatus: 'settled',
  confirmationStatus: 'unconfirmed',
  source: 'recurring',
  ocrReviewStatus: 'not_applicable',
  paymentOccurrenceId: 'rent:2026-11-05',
  createdAt: '2026-11-05T00:00:00Z',
  updatedAt: '2026-11-05T00:00:00Z',
  ...overrides,
});
const occurrenceData = (): AppData => ({
  ...emptyAppData(),
  scheduleRules: [
    {
      id: 'rent',
      type: 'expense',
      amount: 200_000,
      categoryId: null,
      counterpartyId: null,
      schedule: { kind: 'monthly', startDate: '2026-11-05', dayOfMonth: 5 },
      active: true,
      createdAt: '2026-10-01T00:00:00Z',
      updatedAt: '2026-10-01T00:00:00Z',
    },
  ],
  paymentOccurrences: [
    {
      id: occurrenceIdFor('rent', '2026-11-05'),
      ruleId: 'rent',
      originalDueDate: '2026-11-05',
      status: 'assumed_unconfirmed',
      paymentTransactionId: 'rent-payment',
      paymentDate: '2026-11-05',
      paymentAmount: 200_000,
      history: [{ action: 'assumed', at: '2026-11-05T00:00:00Z' }],
    },
  ],
  transactions: [baseTransaction({ id: 'rent-payment', date: '2026-11-05' })],
});

describe('persisted data contracts', () => {
  it('accepts one occurrence linked to its assumed payment while keeping OCR review separate', () => {
    expect(appDataSchema.safeParse(occurrenceData()).success).toBe(true);
  });
  it('rejects an occurrence with an inconsistent payment amount or non-stable identity', () => {
    const data = occurrenceData();
    data.paymentOccurrences = [
      {
        ...data.paymentOccurrences[0],
        paymentAmount: 210_000,
      } as unknown as PaymentOccurrence,
    ];
    expect(appDataSchema.safeParse(data).success).toBe(false);
    expect(occurrenceIdFor('rent', '2026-11-05')).toBe('rent:2026-11-05');
  });
  it('allows explicit unpaid status while retaining the linked transaction as pending', () => {
    const data = occurrenceData();
    data.paymentOccurrences = [
      {
        id: 'rent:2026-11-05',
        ruleId: 'rent',
        originalDueDate: '2026-11-05',
        status: 'explicitly_unpaid',
        paymentTransactionId: 'rent-payment',
        paymentDate: '2026-11-05',
        paymentAmount: 200_000,
        history: [
          { action: 'assumed', at: '2026-11-05T00:00:00Z' },
          { action: 'marked_unpaid', at: '2026-11-06T00:00:00Z' },
        ],
      },
    ];
    data.transactions[0] = {
      ...data.transactions[0],
      cashStatus: 'pending',
      dueDate: '2026-11-05',
      confirmationStatus: 'not_applicable',
    };
    expect(appDataSchema.safeParse(data).success).toBe(true);
  });
  it('requires image-derived records to pass OCR review before they enter persisted transactions', () => {
    const data = emptyAppData();
    data.transactions = [
      {
        id: 'capture',
        type: 'expense',
        amount: 8_000,
        currency: 'MMK',
        date: '2026-11-05',
        categoryId: null,
        counterpartyId: null,
        cashStatus: 'settled',
        confirmationStatus: 'not_applicable',
        source: 'receipt_image',
        ocrReviewStatus: 'pending_review',
        createdAt: '2026-11-05T00:00:00Z',
        updatedAt: '2026-11-05T00:00:00Z',
      },
    ];
    expect(appDataSchema.safeParse(data).success).toBe(false);
  });
});
