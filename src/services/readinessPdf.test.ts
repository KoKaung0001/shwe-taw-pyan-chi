import { describe, expect, it } from 'vitest';
import { evaluateBankReadiness, readinessBanks } from '../domain/creditReadiness';
import { createSeedData } from '../domain/seedData';
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
    expect(pdf).toContain('FlowCredit Readiness Report');
    expect(pdf).toContain('APP-ONLY FLOWSCORE');
    expect(pdf).toContain(
      'Unavailable: settled records span 0 distinct months',
    );
    expect(pdf).toContain('have not been confirmed by');
    expect(pdf).toContain('the lenders.');
    expect(pdf).toContain('does not establish lender acceptance');
    expect(pdf).toContain('startxref');
  });
  for (const bank of readinessBanks) {
    for (const populated of [false, true]) {
      it(`fits ${bank.name} on one page with ${populated ? 'full' : 'no'} history`, () => {
        const data = populated ? createSeedData() : emptyAppData();
        const evaluation = evaluateBankReadiness(data, bank.id, '2026-10-23');
        const pdf = new TextDecoder().decode(buildReadinessPdf(evaluation));
        expect(pdf).toContain('/MediaBox [0 0 595 842]');
        expect(pdf).toContain('/Count 1');
        for (const requirement of evaluation.requirements) expect(pdf).toContain(requirement.title);
        expect(pdf).toContain('Each component contributes 25%');
        expect(pdf).toContain('Receipt/screenshot evidence:');
        expect(pdf).toContain(populated ? 'APP ALTERNATIVE' : 'Score unavailable');
        const xref = Number(pdf.match(/startxref\n(\d+)/)?.[1]);
        expect(pdf.slice(xref, xref + 4)).toBe('xref');
      });
    }
  }
});
