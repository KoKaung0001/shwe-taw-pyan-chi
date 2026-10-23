import {
  getReportingRange,
  sumOutstandingReceivables,
  summarizeOutstanding,
  summarizePeriod,
} from './reporting';
import {
  appDataSchema,
  type AppData,
  type DuplicateReview,
  type Transaction,
} from './types';
import { readinessDocumentIds } from './readiness';

export interface DuplicateCandidate {
  first: Transaction;
  second: Transaction;
  fingerprint: string;
}

const normalizedDescription = (transaction: Transaction) =>
  (transaction.description ?? '')
    .trim()
    .toLocaleLowerCase()
    .replace(/\s+/g, ' ');

function hash(value: string): string {
  let result = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    result ^= value.charCodeAt(index);
    result = Math.imul(result, 16777619);
  }
  return (result >>> 0).toString(16).padStart(8, '0');
}

function versionKey(transaction: Transaction): string {
  return JSON.stringify([
    transaction.type,
    transaction.amount,
    transaction.currency,
    transaction.date,
    transaction.dueDate ?? '',
    transaction.categoryId ?? '',
    normalizedDescription(transaction),
    transaction.counterpartyId ?? '',
    transaction.cashStatus,
    transaction.updatedAt,
  ]);
}

function reviewPairKey(review: DuplicateReview): string {
  return [review.firstTransactionId, review.secondTransactionId]
    .sort()
    .join('|');
}

export function duplicateReviewId(
  firstId: string,
  secondId: string,
  fingerprint: string,
): string {
  return `duplicate-${hash(`${[firstId, secondId].sort().join('|')}|${fingerprint}`)}`;
}

/** Finds exact, well-supported pairs and suppresses only the reviewed record versions. */
export function findPossibleDuplicates(input: AppData): DuplicateCandidate[] {
  const data = appDataSchema.parse(input);
  const groups = new Map<string, Transaction[]>();
  for (const transaction of data.transactions) {
    if (transaction.paymentOccurrenceId) continue;
    const description = normalizedDescription(transaction);
    if (!description && !transaction.counterpartyId) continue;
    const base = [
      transaction.type,
      transaction.amount,
      transaction.currency,
      transaction.date,
      transaction.categoryId ?? '',
      transaction.cashStatus,
    ].join('|');
    const signatures = new Set([
      ...(description ? [`${base}|description:${description}`] : []),
      ...(transaction.counterpartyId
        ? [`${base}|counterparty:${transaction.counterpartyId}`]
        : []),
    ]);
    for (const signature of signatures) {
      const group = groups.get(signature) ?? [];
      group.push(transaction);
      groups.set(signature, group);
    }
  }

  const reviewed = new Set(
    data.duplicateReviews.map(
      (review) => `${reviewPairKey(review)}|${review.fingerprint}`,
    ),
  );
  const seenPairs = new Set<string>();
  const candidates: DuplicateCandidate[] = [];
  let inspectedPairs = 0;
  for (const group of groups.values()) {
    for (
      let left = 0;
      left < group.length - 1 &&
      candidates.length < 100 &&
      inspectedPairs < 10_000;
      left += 1
    ) {
      for (
        let right = left + 1;
        right < group.length &&
        candidates.length < 100 &&
        inspectedPairs < 10_000;
        right += 1
      ) {
        const first = group[left];
        const second = group[right];
        if (first.id === second.id) continue;
        const firstDescription = normalizedDescription(first);
        const secondDescription = normalizedDescription(second);
        if (
          firstDescription &&
          secondDescription &&
          firstDescription !== secondDescription
        )
          continue;
        const [low, high] = [first, second].sort((a, b) =>
          a.id.localeCompare(b.id),
        );
        const pair = `${low.id}|${high.id}`;
        if (seenPairs.has(pair)) continue;
        seenPairs.add(pair);
        inspectedPairs += 1;
        const fingerprint = hash(`${versionKey(low)}\n${versionKey(high)}`);
        if (!reviewed.has(`${pair}|${fingerprint}`)) {
          candidates.push({ first: low, second: high, fingerprint });
        }
      }
    }
    if (candidates.length >= 100 || inspectedPairs >= 10_000) break;
  }
  return candidates;
}

export type InsightEvidence = Pick<
  Transaction,
  'id' | 'date' | 'amount' | 'description'
> & { dueDate?: string };

