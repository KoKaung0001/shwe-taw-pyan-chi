import {
  appDataSchema,
  type AppData,
  type ScheduledRule,
  type Transaction,
} from './types';
import { calculateRecordedAvailableBalance } from './availableBalance';

export type ReportingPeriod = 'this_month' | 'last_month' | 'last_30_days';

export interface DateRange {
  startDate: string;
  endDate: string;
}

export interface PeriodSummary extends DateRange {
  income: number;
  expenses: number;
  net: number;
  transactionCount: number;
}

export interface MonthlyMovement {
  month: string;
  income: number;
  expenses: number;
}

export interface OutstandingItem {
  transaction: Transaction;
  dueDate: string;
  overdue: boolean;
}

export interface OutstandingSummary {
  receivables: OutstandingItem[];
  payables: OutstandingItem[];
  receivableTotal: number;
  payableTotal: number;
  unconfirmedPaidCount: number;
}

export interface ForecastDay {
  date: string;
  income: number;
  expenses: number;
  closingBalance: number | null;
}

export interface ForecastProjection {
  days: ForecastDay[];
  minimumBalance: number | null;
  minimumBalanceDate: string | null;
  shortfall: number;
}

export interface CashFlowForecast {
  startDate: string;
  endDate: string;
  startingBalance: number | null;
  base: ForecastProjection;
  lateInflows: ForecastProjection;
}

export function addCalendarDays(date: string, days: number): string {
  const result = new Date(`${date}T00:00:00.000Z`);
  result.setUTCDate(result.getUTCDate() + days);
  return result.toISOString().slice(0, 10);
}

function monthStart(date: string): string {
  return `${date.slice(0, 7)}-01`;
}

function monthShiftStart(date: string, months: number): string {
  const [year, month] = date.split('-').map(Number);
  const shifted = new Date(Date.UTC(year, month - 1 + months, 1));
  return `${shifted.getUTCFullYear()}-${String(shifted.getUTCMonth() + 1).padStart(2, '0')}-01`;
}

export function getReportingRange(
  period: ReportingPeriod,
  today: string,
): DateRange {
  if (period === 'last_30_days')
    return { startDate: addCalendarDays(today, -29), endDate: today };
  if (period === 'last_month') {
    const startDate = monthShiftStart(today, -1);
    return { startDate, endDate: addCalendarDays(monthStart(today), -1) };
  }
  return { startDate: monthStart(today), endDate: today };
}

export function summarizePeriod(
  transactions: readonly Transaction[],
  range: DateRange,
): PeriodSummary {
  const included = transactions.filter(
    (transaction) =>
      transaction.cashStatus === 'settled' &&
      transaction.date >= range.startDate &&
      transaction.date <= range.endDate,
  );
  const income = included
    .filter((transaction) => transaction.type === 'income')
    .reduce((sum, transaction) => sum + transaction.amount, 0);
  const expenses = included
    .filter((transaction) => transaction.type === 'expense')
    .reduce((sum, transaction) => sum + transaction.amount, 0);
  return {
    ...range,
    income,
    expenses,
    net: income - expenses,
    transactionCount: included.length,
  };
}

export function summarizeMonthlyMovement(
  transactions: readonly Transaction[],
  today: string,
  numberOfMonths = 6,
): MonthlyMovement[] {
  const months = Array.from({ length: numberOfMonths }, (_, index) =>
    monthShiftStart(today, index - numberOfMonths + 1).slice(0, 7),
  );
  return months.map((month) => {
    const settled = transactions.filter(
      (transaction) =>
        transaction.cashStatus === 'settled' &&
        transaction.date.startsWith(month),
    );
    return {
      month,
      income: settled
        .filter((transaction) => transaction.type === 'income')
        .reduce((sum, transaction) => sum + transaction.amount, 0),
      expenses: settled
        .filter((transaction) => transaction.type === 'expense')
        .reduce((sum, transaction) => sum + transaction.amount, 0),
    };
  });
}

