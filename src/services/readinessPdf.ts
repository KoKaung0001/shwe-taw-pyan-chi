import type { BankReadinessEvaluation } from '../domain/creditReadiness';

function pdfText(value: string) {
  return value
    .replace(/[^\x20-\x7e]/g, '?')
    .replace(/\\/g, '\\\\')
    .replace(/\(/g, '\\(')
    .replace(/\)/g, '\\)');
}

function wrapLine(value: string, maxLength = 88) {
  const words = value.split(/\s+/);
  const lines: string[] = [];
  let line = '';
  for (const word of words) {
    if (line && `${line} ${word}`.length > maxLength) {
      lines.push(line);
      line = word;
    } else {
      line = line ? `${line} ${word}` : word;
    }
  }
  if (line) lines.push(line);
  return lines;
}

function reportLines(evaluation: BankReadinessEvaluation) {
  const { bank, requirements, completionPercent, summary, flowScore } =
    evaluation;
  const money = (amount: number) => `${amount.toLocaleString('en-US')} MMK`;
  const lines = [
    'SHWE TAW PYAN CHI | FLOWCREDIT READINESS REPORT',
    `${bank.name} - ${bank.subtitle}`,
    `Checklist readiness: ${completionPercent}% (${requirements.filter((item) => item.status !== 'incomplete').length} of 6 items)`,
    `Report period: ${summary.range.startDate} to ${summary.range.endDate}`,
    `Transaction months with settled activity: ${summary.activeMonths} of 12`,
    `Settled income: ${money(summary.income)} | Expenses: ${money(summary.expenses)} | Net: ${money(summary.net)}`,
    `Settled records: ${summary.transactionCount} | Receipt/screenshot records: ${summary.receiptEvidenceCount} (${summary.reviewedReceiptCount} reviewed)`,
    `First and last settled records: ${summary.firstRecordDate ?? 'None'} to ${summary.lastRecordDate ?? 'None'}`,
    '',
    'BANK CHECKLIST',
  ];

  for (const item of requirements) {
    const status =
      item.status === 'self_reported'
        ? 'USER REPORTED AVAILABLE'
        : item.status === 'app_alternative'
          ? 'APP-GENERATED ALTERNATIVE AVAILABLE'
          : 'INCOMPLETE';
    lines.push(`${status} - ${item.title}: ${item.detail}`);
  }

  lines.push('', 'APP-ONLY FLOWSCORE');
  if (flowScore.score === null) {
    lines.push(
      `Unavailable: settled records span ${flowScore.activeMonths} distinct months; at least 6 are needed.`,
    );
  } else {
    lines.push(
      `FlowScore: ${flowScore.score}/100 (not a bank score or approval prediction).`,
    );
  }
  lines.push(
    `History coverage: ${flowScore.components.historyCoverage}/100`,
    `Monthly income consistency: ${flowScore.components.incomeConsistency}/100`,
    `Net cash-flow stability: ${flowScore.components.netCashFlowStability}/100`,
    `Reviewed receipt evidence: ${flowScore.components.reviewedReceiptEvidence}/100`,
    '',
    'LIMITATIONS',
    'Bank requirements shown here are user-provided examples and have not been confirmed by the lenders.',
    'App-generated summaries use settled records only. Receipt images are not included. User-marked items are self-reported.',
    'This report does not establish lender acceptance, creditworthiness, or loan approval.',
  );
  return lines.flatMap((line) => wrapLine(line));
}

/** Build a one-page, text-only PDF without uploading or persisting user data. */
export function buildReadinessPdf(
  evaluation: BankReadinessEvaluation,
): Uint8Array {
  const contentLines = reportLines(evaluation);
  const commands = ['BT', '/F1 9 Tf', '50 754 Td', '12 TL'];
  for (const [index, line] of contentLines.entries()) {
    if (index > 0) commands.push('T*');
    commands.push(`(${pdfText(line)}) Tj`);
  }
  commands.push('ET');
  const stream = commands.join('\n');
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
    `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`,
  ];
  let pdf = '%PDF-1.4\n';
  const offsets = [0];
  for (const [index, object] of objects.entries()) {
    offsets.push(pdf.length);
    pdf += `${index + 1} 0 obj\n${object}\nendobj\n`;
  }
  const xrefOffset = pdf.length;
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (const offset of offsets.slice(1))
    pdf += `${String(offset).padStart(10, '0')} 00000 n \n`;
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;
  return Uint8Array.from(pdf, (character) => character.charCodeAt(0));
}

export function downloadReadinessPdf(evaluation: BankReadinessEvaluation) {
  const bytes = buildReadinessPdf(evaluation);
  const blob = new Blob([bytes.slice().buffer as ArrayBuffer], {
    type: 'application/pdf',
  });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `flowcredit-${evaluation.bank.id}-readiness.pdf`;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
}
