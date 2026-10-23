import { describe, expect, it } from 'vitest';
import { createSeedData } from './seedData';
import { appDataSchema } from './types';
import { calculateFlowScore } from './creditReadiness';

describe('November 2025 to October 2026 demo dataset', () => {
  it('produces the documented settled income and expense totals', () => {
    const data = createSeedData();
    const income = data.transactions.filter((item) => item.type === 'income').reduce((sum, item) => sum + item.amount, 0);
    const expenses = data.transactions.filter((item) => item.type === 'expense').reduce((sum, item) => sum + item.amount, 0);

    expect(data.openingBalance).toBeNull();
    expect(data.transactions).toHaveLength(43);
    expect(new Set(data.transactions.map((item) => item.id)).size).toBe(43);
    expect(data.transactions.every((item) => item.cashStatus === 'settled' && item.occurredAt)).toBe(true);
    expect(income).toBe(7_852_000);
    expect(expenses).toBe(4_201_000);
    expect(data.balanceAdjustments).toHaveLength(0);
    expect(income - expenses).toBe(3_651_000);
    expect(appDataSchema.safeParse(data).success).toBe(true);
    expect(data.receivables.filter((item) => item.status === 'unpaid')).toHaveLength(2);
    const paid = data.receivables.find((item) => item.status === 'paid')!;
    expect(data.transactions.find((item) => item.id === paid.linkedIncomeTransactionId))
      .toMatchObject({ type: 'income', amount: paid.amount, cashStatus: 'settled' });
    expect(calculateFlowScore(data.transactions, '2026-10-23'))
      .toMatchObject({ activeMonths: 12, reviewedReceiptCount: 26, transactionCount: 43, score: 77 });
  });

  it('returns the same deterministic record IDs, dates, and values on every call', () => {
    expect(createSeedData().transactions).toEqual(createSeedData().transactions);
  });
});
