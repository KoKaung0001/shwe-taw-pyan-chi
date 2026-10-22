import type { AppData, Transaction } from './types';

export type ReadinessBankId = 'a_bank' | 'yoma' | 'mcb';

export type BankRequirementId =
  | 'personal_kyc'
  | 'business_status'
  | 'tax_history'
  | 'financial_statements'
  | 'bank_statements'
  | 'business_photos'
  | 'business_license'
  | 'tax_receipts'
  | 'sales_purchase_vouchers'
  | 'tax_documents'
  | 'profit_loss';

export type RequirementProof =
  'self_reported' | 'cash_flow_summary' | 'voucher_summary' | 'flow_score';

export interface BankRequirement {
  id: BankRequirementId;
  title: string;
  detail: string;
  proof: RequirementProof;
}

export interface BankDefinition {
  id: ReadinessBankId;
  name: string;
  subtitle: string;
  requirements: readonly BankRequirement[];
}

export const readinessBanks: readonly BankDefinition[] = [
  {
    id: 'a_bank',
    name: 'A Bank',
    subtitle: 'Metro Development / Microfinance Loan',
    requirements: [
      {
        id: 'personal_kyc',
        title: 'Personal KYC',
        detail: 'NRC and household list copies.',
        proof: 'self_reported',
      },
      {
        id: 'business_status',
        title: 'Business status',
        detail: 'Valid business license or MSME Agency recommendation.',
        proof: 'self_reported',
      },
      {
        id: 'tax_history',
        title: 'Tax and business history',
        detail: 'Tax payment or clearance evidence and business history.',
        proof: 'self_reported',
      },
      {
        id: 'financial_statements',
        title: 'Financial statement',
        detail:
          'Financial statement for 1 to 3 years; an app cash-flow summary is an example alternative.',
        proof: 'cash_flow_summary',
      },
      {
        id: 'bank_statements',
        title: 'Bank statements',
        detail:
          'CB Bank: 6 months; other banks: 1 year. The example alternative is an app cash-flow summary.',
        proof: 'cash_flow_summary',
      },
      {
        id: 'business_photos',
        title: 'Photos',
        detail: 'Applicant, business, and collateral photos.',
        proof: 'self_reported',
      },
    ],
  },
  {
    id: 'yoma',
    name: 'Yoma Bank',
    subtitle: 'SME Business Loan',
    requirements: [
      {
        id: 'personal_kyc',
        title: 'Borrower identity',
        detail: 'NRC, family registration list, and ward recommendation.',
        proof: 'self_reported',
      },
      {
        id: 'business_license',
        title: 'Business license',
        detail: 'Valid business license.',
        proof: 'self_reported',
      },
      {
        id: 'tax_receipts',
        title: 'Tax receipts',
        detail: 'Revenue tax receipts.',
        proof: 'self_reported',
      },
      {
        id: 'financial_statements',
        title: 'Financial statements',
        detail: 'Audited financial statements.',
        proof: 'self_reported',
      },
      {
        id: 'bank_statements',
        title: 'Bank statements',
        detail: 'Last 1 year of bank statements.',
        proof: 'self_reported',
      },
      {
        id: 'sales_purchase_vouchers',
        title: 'Transaction vouchers',
        detail:
          'Sales or purchase vouchers with 1-year summaries; an app summary is an example alternative.',
        proof: 'voucher_summary',
      },
    ],
  },
  {
    id: 'mcb',
    name: 'MCB Bank',
    subtitle: 'Myanmar Citizens Bank · MSME loans',
    requirements: [
      {
        id: 'personal_kyc',
        title: 'Personal KYC',
        detail: 'NRC, household list, and ward recommendation.',
        proof: 'self_reported',
      },
      {
        id: 'business_license',
        title: 'Business license',
        detail: 'Business license or DICA registration.',
        proof: 'self_reported',
      },
      {
        id: 'tax_documents',
        title: 'Tax documents',
        detail: 'Profit or income tax receipts for the last 3 years.',
        proof: 'self_reported',
      },
      {
        id: 'profit_loss',
        title: 'Profit and loss',
        detail:
          'Financial statements or balance sheet for the last 3 years; an app income summary and FlowScore are an example alternative.',
        proof: 'flow_score',
      },
      {
        id: 'bank_statements',
        title: 'Bank statements',
        detail: 'Current bank statements for the last 1 year.',
        proof: 'self_reported',
      },
      {
        id: 'business_photos',
        title: 'Business photos',
        detail: 'Photos of the business and shop location.',
        proof: 'self_reported',
      },
    ],
  },
];

