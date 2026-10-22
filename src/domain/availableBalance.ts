import type { BalanceAdjustment, OpeningBalance, Transaction } from './types';

export interface AvailableBalanceResult {
  amount: number | null;
  includedTransactionIds: string[];
  includedAdjustmentIds: string[];
  excludedAlreadyIncludedIds: string[];
  unclassifiedOpeningDayIds: string[];
}

function businessDate(instant: string, timeZone: string): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date(instant));
  const part = (type: string) =>
    parts.find((item) => item.type === type)?.value;
  return `${part('year')}-${part('month')}-${part('day')}`;
}

/** Opening day date-only entries must be explicitly classified; unclassified items are excluded safely. */
export function calculateRecordedAvailableBalance(
  opening: OpeningBalance | null,
  transactions: readonly Transaction[],
  adjustments: readonly BalanceAdjustment[] = [],
): AvailableBalanceResult {
  if (!opening)
    return {
      amount: null,
      includedTransactionIds: [],
      includedAdjustmentIds: [],
      excludedAlreadyIncludedIds: [],
      unclassifiedOpeningDayIds: [],
    };

  const openingDay = businessDate(opening.referenceAt, opening.timeZone);
  let amount = opening.amount;
  const includedTransactionIds: string[] = [];
  const includedAdjustmentIds: string[] = [];
  const excludedAlreadyIncludedIds: string[] = [];
  const unclassifiedOpeningDayIds: string[] = [];

  for (const transaction of transactions) {
    if (transaction.cashStatus !== 'settled') continue;
    let include: boolean;

    if (transaction.occurredAt) {
      // Equal instants are already represented in the opening amount.
      include =
        new Date(transaction.occurredAt).getTime() >
        new Date(opening.referenceAt).getTime();
    } else if (transaction.date < openingDay) {
      include = false;
    } else if (transaction.date > openingDay) {
      include = true;
    } else if (transaction.openingDayDisposition === 'after_reference') {
      include = true;
    } else if (transaction.openingDayDisposition === 'already_in_opening') {
      include = false;
    } else {
      unclassifiedOpeningDayIds.push(transaction.id);
      continue;
    }

    if (!include) {
      excludedAlreadyIncludedIds.push(transaction.id);
      continue;
    }
    amount = checkedAmount(amount +
      (transaction.type === 'income' ? transaction.amount : -transaction.amount));
    includedTransactionIds.push(transaction.id);
  }

  for (const adjustment of adjustments) {
    if (new Date(adjustment.occurredAt).getTime() <= new Date(opening.referenceAt).getTime()) continue;
    amount = checkedAmount(amount + adjustment.amount);
    includedAdjustmentIds.push(adjustment.id);
  }

  return {
    amount,
    includedTransactionIds,
    includedAdjustmentIds,
    excludedAlreadyIncludedIds,
    unclassifiedOpeningDayIds,
  };
}

function checkedAmount(amount: number) {
  if (!Number.isSafeInteger(amount)) throw new RangeError('Calculated balance exceeds the supported MMK range.');
  return amount;
}
