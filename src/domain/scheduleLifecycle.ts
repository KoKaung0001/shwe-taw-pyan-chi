import {
  appDataSchema,
  occurrenceIdFor,
  type AppData,
  type PaymentOccurrence,
  type ScheduledRule,
  type Transaction,
} from './types';
import type { Clock } from '../services/clock';

type IdFactory = () => string;

const newId: IdFactory = () =>
  globalThis.crypto?.randomUUID?.() ??
  `payment-${Date.now()}-${Math.random().toString(36).slice(2)}`;

const MONTHLY_FORECAST_DAYS = 365;

function addDays(date: string, days: number): string {
  const value = new Date(`${date}T00:00:00.000Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}

/** Returns each rule date from its start through the requested date, clamped to month end. */
export function monthlyDueDatesThrough(
  schedule: Extract<ScheduledRule['schedule'], { kind: 'monthly' }>,
  throughDate: string,
): string[] {
  const [startYear, startMonth] = schedule.startDate.split('-').map(Number);
  const endDate = schedule.endDate
    ? schedule.endDate < throughDate
      ? schedule.endDate
      : throughDate
    : throughDate;
  const [endYear, endMonth] = endDate.split('-').map(Number);
  const firstIndex = startYear * 12 + startMonth - 1;
  const finalIndex = endYear * 12 + endMonth - 1;
  const dates: string[] = [];

  for (let monthIndex = firstIndex; monthIndex <= finalIndex; monthIndex += 1) {
    const year = Math.floor(monthIndex / 12);
    const month = (monthIndex % 12) + 1;
    const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
    const day = Math.min(schedule.dayOfMonth, lastDay);
    const dueDate = `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    if (dueDate >= schedule.startDate && dueDate <= endDate)
      dates.push(dueDate);
  }

  return dates;
}

function assumedPayment(
  rule: ScheduledRule,
  occurrenceId: string,
  dueDate: string,
  transactionId: string,
  now: string,
): Transaction {
  return {
    id: transactionId,
    type: rule.type,
    amount: rule.amount,
    currency: 'MMK',
    date: dueDate,
    dueDate,
    categoryId: rule.categoryId,
    description: rule.description,
    counterpartyId: rule.counterpartyId,
    cashStatus: 'settled',
    confirmationStatus: 'unconfirmed',
    source: 'recurring',
    ocrReviewStatus: 'not_applicable',
    paymentOccurrenceId: occurrenceId,
    createdAt: now,
    updatedAt: now,
  };
}

function assumedOccurrence(
  rule: ScheduledRule,
  dueDate: string,
  transaction: Transaction,
  now: string,
): PaymentOccurrence {
  return {
    id: occurrenceIdFor(rule.id, dueDate),
    ruleId: rule.id,
    originalDueDate: dueDate,
    status: 'assumed_unconfirmed',
    paymentTransactionId: transaction.id,
    paymentDate: dueDate,
    paymentAmount: transaction.amount,
    history: [{ action: 'assumed', at: now }],
  };
}

/** Creates scheduled forecasts and catches up due one-time and monthly items once. */
export function processSchedules(
  input: AppData,
  clock: Clock,
  idFactory: IdFactory = newId,
): AppData {
  const data = appDataSchema.parse(input);
  let occurrences = data.paymentOccurrences;
  let transactions = data.transactions;
  let changed = false;
  const today = clock.today();
  const forecastThrough = addDays(today, MONTHLY_FORECAST_DAYS);
  const now = clock.now().toISOString();
  const existingIds = new Set(
    transactions.map((transaction) => transaction.id),
  );

  for (const rule of data.scheduleRules) {
    if (!rule.active) continue;
    const dueDates =
      rule.schedule.kind === 'one_time'
        ? [rule.schedule.dueDate]
        : monthlyDueDatesThrough(rule.schedule, forecastThrough);

    for (const dueDate of dueDates) {
      const id = occurrenceIdFor(rule.id, dueDate);
      const existing = occurrences.find((occurrence) => occurrence.id === id);
      if (existing && existing.status !== 'scheduled') continue;

      if (dueDate > today) {
        if (!existing) {
          occurrences = [
            ...occurrences,
            {
              id,
              ruleId: rule.id,
              originalDueDate: dueDate,
              status: 'scheduled',
            },
          ];
          changed = true;
        }
        continue;
      }

      const paymentId = idFactory();
      if (existingIds.has(paymentId)) {
        throw new Error('The payment ID generator returned a duplicate ID.');
      }
      existingIds.add(paymentId);
      const transaction = assumedPayment(rule, id, dueDate, paymentId, now);
      transactions = [...transactions, transaction];
      const occurrence = assumedOccurrence(rule, dueDate, transaction, now);
      if (existing) {
        occurrences = occurrences.map((item) =>
          item.id === id ? occurrence : item,
        );
      } else {
        occurrences = [...occurrences, occurrence];
      }
      changed = true;
    }
  }

  if (!changed) return input;
  return appDataSchema.parse({
    ...data,
    transactions,
    paymentOccurrences: occurrences,
  });
}

/** Backward-compatible name retained for the M3a one-time lifecycle tests. */
export const processOneTimeSchedules = processSchedules;