export interface FlowScoreComponents {
  historyCoverage: number;
  incomeConsistency: number;
  netCashFlowStability: number;
  reviewedReceiptEvidence: number;
}

export interface FlowScoreResult {
  score: number | null;
  components: FlowScoreComponents;
  activeMonths: number;
  totalMonths: 12;
  range: { startDate: string; endDate: string };
  transactionCount: number;
  reviewedReceiptCount: number;
}

export interface ReadinessSummary {
  range: { startDate: string; endDate: string };
  income: number;
  expenses: number;
  net: number;
  transactionCount: number;
  activeMonths: number;
  totalMonths: 12;
  firstRecordDate: string | null;
  lastRecordDate: string | null;
  receiptEvidenceCount: number;
  reviewedReceiptCount: number;
}

export type RequirementStatus =
  'self_reported' | 'app_alternative' | 'incomplete';

export interface EvaluatedRequirement extends BankRequirement {
  status: RequirementStatus;
  checklistKey?: string;
}

export interface BankReadinessEvaluation {
  bank: BankDefinition;
  requirements: EvaluatedRequirement[];
  completionPercent: number;
  summary: ReadinessSummary;
  flowScore: FlowScoreResult;
}

function monthKey(date: string) {
  return date.slice(0, 7);
}

function monthStartShift(date: string, offset: number) {
  const [year, month] = date.split('-').map(Number);
  const shifted = new Date(Date.UTC(year, month - 1 + offset, 1));
  return `${shifted.getUTCFullYear()}-${String(shifted.getUTCMonth() + 1).padStart(2, '0')}-01`;
}

function getWindow(today: string) {
  return {
    startDate: monthStartShift(today, -11),
    endDate: today,
  };
}

function inWindow(
  transaction: Transaction,
  range: { startDate: string; endDate: string },
) {
  return (
    transaction.cashStatus === 'settled' &&
    transaction.date >= range.startDate &&
    transaction.date <= range.endDate
  );
}

function mean(values: readonly number[]) {
  return values.reduce((total, value) => total + value, 0) / values.length;
}

export function calculateFlowScore(
  transactions: readonly Transaction[],
  today: string,
): FlowScoreResult {
  const range = getWindow(today);
  const months = Array.from({ length: 12 }, (_, index) =>
    monthKey(monthStartShift(today, index - 11)),
  );
  const monthly = new Map(
    months.map((month) => [month, { income: 0, expenses: 0 }]),
  );
  const included = transactions.filter((transaction) =>
    inWindow(transaction, range),
  );

  for (const transaction of included) {
    const values = monthly.get(monthKey(transaction.date));
    if (!values) continue;
    values[transaction.type === 'income' ? 'income' : 'expenses'] +=
      transaction.amount;
  }

  const activeMonths = [...monthly.entries()].filter(
    ([, values]) => values.income > 0 || values.expenses > 0,
  ).length;
  const incomeValues = [...monthly.values()].map((values) => values.income);
  const averageIncome = mean(incomeValues);
  const variance = mean(
    incomeValues.map((value) => (value - averageIncome) ** 2),
  );
  const coefficientOfVariation =
    averageIncome > 0
      ? Math.sqrt(variance) / averageIncome
      : Number.POSITIVE_INFINITY;
  const incomeConsistency = Number.isFinite(coefficientOfVariation)
    ? 100 * (1 - Math.min(coefficientOfVariation, 1))
    : 0;
  const netStableMonths = [...monthly.values()].filter(
    (values) => values.income >= values.expenses,
  ).length;
  const receiptEvidence = included.filter(
    (transaction) =>
      transaction.source === 'receipt_image' ||
      transaction.source === 'screenshot',
  );
  const reviewedReceiptCount = receiptEvidence.filter(
    (transaction) => transaction.ocrReviewStatus === 'reviewed',
  ).length;

  const components: FlowScoreComponents = {
    historyCoverage: (activeMonths / 12) * 100,
    incomeConsistency,
    netCashFlowStability: (netStableMonths / 12) * 100,
    reviewedReceiptEvidence:
      included.length === 0
        ? 0
        : (reviewedReceiptCount / included.length) * 100,
  };

  return {
    score:
      activeMonths >= 6
        ? Math.round(
            (components.historyCoverage +
              components.incomeConsistency +
              components.netCashFlowStability +
              components.reviewedReceiptEvidence) /
              4,
          )
        : null,
    components: {
      historyCoverage: Math.round(components.historyCoverage),
      incomeConsistency: Math.round(components.incomeConsistency),
      netCashFlowStability: Math.round(components.netCashFlowStability),
      reviewedReceiptEvidence: Math.round(components.reviewedReceiptEvidence),
    },
    activeMonths,
    totalMonths: 12,
    range,
    transactionCount: included.length,
    reviewedReceiptCount,
  };
}

