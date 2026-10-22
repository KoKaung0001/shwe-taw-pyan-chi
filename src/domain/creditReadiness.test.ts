import { describe, expect, it } from 'vitest';
import {
  bankChecklistKey,
  calculateFlowScore,
  evaluateBankReadiness,
  readinessBanks,
} from './creditReadiness';
import { emptyAppData, type Transaction } from './types';

const today = '2026-10-22';

function record(
  id: string,
  date: string,
  options: Partial<Transaction> = {},
): Transaction {
  return {
    id,
    type: 'income',
    amount: 10_000,
    currency: 'MMK',
    date,
    categoryId: null,
    description: id,
    counterpartyId: null,
    cashStatus: 'settled',
    confirmationStatus: 'not_applicable',
    source: 'manual',
    ocrReviewStatus: 'not_applicable',
    createdAt: `${date}T12:00:00Z`,
    updatedAt: `${date}T12:00:00Z`,
    ...options,
  };
}

function yearOfRecords() {
  return Array.from({ length: 12 }, (_, index) => {
    const date = new Date(Date.UTC(2025, 10 + index, 15))
      .toISOString()
      .slice(0, 10);
    return record(`month-${index}`, date);
  });
}

describe('bank-specific credit readiness', () => {
  it('defines six checklist items for each example bank', () => {
    expect(
      readinessBanks.map((bank) => [bank.id, bank.requirements.length]),
    ).toEqual([
      ['a_bank', 6],
      ['yoma', 6],
      ['mcb', 6],
    ]);
  });

  it('tracks self-reported items independently by bank', () => {
    const data = emptyAppData();
    const key = bankChecklistKey('a_bank', 'personal_kyc');
    data.checklist[key] = true;
    const aBank = evaluateBankReadiness(data, 'a_bank', today);
    const yoma = evaluateBankReadiness(data, 'yoma', today);
    expect(aBank.requirements[0].status).toBe('self_reported');
    expect(aBank.completionPercent).toBe(17);
    expect(yoma.requirements[0].status).toBe('incomplete');
  });

  it('requires transaction coverage across all 12 months for A Bank and Yoma alternatives', () => {
    const shortHistory = [record('current', today)];
    const aBank = evaluateBankReadiness(
      { ...emptyAppData(), transactions: shortHistory },
      'a_bank',
      today,
    );
    const yoma = evaluateBankReadiness(
      { ...emptyAppData(), transactions: shortHistory },
      'yoma',
      today,
    );
    expect(
      aBank.requirements.find((item) => item.id === 'financial_statements')
        ?.status,
    ).toBe('incomplete');
    expect(
      aBank.requirements.find((item) => item.id === 'bank_statements')?.status,
    ).toBe('incomplete');
    expect(
      yoma.requirements.find((item) => item.id === 'sales_purchase_vouchers')
        ?.status,
    ).toBe('incomplete');

    const fullHistory = yearOfRecords();
    expect(
      evaluateBankReadiness(
        { ...emptyAppData(), transactions: fullHistory },
        'a_bank',
        today,
      ).requirements.find((item) => item.id === 'financial_statements')?.status,
    ).toBe('app_alternative');
    expect(
      evaluateBankReadiness(
        { ...emptyAppData(), transactions: fullHistory },
        'yoma',
        today,
      ).requirements.find((item) => item.id === 'sales_purchase_vouchers')
        ?.status,
    ).toBe('app_alternative');
  });

  it('allows MCB income-proof alternative at six active months without satisfying bank statements', () => {
    const transactions = Array.from({ length: 6 }, (_, index) =>
      record(
        `month-${index}`,
        new Date(Date.UTC(2026, index + 4, 15)).toISOString().slice(0, 10),
      ),
    );
    const evaluation = evaluateBankReadiness(
      { ...emptyAppData(), transactions },
      'mcb',
      today,
    );
    expect(evaluation.flowScore.score).not.toBeNull();
    expect(
      evaluation.requirements.find((item) => item.id === 'profit_loss')?.status,
    ).toBe('app_alternative');
    expect(
      evaluation.requirements.find((item) => item.id === 'bank_statements')
        ?.status,
    ).toBe('incomplete');
  });
});

describe('app-only FlowScore', () => {
  it('calculates all four equally weighted components from settled records', () => {
    const transactions = yearOfRecords().map((item, index) => ({
      ...item,
      source: index === 0 ? ('receipt_image' as const) : ('manual' as const),
      ocrReviewStatus:
        index === 0 ? ('reviewed' as const) : ('not_applicable' as const),
    }));
    const result = calculateFlowScore(transactions, today);
    expect(result.activeMonths).toBe(12);
    expect(result.score).toBe(77);
    expect(result.components).toEqual({
      historyCoverage: 100,
      incomeConsistency: 100,
      netCashFlowStability: 100,
      reviewedReceiptEvidence: 8,
    });
  });

  it('excludes pending records and withholds the score below six active months', () => {
    const fiveMonths = Array.from({ length: 5 }, (_, index) =>
      record(
        `month-${index}`,
        new Date(Date.UTC(2026, index + 5, 15)).toISOString().slice(0, 10),
      ),
    );
    const pending = record('pending', '2026-03-15', {
      cashStatus: 'pending',
      dueDate: '2026-10-23',
    });
    expect(
      calculateFlowScore([...fiveMonths, pending], today).score,
    ).toBeNull();
    expect(
      calculateFlowScore([...fiveMonths, record('sixth', '2026-04-15')], today)
        .score,
    ).not.toBeNull();
  });

  it('scores reviewed receipt evidence only from reviewed capture records', () => {
    const transactions = yearOfRecords().map((item, index) => ({
      ...item,
      source:
        index === 0 || index === 1
          ? ('screenshot' as const)
          : ('manual' as const),
      ocrReviewStatus:
        index === 0
          ? ('reviewed' as const)
          : index === 1
            ? ('pending_review' as const)
            : ('not_applicable' as const),
    }));
    expect(
      calculateFlowScore(transactions, today).components
        .reviewedReceiptEvidence,
    ).toBe(8);
  });
});
