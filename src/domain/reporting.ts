import {
  appDataSchema,
  type AppData,
  type Transaction,
} from './types';

export type ReportingPeriod = 'this_week' | 'last_week' | 'this_month' | 'last_month' | 'last_3_months' | 'last_6_months' | 'last_year';

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

export interface DailyMovement {
  date: string;
  income: number;
  expenses: number;
}

export interface FinancialChartDay extends DailyMovement {
  dailyNetChange: number;
  cumulativeNetChange: number;
}

export interface FinancialChartSeries extends DateRange {
  days: FinancialChartDay[];
  income: number;
  expenses: number;
  netChange: number;
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
  if (period === 'this_week' || period === 'last_week') {
    const weekday = new Date(`${today}T00:00:00.000Z`).getUTCDay();
    const monday = addCalendarDays(today, -((weekday + 6) % 7));
    const startDate = period === 'last_week' ? addCalendarDays(monday, -7) : monday;
    return { startDate, endDate: addCalendarDays(startDate, 6) };
  }
  if (period === 'last_3_months' || period === 'last_6_months' || period === 'last_year') {
    const months = period === 'last_3_months' ? 3 : period === 'last_6_months' ? 6 : 12;
    const startMonth = monthShiftStart(today, -months);
    const lastDay = Number(addCalendarDays(monthShiftStart(startMonth, 1), -1).slice(8));
    const anniversary = `${startMonth.slice(0, 8)}${String(Math.min(Number(today.slice(8)), lastDay)).padStart(2, '0')}`;
    return { startDate: addCalendarDays(anniversary, 1), endDate: today };
  }
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

export function summarizeDailyMovement(
  transactions: readonly Transaction[],
  range: DateRange,
): DailyMovement[] {
  const byDate = new Map<string, DailyMovement>();
  for (let date = range.startDate; date <= range.endDate; date = addCalendarDays(date, 1)) {
    byDate.set(date, { date, income: 0, expenses: 0 });
  }

  for (const transaction of transactions) {
    if (
      transaction.cashStatus !== 'settled' ||
      transaction.date < range.startDate ||
      transaction.date > range.endDate
    ) continue;
    const daily = byDate.get(transaction.date);
    if (!daily) continue;
    daily[transaction.type === 'income' ? 'income' : 'expenses'] += transaction.amount;
  }

  return [...byDate.values()];
}

/** Builds actual daily cash movements and period-relative net change. */
export function buildFinancialChartSeries(
  transactions: readonly Transaction[],
  range: DateRange,
): FinancialChartSeries {
  const movements = summarizeDailyMovement(transactions, range);
  const totals = movements.reduce(
    (sum, day) => ({ income: sum.income + day.income, expenses: sum.expenses + day.expenses }),
    { income: 0, expenses: 0 },
  );

  let cumulativeNetChange = 0;
  const days = movements.map((day) => {
    const dailyNetChange = day.income - day.expenses;
    cumulativeNetChange += dailyNetChange;
    return { ...day, dailyNetChange, cumulativeNetChange };
  });

  return {
    ...range,
    days,
    income: totals.income,
    expenses: totals.expenses,
    netChange: totals.income - totals.expenses,
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
    if (transaction.type === 'expense') payables.push(item);
  }
  const byDueDate = (a: OutstandingItem, b: OutstandingItem) =>
    a.dueDate.localeCompare(b.dueDate);
  receivables.sort(byDueDate);
  payables.sort(byDueDate);
  return {
    receivables,
    payables,
    receivableTotal: sumOutstandingReceivables(data),
    payableTotal: payables.reduce(
      (sum, item) => sum + item.transaction.amount,
      0,
    ),
    unconfirmedPaidCount: data.paymentOccurrences.filter(
      (occurrence) => occurrence.status === 'assumed_unconfirmed',
    ).length,
  };
}

export function sumOutstandingReceivables(data: Pick<AppData, 'receivables'>): number {
  return data.receivables.filter((item) => item.status === 'unpaid').reduce((sum, item) => sum + item.amount, 0);
}