export function bankChecklistKey(
  bankId: ReadinessBankId,
  requirementId: BankRequirementId,
) {
  return `bank.${bankId}.${requirementId}`;
}

export function getBankDefinition(bankId: ReadinessBankId) {
  return readinessBanks.find((bank) => bank.id === bankId) ?? readinessBanks[0];
}

export function evaluateBankReadiness(
  data: AppData,
  bankId: ReadinessBankId,
  today: string,
): BankReadinessEvaluation {
  const bank = getBankDefinition(bankId);
  const range = getWindow(today);
  const transactions = data.transactions.filter((transaction) =>
    inWindow(transaction, range),
  );
  const monthsWithTransactions = new Set(
    transactions.map((transaction) => monthKey(transaction.date)),
  );
  const receiptEvidence = transactions.filter(
    (transaction) =>
      transaction.source === 'receipt_image' ||
      transaction.source === 'screenshot',
  );
  const reviewedReceiptCount = receiptEvidence.filter(
    (transaction) => transaction.ocrReviewStatus === 'reviewed',
  ).length;
  const flowScore = calculateFlowScore(data.transactions, today);
  const summary: ReadinessSummary = {
    range,
    income: transactions
      .filter((transaction) => transaction.type === 'income')
      .reduce((total, transaction) => total + transaction.amount, 0),
    expenses: transactions
      .filter((transaction) => transaction.type === 'expense')
      .reduce((total, transaction) => total + transaction.amount, 0),
    net: transactions.reduce(
      (total, transaction) =>
        total +
        (transaction.type === 'income'
          ? transaction.amount
          : -transaction.amount),
      0,
    ),
    transactionCount: transactions.length,
    activeMonths: monthsWithTransactions.size,
    totalMonths: 12,
    firstRecordDate: transactions.length
      ? transactions.reduce(
          (first, transaction) =>
            transaction.date < first ? transaction.date : first,
          transactions[0].date,
        )
      : null,
    lastRecordDate: transactions.length
      ? transactions.reduce(
          (last, transaction) =>
            transaction.date > last ? transaction.date : last,
          transactions[0].date,
        )
      : null,
    receiptEvidenceCount: receiptEvidence.length,
    reviewedReceiptCount,
  };

  const requirements = bank.requirements.map(
    (requirement): EvaluatedRequirement => {
      if (requirement.proof === 'self_reported') {
        const checklistKey = bankChecklistKey(bank.id, requirement.id);
        return {
          ...requirement,
          checklistKey,
          status: data.checklist[checklistKey] ? 'self_reported' : 'incomplete',
        };
      }
      const alternativeReady =
        requirement.proof === 'flow_score'
          ? flowScore.score !== null
          : monthsWithTransactions.size === 12;
      return {
        ...requirement,
        status: alternativeReady ? 'app_alternative' : 'incomplete',
      };
    },
  );

  const completeCount = requirements.filter(
    (requirement) => requirement.status !== 'incomplete',
  ).length;
  return {
    bank,
    requirements,
    completionPercent: Math.round((completeCount / requirements.length) * 100),
    summary,
    flowScore,
  };
}

export function formatDateRange(range: { startDate: string; endDate: string }) {
  return `${range.startDate} to ${range.endDate}`;
}