const evidenceFor = (transactions: readonly Transaction[]): InsightEvidence[] =>
  transactions
    .slice(0, 5)
    .map(({ id, date, amount, description, dueDate }) => ({
      id,
      date,
      amount,
      description: description ?? '',
      ...(dueDate ? { dueDate } : {}),
    }));

export interface ChatAnswer {
  supported: boolean;
  messageKey: string;
  values: Record<string, string | number>;
  evidence: InsightEvidence[];
}

const unsupportedAnswer = (): ChatAnswer => ({
  supported: false,
  messageKey: 'chat.unsupportedAnswer',
  values: {},
  evidence: [],
});

/** Answers a small, explicit set of questions from current records; unsupported requests are declined. */
export function answerRecordedQuestion(
  input: AppData,
  today: string,
  question: string,
): ChatAnswer {
  const data = appDataSchema.parse(input);
  const query = question.trim().toLocaleLowerCase();
  if (!query) return unsupportedAnswer();
  if (
    /loan|credit score|approval|legal|tax advice|financial advice|invest|forecast|shortfall|projection/.test(
      query,
    )
  )
    return unsupportedAnswer();
  if (/document|checklist|missing document/.test(query)) {
    const total = readinessDocumentIds.length;
    const completed = readinessDocumentIds.filter(
      (id) => data.checklist[id],
    ).length;
    return {
      supported: true,
      messageKey: 'chat.documentsAnswer',
      values: { completed, total },
      evidence: [],
    };
  }
  if (/overdue|late payment/.test(query)) {
    const items = [
      ...summarizeOutstanding(data, today).receivables,
      ...summarizeOutstanding(data, today).payables,
    ].filter((item) => item.overdue);
    return {
      supported: true,
      messageKey: 'chat.overdueAnswer',
      values: {
        count: items.length,
        amount: items.reduce((sum, item) => sum + item.transaction.amount, 0),
      },
      evidence: evidenceFor(items.map((item) => item.transaction)),
    };
  }
  if (/receivable|money .*owed to me/.test(query)) {
    const unpaid = data.receivables.filter((item) => item.status === 'unpaid');
    return { supported: true, messageKey: 'chat.receivablesAnswer', values: { amount: sumOutstandingReceivables(data), count: unpaid.length }, evidence: [] };
  }
  if (/owe|outstanding|owed/.test(query)) {
    const result = summarizeOutstanding(data, today);
    return {
      supported: true,
      messageKey: 'chat.outstandingAnswer',
      values: {
        receivable: sumOutstandingReceivables(data),
        payable: result.payableTotal,
      },
      evidence: evidenceFor(
        [...result.receivables, ...result.payables].map(
          (item) => item.transaction,
        ),
      ),
    };
  }
  const weekRange = getReportingRange('this_week', today);
  const weeklyPeriod = summarizePeriod(data.transactions, weekRange);
  const weeklyExpenses = data.transactions.filter((item) => item.cashStatus === 'settled' && item.type === 'expense' && item.date >= weekRange.startDate && item.date <= weekRange.endDate);
  const period = summarizePeriod(data.transactions, { startDate: `${today.slice(0, 7)}-01`, endDate: today });
  if (/\bbuy\b|\bafford\b|\bpurchase\b|\bsurvive\b|last (?:the|through).*month|make it.*month/.test(query)) {
    const matches = [...query.matchAll(/\b(\d[\d,]*(?:\.\d+)?)\s*(k|m)?\s*(mmk|kyats?)\b|\b(\d+(?:\.\d+)?)\s*(k|m)\b/g)];
    const match = matches.length === 1 ? matches[0] : undefined;
    const suffix = match?.[2] ?? match?.[5];
    const price = match ? Number((match[1] ?? match[4]).replaceAll(',', '')) * (suffix === 'k' ? 1_000 : suffix === 'm' ? 1_000_000 : 1) : NaN;
    if (!Number.isSafeInteger(price) || price <= 0 || price > 1_000_000_000_000) {
      return { supported: true, messageKey: 'chat.purchasePriceNeeded', values: {}, evidence: [] };
    }
    if (!period.transactionCount) {
      return { supported: true, messageKey: 'chat.noTransactionsAnswer', values: {}, evidence: [] };
    }
    return {
      supported: true,
      messageKey: price > period.net ? 'chat.purchaseOverNet' : 'chat.purchaseWithinNet',
      values: { price, income: period.income, expenses: period.expenses, net: period.net, after: period.net - price },
      evidence: evidenceFor(data.transactions.filter((item) => item.cashStatus === 'settled' && item.date >= period.startDate && item.date <= period.endDate)),
    };
  }
  if (/income/.test(query) && /week/.test(query)) {
    const matches = data.transactions.filter((item) => item.cashStatus === 'settled' && item.type === 'income' && item.date >= weekRange.startDate && item.date <= weekRange.endDate);
    return { supported: true, messageKey: matches.length ? 'chat.weeklyIncomeAnswer' : 'chat.noWeeklyIncomeAnswer', values: { amount: weeklyPeriod.income, startDate: weekRange.startDate, endDate: weekRange.endDate }, evidence: evidenceFor(matches) };
  }
  if (/(spend|expense)/.test(query) && /week/.test(query) && !/categor/.test(query)) return { supported: true, messageKey: weeklyExpenses.length ? 'chat.weeklyExpensesAnswer' : 'chat.noWeeklyTransactionsAnswer', values: { amount: weeklyPeriod.expenses, startDate: weekRange.startDate, endDate: weekRange.endDate }, evidence: evidenceFor(weeklyExpenses) };
  if (/categor/.test(query) && /week/.test(query)) {
    const byCategory = new Map<string, number>();
    for (const item of weeklyExpenses) { const category = item.categoryId ?? 'uncategorized'; byCategory.set(category, (byCategory.get(category) ?? 0) + item.amount); }
    const top = [...byCategory.entries()].sort((a, b) => b[1] - a[1])[0];
    return top ? { supported: true, messageKey: 'chat.weeklyCategoryAnswer', values: { category: top[0], amount: top[1], startDate: weekRange.startDate, endDate: weekRange.endDate }, evidence: evidenceFor(weeklyExpenses.filter((item) => (item.categoryId ?? 'uncategorized') === top[0])) } : { supported: true, messageKey: 'chat.noWeeklyTransactionsAnswer', values: { startDate: weekRange.startDate, endDate: weekRange.endDate }, evidence: [] };
  }
  if (/top expense|largest expense|biggest expense/.test(query)) {
    const top = data.transactions
      .filter(
        (item) =>
          item.cashStatus === 'settled' &&
          item.type === 'expense' &&
          item.date >= `${today.slice(0, 7)}-01` &&
          item.date <= today,
      )
      .sort((a, b) => b.amount - a.amount)[0];
    return top
      ? {
          supported: true,
          messageKey: 'chat.topExpenseAnswer',
          values: { amount: top.amount },
          evidence: evidenceFor([top]),
        }
      : {
          supported: true,
          messageKey: 'chat.noTransactionsAnswer',
          values: {},
          evidence: [],
        };
  }
  if (/category/.test(query)) {
    const byCategory = new Map<string, number>();
    for (const item of data.transactions.filter(
      (transaction) =>
        transaction.cashStatus === 'settled' &&
        transaction.type === 'expense' &&
        transaction.date >= `${today.slice(0, 7)}-01` &&
        transaction.date <= today,
    )) {
      const category = item.categoryId ?? 'uncategorized';
      byCategory.set(category, (byCategory.get(category) ?? 0) + item.amount);
    }
    const top = [...byCategory.entries()].sort((a, b) => b[1] - a[1])[0];
    return top
      ? {
          supported: true,
          messageKey: 'chat.categoryAnswer',
          values: { category: top[0], amount: top[1] },
          evidence: evidenceFor(
            data.transactions.filter(
              (item) =>
                item.cashStatus === 'settled' &&
                item.type === 'expense' &&
                (item.categoryId ?? 'uncategorized') === top[0] &&
                item.date >= `${today.slice(0, 7)}-01` &&
                item.date <= today,
            ),
          ),
        }
      : {
          supported: true,
          messageKey: 'chat.noTransactionsAnswer',
          values: {},
          evidence: [],
        };
  }
  if (/income|expense|spend|cash movement|total|roast|reality check/.test(query)) {
    return {
      supported: true,
      messageKey: 'chat.periodAnswer',
      values: {
        income: period.income,
        expenses: period.expenses,
        net: period.net,
      },
      evidence: evidenceFor(
        data.transactions.filter(
          (item) =>
            item.cashStatus === 'settled' &&
            item.date >= period.startDate &&
            item.date <= period.endDate,
        ),
      ),
    };
  }
  return unsupportedAnswer();
}
