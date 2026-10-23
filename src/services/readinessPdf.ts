import type { BankReadinessEvaluation } from '../domain/creditReadiness';

const palette = {
  ink: '#111827', muted: '#526174', blue: '#3157C8', lavender: '#D7CCFF',
  paper: '#F4F4F2', white: '#FFFFFF', slate: '#262B33', canvas: '#1E2229', line: '#D8DCE2',
};

function pdfText(value: string) {
  return value.replace(/[–—]/g, '-').replace(/·/g, '|')
    .replace(/[^\x20-\x7e]/g, '?')
    .replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');
}

function wrapLine(value: string, maxLength: number) {
  const lines: string[] = [];
  let line = '';
  for (const word of value.split(/\s+/)) {
    if (line && `${line} ${word}`.length > maxLength) {
      lines.push(line);
      line = word;
    } else line = line ? `${line} ${word}` : word;
  }
  if (line) lines.push(line);
  return lines;
}

/** A4 summary with selectable text and no external font requests. */
export function buildReadinessPdf(evaluation: BankReadinessEvaluation): Uint8Array {
  const { bank, requirements, completionPercent, summary, flowScore } = evaluation;
  const commands: string[] = [];
  const rgb = (hex: string) => [1, 3, 5].map((offset) => (parseInt(hex.slice(offset, offset + 2), 16) / 255).toFixed(4)).join(' ');
  const text = (value: string, x: number, y: number, size = 9, color = palette.ink, bold = false) => {
    commands.push(`BT /${bold ? 'F2' : 'F1'} ${size} Tf ${rgb(color)} rg 1 0 0 1 ${x} ${842 - y} Tm (${pdfText(value)}) Tj ET`);
  };
  const rect = (x: number, y: number, width: number, height: number, color: string) => {
    commands.push(`${rgb(color)} rg ${x} ${842 - y - height} ${width} ${height} re f`);
  };
  const rule = (y: number, x = 36, width = 523) => rect(x, y, width, 0.6, palette.line);
  const paragraph = (value: string, x: number, y: number, maxLength: number, size = 9, color = palette.muted) => {
    const lines = wrapLine(value, maxLength);
    lines.forEach((line, index) => text(line, x, y + index * 11, size, color));
    return lines.length;
  };
  const money = (amount: number) => amount.toLocaleString('en-US');

  rect(0, 0, 595, 842, palette.white);
  rect(24, 24, 547, 116, palette.slate);
  rect(30, 30, 535, 104, palette.canvas);
  text('SHWE TAW', 44, 49, 10, '#A9BCFF', true);
  text('PYAN CHI', 109, 49, 10, palette.lavender, true);
  text('APP-GENERATED / SUMMARY ONLY', 356, 49, 8, palette.white);
  text('FlowCredit Readiness Report', 44, 79, 22, palette.white);
  text(bank.name, 44, 100, 11, palette.white, true);
  text(bank.subtitle, 44, 117, 9, '#CBD5E1');

  text('01 / CASH MOVEMENT', 36, 163, 9, palette.blue, true);
  text(`Report period: ${summary.range.startDate} to ${summary.range.endDate}`, 286, 163, 9, palette.muted);
  const metrics = [['SETTLED INCOME / MMK', summary.income], ['SETTLED EXPENSES / MMK', summary.expenses], ['NET MOVEMENT / MMK', summary.net]] as const;
  metrics.forEach(([label, value], index) => {
    const x = 36 + index * 179;
    rect(x, 177, 165, 54, palette.paper);
    text(label, x + 10, 194, 8, palette.muted, true);
    const formatted = money(value);
    text(formatted, x + 10, 217, formatted.length > 17 ? 11 : 15, palette.ink, true);
  });
  text(`Activity: ${summary.activeMonths}/12 months  |  ${summary.transactionCount} settled records`, 36, 249, 9);
  text(`Receipt/screenshot evidence: ${summary.receiptEvidenceCount} records (${summary.reviewedReceiptCount} reviewed)`, 36, 263, 9);
  text(`First / last settled record: ${summary.firstRecordDate ?? 'None'} / ${summary.lastRecordDate ?? 'None'}`, 36, 277, 9, palette.muted);

  rule(291);
  text('02 / BANK DOCUMENT CHECKLIST', 36, 310, 10, palette.blue, true);
  const completeCount = requirements.filter((item) => item.status !== 'incomplete').length;
  text(`${completionPercent}% ready | ${completeCount} of 6 items`, 421, 310, 9, palette.ink, true);
  text('Example requirements; availability does not mean lender acceptance.', 36, 325, 8.5, palette.muted);
  rect(36, 335, 523, 3, palette.paper);
  rect(36, 335, 523 * completionPercent / 100, 3, palette.blue);
  let rowY = 351;
  requirements.forEach((item, index) => {
    const detailLines = wrapLine(item.detail, 69);
    const rowHeight = Math.max(43, 24 + detailLines.length * 11);
    text(String(index + 1).padStart(2, '0'), 36, rowY + 10, 9, palette.blue, true);
    text(item.title, 58, rowY + 10, 10, palette.ink, true);
    detailLines.forEach((line, lineIndex) => text(line, 58, rowY + 24 + lineIndex * 11, 8.5, palette.muted));
    const status = item.status === 'self_reported' ? 'SELF-REPORTED' : item.status === 'app_alternative' ? 'APP ALTERNATIVE' : 'INCOMPLETE';
    rect(441, rowY, 118, 20, item.status === 'app_alternative' ? '#EEE9FF' : palette.paper);
    text(status, 449, rowY + 13, 8, item.status === 'app_alternative' ? '#49378A' : palette.ink, true);
    rule(rowY + rowHeight - 5, 58, 501);
    rowY += rowHeight;
  });

  const scoreY = rowY + 8;
  text('03 / APP-ONLY FLOWSCORE', 36, scoreY, 10, palette.blue, true);
  text(flowScore.score === null ? 'Score unavailable' : `${flowScore.score}/100`, 441, scoreY, 12, palette.ink, true);
  text('Not a bank score or approval prediction. Each component contributes 25%.', 36, scoreY + 16, 8.5, palette.muted);
  if (flowScore.score === null) {
    text(`Unavailable: settled records span ${flowScore.activeMonths} distinct months; at least 6 are needed.`, 36, scoreY + 30, 8.5, palette.muted);
  }
  const componentY = scoreY + (flowScore.score === null ? 46 : 34);
  const components = [
    ['History coverage', flowScore.components.historyCoverage],
    ['Income consistency', flowScore.components.incomeConsistency],
    ['Net cash-flow stability', flowScore.components.netCashFlowStability],
    ['Reviewed evidence', flowScore.components.reviewedReceiptEvidence],
  ] as const;
  components.forEach(([label, value], index) => {
    const x = 36 + index * 134;
    text(label, x, componentY, 8, palette.muted);
    text(`${value}/100`, x, componentY + 17, 11, palette.ink, true);
    rect(x, componentY + 24, 118, 3, palette.paper);
    rect(x, componentY + 24, 118 * value / 100, 3, palette.blue);
  });

  const limitsY = componentY + 45;
  rule(limitsY - 4);
  text('READ BEFORE SUBMITTING', 36, limitsY + 10, 8, palette.ink, true);
  paragraph('Bank requirements are user-provided examples and have not been confirmed by the lenders. App alternatives are not audited statements. Confirm required documents directly with the bank.', 36, limitsY + 24, 112, 8);
  paragraph('Settled records only; missing history is not estimated. Receipt images are not included or stored. Document availability is self-reported. This report does not establish lender acceptance, creditworthiness, or loan approval.', 36, limitsY + 48, 112, 8);
  if (limitsY + 59 > 812) throw new Error('Readiness report exceeds its one-page layout.');
  text('SHWE TAW PYAN CHI / LOAN APPLICATION KIT', 36, 826, 7, palette.muted);
  text('SUMMARY ONLY   |   1 / 1', 451, 826, 7, palette.muted);

  const stream = commands.join('\n');
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R /F2 6 0 R >> >> /Contents 5 0 R >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
    `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`,
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>',
  ];
  let pdf = '%PDF-1.4\n';
  const offsets = [0];
  for (const [index, object] of objects.entries()) {
    offsets.push(pdf.length);
    pdf += `${index + 1} 0 obj\n${object}\nendobj\n`;
  }
  const xrefOffset = pdf.length;
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (const offset of offsets.slice(1)) pdf += `${String(offset).padStart(10, '0')} 00000 n \n`;
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;
  return Uint8Array.from(pdf, (character) => character.charCodeAt(0));
}

export function downloadReadinessPdf(evaluation: BankReadinessEvaluation) {
  const bytes = buildReadinessPdf(evaluation);
  const blob = new Blob([bytes.slice().buffer as ArrayBuffer], { type: 'application/pdf' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `flowcredit-${evaluation.bank.id}-readiness.pdf`;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
}
