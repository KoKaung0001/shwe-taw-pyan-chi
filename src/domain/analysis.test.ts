import { describe, expect, it } from 'vitest';
import {
  answerRecordedQuestion,
  findPossibleDuplicates,
} from './analysis';
import { appDataSchema, emptyAppData, type Transaction } from './types';

const transaction = (
  overrides: Partial<Transaction> & Pick<Transaction, 'id'>,
): Transaction => ({
  type: 'expense',
  amount: 20_000,
  currency: 'MMK',
  date: '2026-10-10',
  categoryId: 'supplies',
  counterpartyId: null,
  cashStatus: 'settled',
  confirmationStatus: 'not_applicable',
  source: 'manual',
  ocrReviewStatus: 'not_applicable',
  createdAt: '2026-10-10T00:00:00Z',
  updatedAt: '2026-10-10T00:00:00Z',
  ...overrides,
});

describe('rule-based analysis', () => {
  it('grounds purchase roasts in settled month-to-date movement without counting pending income', () => {
    const data = { ...emptyAppData(), transactions: [
      transaction({ id: 'income', type: 'income', amount: 200_000 }),
      transaction({ id: 'expense', amount: 80_000 }),
      transaction({ id: 'pending', type: 'income', amount: 900_000, cashStatus: 'pending', dueDate: '2026-10-25' }),
      transaction({ id: 'old', type: 'income', amount: 700_000, date: '2026-09-10' }),
    ] };
    const answer = answerRecordedQuestion(data, '2026-10-23', 'Can I buy headphones for 150,000 MMK and last the month?');
    expect(answer).toMatchObject({ messageKey: 'chat.purchaseOverNet', values: { price: 150_000, income: 200_000, expenses: 80_000, net: 120_000, after: -30_000 } });
    expect(answer.evidence.map((item) => item.id).sort()).toEqual(['expense', 'income']);
    expect(answerRecordedQuestion(data, '2026-10-23', 'Can I afford headphones for 50k?')).toMatchObject({ messageKey: 'chat.purchaseWithinNet', values: { price: 50_000, after: 70_000 } });
    expect(answerRecordedQuestion(data, '2026-10-23', 'Roast my spending')).toMatchObject({ messageKey: 'chat.periodAnswer', values: { net: 120_000 } });
  });

  it('asks for a price rather than inventing one, and handles missing records', () => {
    expect(answerRecordedQuestion(emptyAppData(), '2026-10-23', 'Can I buy this?').messageKey).toBe('chat.purchasePriceNeeded');
    expect(answerRecordedQuestion(emptyAppData(), '2026-10-23', 'Can I buy this for 150k?').messageKey).toBe('chat.noTransactionsAnswer');
    expect(answerRecordedQuestion(emptyAppData(), '2026-10-23', 'Can I buy this for 10k or 20k?').messageKey).toBe('chat.purchasePriceNeeded');
  });
  it('finds strong duplicate matches, remembers Keep both, and reopens changed versions', () => {
    const first = transaction({ id: 'manual-1', description: 'Shop supplies' });
    const second = transaction({
      id: 'receipt-1',
      source: 'receipt_image',
      ocrReviewStatus: 'reviewed',
      description: ' shop   supplies ',
    });
    const data = { ...emptyAppData(), transactions: [first, second] };
    const [candidate] = findPossibleDuplicates(data);
    expect(candidate).toBeDefined();
    const reviewed = {
      ...data,
      duplicateReviews: [
        {
          id: 'review-1',
          firstTransactionId: candidate.first.id,
          secondTransactionId: candidate.second.id,
          fingerprint: candidate.fingerprint,
          resolution: 'keep_both' as const,
          reviewedAt: '2026-10-21T00:00:00Z',
        },
      ],
    };
    expect(findPossibleDuplicates(reviewed)).toEqual([]);
    expect(
      findPossibleDuplicates({
        ...reviewed,
        transactions: reviewed.transactions.map((item) =>
          item.id === 'receipt-1'
            ? { ...item, updatedAt: '2026-10-22T00:00:00Z' }
            : item,
        ),
      }),
    ).toHaveLength(1);
  });

  it('validates a persisted duplicate-removed outcome after the selected record is deleted', () => {
    const retained = transaction({
      id: 'keep',
      description: 'Market supplies',
    });
    expect(
      appDataSchema.parse({
        ...emptyAppData(),
        transactions: [retained],
        duplicateReviews: [
          {
            id: 'review-removed',
            firstTransactionId: 'keep',
            secondTransactionId: 'removed',
            fingerprint: 'f00ba123',
            resolution: 'duplicate_removed',
            redundantTransactionId: 'removed',
            reviewedAt: '2026-10-21T00:00:00Z',
          },
        ],
      }).duplicateReviews,
    ).toHaveLength(1);
  });

  it('declines forecast and balance projection questions', () => {
    const answer = answerRecordedQuestion(
      { ...emptyAppData(), openingBalance: { amount: 500_000, referenceAt: '2026-10-01T00:00:00Z', timeZone: 'Asia/Rangoon' } },
      '2026-10-21',
      'Will my balance have a shortfall in the forecast?',
    );
    expect(answer.supported).toBe(false);
    expect(answer.messageKey).toBe('chat.unsupportedAnswer');
  });
  it('answers supported questions from current records and declines advice requests', () => {
    const data = {
      ...emptyAppData(),
      transactions: [
        transaction({
          id: 'expense-1',
          amount: 45_000,
          date: '2026-10-14',
          description: 'Market stock',
        }),
      ],
    };
    const answer = answerRecordedQuestion(
      data,
      '2026-10-21',
      'What is my top expense this month?',
    );
    expect(answer).toMatchObject({
      supported: true,
      messageKey: 'chat.topExpenseAnswer',
      values: { amount: 45_000 },
    });
    expect(answer.evidence[0].id).toBe('expense-1');
    expect(
      answerRecordedQuestion(
        data,
        '2026-10-21',
        'What documents are available?',
      ),
    ).toMatchObject({
      supported: true,
      messageKey: 'chat.documentsAnswer',
      values: { completed: 0, total: 2 },
    });
    expect(
      answerRecordedQuestion(data, '2026-10-21', 'Will I get a loan?')
        .supported,
    ).toBe(false);
  });

  it('answers the required weekly questions from the Monday-to-Sunday range', () => {
    const data = {
      ...emptyAppData(),
      transactions: [
        transaction({ id: 'week-income', type: 'income', amount: 80_000, date: '2026-10-19', categoryId: 'client-income' }),
        transaction({ id: 'week-expense', type: 'expense', amount: 12_000, date: '2026-10-20', categoryId: 'transport' }),
      ],
      receivables: [{ id: 'week-receivable', amount: 30_000, currency: 'MMK' as const, date: '2026-10-18', counterparty: 'Customer', categoryId: 'sales', status: 'unpaid' as const, createdAt: '2026-10-18T00:00:00Z', updatedAt: '2026-10-18T00:00:00Z' }],
    };
    expect(answerRecordedQuestion(data, '2026-10-21', 'What is my income this week?')).toMatchObject({ messageKey: 'chat.weeklyIncomeAnswer', values: { amount: 80_000, startDate: '2026-10-19', endDate: '2026-10-25' } });
    expect(answerRecordedQuestion(data, '2026-10-21', 'How much did I spend this week?')).toMatchObject({ messageKey: 'chat.weeklyExpensesAnswer', values: { amount: 12_000 } });
    expect(answerRecordedQuestion(data, '2026-10-21', 'What is my highest expense category this week?')).toMatchObject({ messageKey: 'chat.weeklyCategoryAnswer', values: { category: 'transport', amount: 12_000 } });
    expect(answerRecordedQuestion(data, '2026-10-21', 'How much do I have in outstanding receivables?')).toMatchObject({ messageKey: 'chat.receivablesAnswer', values: { amount: 30_000, count: 1 } });
  });
});