export function summarizeOutstanding(
  input: AppData,
  today: string,
): OutstandingSummary {
  const data = appDataSchema.parse(input);
  const receivables: OutstandingItem[] = [];
  const payables: OutstandingItem[] = [];
  for (const transaction of data.transactions) {
    if (transaction.cashStatus !== 'pending' || !transaction.dueDate) continue;
    const item = {
      transaction,
      dueDate: transaction.dueDate,
      overdue: transaction.dueDate < today,
    };
    (transaction.type === 'income' ? receivables : payables).push(item);
  }
  const byDueDate = (a: OutstandingItem, b: OutstandingItem) =>
    a.dueDate.localeCompare(b.dueDate);
  receivables.sort(byDueDate);
  payables.sort(byDueDate);
  return {
    receivables,
    payables,
    receivableTotal: receivables.reduce(
      (sum, item) => sum + item.transaction.amount,
      0,
    ),
    payableTotal: payables.reduce(
      (sum, item) => sum + item.transaction.amount,
      0,
    ),
    unconfirmedPaidCount: data.paymentOccurrences.filter(
      (occurrence) => occurrence.status === 'assumed_unconfirmed',
    ).length,
  };
}

interface ForecastEvent {
  id: string;
  date: string;
  type: 'income' | 'expense';
  amount: number;
}

function buildProjection(
  events: readonly ForecastEvent[],
  startDate: string,
  horizonDays: number,
  startingBalance: number | null,
  shiftInflows: boolean,
): ForecastProjection {
  const byDate = new Map<string, { income: number; expenses: number }>();
  const endDate = addCalendarDays(startDate, horizonDays - 1);
  for (const event of events) {
    const projectedDate =
      shiftInflows && event.type === 'income'
        ? addCalendarDays(event.date, 7)
        : event.date;
    if (projectedDate < startDate || projectedDate > endDate) continue;
    const values = byDate.get(projectedDate) ?? { income: 0, expenses: 0 };
    values[event.type === 'income' ? 'income' : 'expenses'] += event.amount;
    byDate.set(projectedDate, values);
  }

  let balance = startingBalance;
  const days: ForecastDay[] = [];
  for (let offset = 0; offset < horizonDays; offset += 1) {
    const date = addCalendarDays(startDate, offset);
    const values = byDate.get(date) ?? { income: 0, expenses: 0 };
    if (balance !== null) balance += values.income - values.expenses;
    days.push({ date, ...values, closingBalance: balance });
  }
  const knownBalances = days.filter(
    (day): day is ForecastDay & { closingBalance: number } =>
      day.closingBalance !== null,
  );
  const lowDay = knownBalances.reduce<ForecastDay | null>(
    (lowest, day) =>
      lowest === null || day.closingBalance! < lowest.closingBalance!
        ? day
        : lowest,
    null,
  );
  const minimumBalance = lowDay?.closingBalance ?? null;
  return {
    days,
    minimumBalance,
    minimumBalanceDate: lowDay?.date ?? null,
    shortfall: minimumBalance === null ? 0 : Math.max(0, -minimumBalance),
  };
}

function scheduledRuleFor(
  rules: readonly ScheduledRule[],
  ruleId: string,
): ScheduledRule | undefined {
  return rules.find((rule) => rule.id === ruleId);
}

/** Projects pending obligations and forecast-only occurrences without counting recorded payments twice. */
export function buildCashFlowForecast(
  input: AppData,
  today: string,
  horizonDays = 14,
): CashFlowForecast {
  const data = appDataSchema.parse(input);
  const events: ForecastEvent[] = [];
  for (const transaction of data.transactions) {
    if (transaction.cashStatus !== 'pending' || !transaction.dueDate) continue;
    events.push({
      id: `transaction:${transaction.id}`,
      date: transaction.dueDate < today ? today : transaction.dueDate,
      type: transaction.type,
      amount: transaction.amount,
    });
  }
  for (const occurrence of data.paymentOccurrences) {
    if (occurrence.status !== 'scheduled') continue;
    const rule = scheduledRuleFor(data.scheduleRules, occurrence.ruleId);
    if (!rule?.active) continue;
    events.push({
      id: `occurrence:${occurrence.id}`,
      date:
        occurrence.originalDueDate < today ? today : occurrence.originalDueDate,
      type: rule.type,
      amount: rule.amount,
    });
  }
  const startingBalance = calculateRecordedAvailableBalance(
    data.openingBalance,
    data.transactions,
  ).amount;
  return {
    startDate: today,
    endDate: addCalendarDays(today, horizonDays - 1),
    startingBalance,
    base: buildProjection(events, today, horizonDays, startingBalance, false),
    lateInflows: buildProjection(
      events,
      today,
      horizonDays,
      startingBalance,
      true,
    ),
  };
}
