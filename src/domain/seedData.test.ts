import { describe, expect, it } from 'vitest';
import { createSeedData } from './seedData';

describe('fixed October demo dataset', () => {
  it('produces the documented settled income and expense totals', () => {
    const data = createSeedData();
    const income = data.transactions.filter((item) => item.type === 'income').reduce((sum, item) => sum + item.amount, 0);
    const expenses = data.transactions.filter((item) => item.type === 'expense').reduce((sum, item) => sum + item.amount, 0);

    expect(data.openingBalance).toBeNull();
    expect(data.transactions).toHaveLength(21);
    expect(new Set(data.transactions.map((item) => item.id)).size).toBe(21);
    expect(data.transactions.every((item) => item.cashStatus === 'settled' && item.occurredAt)).toBe(true);
    expect(income).toBe(1_750_000);
    expect(expenses).toBe(663_000);
    expect(data.balanceAdjustments).toHaveLength(0);
    expect(income - expenses).toBe(1_087_000);
  });

  it('returns the same deterministic record IDs, dates, and values on every call', () => {
    expect(createSeedData().transactions).toEqual(createSeedData().transactions);
  });
});
