import { describe, expect, it } from 'vitest';
import { evaluateBankReadiness } from '../domain/creditReadiness';
import { emptyAppData } from '../domain/types';
import { buildReadinessPdf } from './readinessPdf';

describe('readiness PDF', () => {
  it('builds a one-page English summary with limits when the FlowScore is unavailable', () => {
    const evaluation = evaluateBankReadiness(
      emptyAppData(),
      'a_bank',
      '2026-10-22',
    );
    const pdf = new TextDecoder().decode(buildReadinessPdf(evaluation));
    expect(pdf.startsWith('%PDF-1.4')).toBe(true);
    expect(pdf).toContain('/Count 1');
    expect(pdf).toContain('SHWE TAW PYAN CHI | FLOWCREDIT READINESS REPORT');
    expect(pdf).toContain('APP-ONLY FLOWSCORE');
    expect(pdf).toContain(
      'Unavailable: settled records span 0 distinct months',
    );
    expect(pdf).toContain('have not been confirmed by');
    expect(pdf).toContain('(the lenders.) Tj');
    expect(pdf).toContain('does not establish lender acceptance');
    expect(pdf).toContain('startxref');
  });
});
