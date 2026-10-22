import { describe, expect, it } from 'vitest';
import {
  buildRecordChecks,
  readinessDocumentIds,
  suggestCategory,
} from './readiness';
import { emptyAppData } from './types';

describe('record readiness', () => {
  it('reports explicit record checks without assigning a score', () => {
    const checks = buildRecordChecks(emptyAppData());
    expect(checks.map(({ id, complete }) => [id, complete])).toEqual([
      ['income_records', false],
      ['expense_records', false],
      ['receipt_evidence', false],
      ['transaction_complete', false],
      ['identity_document', false],
      ['invoice_payment_evidence', false],
    ]);
  });

  it('tracks only the two user-reported document availability items', () => {
    expect(readinessDocumentIds).toEqual(['identity_document', 'invoice_payment_evidence']);
  });
});

describe('category suggestions', () => {
  const categories = emptyAppData().categories;

  it('suggests the strongest matching category for the selected transaction type', () => {
    expect(suggestCategory('Taxi delivery fuel', 'expense', categories)).toBe(
      'transport',
    );
    expect(suggestCategory('Client project', 'income', categories)).toBe(
      'client-income',
    );
  });

  it('does not suggest a category of the wrong type or for unmatched text', () => {
    expect(suggestCategory('Rent', 'income', categories)).toBeNull();
    expect(
      suggestCategory('miscellaneous note', 'expense', categories),
    ).toBeNull();
    expect(suggestCategory('', 'expense', categories)).toBeNull();
  });
});
