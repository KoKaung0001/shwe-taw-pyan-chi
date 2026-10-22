import { z } from 'zod';

export const BUSINESS_TIME_ZONE = 'Asia/Rangoon' as const;
export const isValidTimeZone = (timeZone: string) => {
  try {
    new Intl.DateTimeFormat('en', { timeZone });
    return true;
  } catch {
    return false;
  }
};
export const MMK_MAX = 1_000_000_000_000;

const idSchema = z.string().min(1).max(256);
const isoDateSchema = z.iso.date();
const isoInstantSchema = z.iso.datetime({ offset: true });
const moneySchema = z.number().int().positive().max(MMK_MAX);

export const openingBalanceSchema = z.object({
  amount: z.number().int().nonnegative().max(MMK_MAX),
  referenceAt: isoInstantSchema,
  timeZone: z.string().refine(isValidTimeZone, 'Choose a valid time zone.'),
});
export type OpeningBalance = z.infer<typeof openingBalanceSchema>;

export const balanceAdjustmentSchema = z.object({
  id: idSchema,
  amount: z.number().int().min(-MMK_MAX).max(MMK_MAX).refine((value) => value !== 0),
  currency: z.literal('MMK'),
  date: isoDateSchema,
  occurredAt: isoInstantSchema,
  description: z.string().trim().min(1).max(120),
  createdAt: isoInstantSchema,
});
export type BalanceAdjustment = z.infer<typeof balanceAdjustmentSchema>;

export const transactionSchema = z
  .object({
    id: idSchema,
    type: z.enum(['income', 'expense']),
    amount: moneySchema,
    currency: z.literal('MMK'),
    date: isoDateSchema,
    dueDate: isoDateSchema.optional(),
    /** If provided, this payment time is precise and overrides date-only ordering. */
    occurredAt: isoInstantSchema.optional(),
    /** Required to place a date-only movement on the opening day. */
    openingDayDisposition: z
      .enum(['already_in_opening', 'after_reference'])
      .optional(),
    categoryId: idSchema.nullable(),
    description: z.string().max(200).optional(),
    reference: z.string().max(120).optional(),
    counterpartyId: idSchema.nullable(),
    cashStatus: z.enum(['settled', 'pending']),
    confirmationStatus: z.enum(['not_applicable', 'unconfirmed', 'confirmed']),
    source: z.enum(['manual', 'receipt_image', 'screenshot', 'recurring']),
    ocrReviewStatus: z.enum(['not_applicable', 'pending_review', 'reviewed']),
    paymentOccurrenceId: idSchema.optional(),
    createdAt: isoInstantSchema,
    updatedAt: isoInstantSchema,
  })
  .superRefine((transaction, context) => {
    if (transaction.cashStatus === 'pending' && !transaction.dueDate) {
      context.addIssue({
        code: 'custom',
        path: ['dueDate'],
        message: 'Pending transactions need a due date.',
      });
    }
    if (
      transaction.dueDate &&
      transaction.dueDate < transaction.date &&
      !(
        transaction.source === 'recurring' &&
        transaction.cashStatus === 'settled'
      )
    ) {
      context.addIssue({
        code: 'custom',
        path: ['dueDate'],
        message: 'Due date cannot be before the transaction date.',
      });
    }
    if (transaction.occurredAt && transaction.openingDayDisposition) {
      context.addIssue({
        code: 'custom',
        path: ['openingDayDisposition'],
        message:
          'A precise timestamp does not need a date-only opening-day choice.',
      });
    }
    if (
      transaction.source === 'recurring' &&
      !transaction.paymentOccurrenceId
    ) {
      context.addIssue({
        code: 'custom',
        path: ['paymentOccurrenceId'],
        message: 'A scheduled payment must link to its occurrence.',
      });
    }
    if (
      (transaction.source === 'receipt_image' ||
        transaction.source === 'screenshot') &&
      transaction.ocrReviewStatus !== 'reviewed'
    ) {
      context.addIssue({
        code: 'custom',
        path: ['ocrReviewStatus'],
        message: 'Captured image records require separate OCR review status.',
      });
    }
  });
export type Transaction = z.infer<typeof transactionSchema>;

export const receivableSchema = z.object({
  id: idSchema,
  amount: moneySchema,
  currency: z.literal('MMK'),
  date: isoDateSchema,
  counterparty: z.string().trim().min(1).max(120),
  description: z.string().max(200).optional(),
  categoryId: idSchema.nullable(),
  status: z.enum(['unpaid', 'paid']),
  settledAt: isoInstantSchema.optional(),
  linkedIncomeTransactionId: idSchema.optional(),
  createdAt: isoInstantSchema,
  updatedAt: isoInstantSchema,
}).superRefine((receivable, context) => {
  if (receivable.status === 'paid' && !receivable.settledAt) {
    context.addIssue({ code: 'custom', path: ['settledAt'], message: 'Paid receivables need a settlement time.' });
  }
});
export type Receivable = z.infer<typeof receivableSchema>;

export const counterpartySchema = z.object({
  id: idSchema,
  name: z.string().trim().min(1).max(80),
  kind: z.enum(['customer', 'supplier', 'other']),
});
export type Counterparty = z.infer<typeof counterpartySchema>;

export const categorySchema = z.object({
  id: idSchema,
  name: z.string().trim().min(1).max(80),
  type: z.enum(['income', 'expense', 'both']),
});
export type Category = z.infer<typeof categorySchema>;

const occurrenceHistorySchema = z.object({
  action: z.enum(['assumed', 'confirmed', 'corrected', 'marked_unpaid']),
  at: isoInstantSchema,
  previousAmount: moneySchema.optional(),
  previousPaymentDate: isoDateSchema.optional(),
  note: z.string().max(200).optional(),
});

export const scheduledRuleSchema = z.object({
  id: idSchema,
  type: z.enum(['income', 'expense']),
  amount: moneySchema,
  categoryId: idSchema.nullable(),
  description: z.string().max(200).optional(),
  counterpartyId: idSchema.nullable(),
  schedule: z.discriminatedUnion('kind', [
    z.object({ kind: z.literal('one_time'), dueDate: isoDateSchema }),
    z.object({
      kind: z.literal('monthly'),
      startDate: isoDateSchema,
      dayOfMonth: z.number().int().min(1).max(31),
      endDate: isoDateSchema.optional(),
    }),
  ]),
  active: z.boolean(),
  createdAt: isoInstantSchema,
  updatedAt: isoInstantSchema,
});
export type ScheduledRule = z.infer<typeof scheduledRuleSchema>;

export const paymentOccurrenceSchema = z.discriminatedUnion('status', [
  z.object({
    id: idSchema,
    ruleId: idSchema,
    originalDueDate: isoDateSchema,
    status: z.literal('scheduled'),
  }),
  z.object({
    id: idSchema,
    ruleId: idSchema,
    originalDueDate: isoDateSchema,
    status: z.enum([
      'assumed_unconfirmed',
      'confirmed_paid',
      'explicitly_unpaid',
    ]),
    paymentTransactionId: idSchema,
    paymentDate: isoDateSchema,
    paymentAmount: moneySchema,
    history: z.array(occurrenceHistorySchema).max(100),
  }),
]);
export type PaymentOccurrence = z.infer<typeof paymentOccurrenceSchema>;

export const duplicateReviewSchema = z
  .object({
    id: idSchema,
    firstTransactionId: idSchema,
    secondTransactionId: idSchema,
    fingerprint: z.string().min(1).max(256),
    resolution: z.enum(['keep_both', 'duplicate_removed']),
    redundantTransactionId: idSchema.optional(),
    reviewedAt: isoInstantSchema,
  })
  .superRefine((review, context) => {
    if (
      review.resolution === 'duplicate_removed' &&
      !review.redundantTransactionId
    ) {
      context.addIssue({
        code: 'custom',
        path: ['redundantTransactionId'],
        message: 'Choose the duplicate record that was removed.',
      });
    }
    if (review.resolution === 'keep_both' && review.redundantTransactionId) {
      context.addIssue({
        code: 'custom',
        path: ['redundantTransactionId'],
        message: 'Keep both cannot identify a removed transaction.',
      });
    }
    if (
      review.redundantTransactionId &&
      ![review.firstTransactionId, review.secondTransactionId].includes(
        review.redundantTransactionId,
      )
    ) {
      context.addIssue({
        code: 'custom',
        path: ['redundantTransactionId'],
        message: 'The removed record must belong to the reviewed pair.',
      });
    }
  });
export type DuplicateReview = z.infer<typeof duplicateReviewSchema>;

const appDataShape = z.object({
  openingBalance: openingBalanceSchema.nullable(),
  balanceAdjustments: z.array(balanceAdjustmentSchema).max(50_000).default([]),
  transactions: z.array(transactionSchema).max(50_000),
  receivables: z.array(receivableSchema).max(50_000).default([]),
  counterparties: z.array(counterpartySchema).max(10_000),
  categories: z.array(categorySchema).max(500),
  scheduleRules: z.array(scheduledRuleSchema).max(10_000),
  paymentOccurrences: z.array(paymentOccurrenceSchema).max(50_000),
  duplicateReviews: z.array(duplicateReviewSchema).max(50_000),
  checklist: z.record(z.string().max(120), z.boolean()),
});
export const appDataSchema = appDataShape.superRefine((data, context) => {
  const unique = (items: readonly { id: string }[], path: string) => {
    const seen = new Set<string>();
    items.forEach((item, index) => {
      if (seen.has(item.id))
        context.addIssue({
          code: 'custom',
          path: [path, index, 'id'],
          message: 'IDs must be unique within this collection.',
        });
      seen.add(item.id);
    });
  };
  unique(data.transactions, 'transactions');
  unique(data.balanceAdjustments, 'balanceAdjustments');
  unique(data.receivables, 'receivables');
  unique(data.counterparties, 'counterparties');
  unique(data.categories, 'categories');
  unique(data.scheduleRules, 'scheduleRules');
  unique(data.paymentOccurrences, 'paymentOccurrences');
  unique(data.duplicateReviews, 'duplicateReviews');

  const transactions = new Map(
    data.transactions.map((transaction) => [transaction.id, transaction]),
  );
  const occurrences = new Map(
    data.paymentOccurrences.map((occurrence) => [occurrence.id, occurrence]),
  );
  const rules = new Map(data.scheduleRules.map((rule) => [rule.id, rule]));
  const linkedPaymentIds = new Set<string>();

  data.receivables.forEach((receivable, index) => {
    if (receivable.categoryId && !data.categories.some((category) => category.id === receivable.categoryId)) {
      context.addIssue({ code: 'custom', path: ['receivables', index, 'categoryId'], message: 'Receivable category must exist.' });
    }
    const linked = receivable.linkedIncomeTransactionId
      ? transactions.get(receivable.linkedIncomeTransactionId)
      : undefined;
    if (receivable.linkedIncomeTransactionId && (!linked || linked.type !== 'income')) {
      context.addIssue({ code: 'custom', path: ['receivables', index, 'linkedIncomeTransactionId'], message: 'Settlement must reference an income transaction.' });
    }
    if (receivable.status === 'unpaid' && receivable.linkedIncomeTransactionId) {
      context.addIssue({ code: 'custom', path: ['receivables', index, 'linkedIncomeTransactionId'], message: 'Unpaid receivables cannot have settlement income.' });
    }
  });

  data.paymentOccurrences.forEach((occurrence, index) => {
    const rule = rules.get(occurrence.ruleId);
    if (!rule)
      context.addIssue({
        code: 'custom',
        path: ['paymentOccurrences', index, 'ruleId'],
        message: 'Every occurrence must reference an existing schedule rule.',
      });
    if (
      occurrence.id !==
      occurrenceIdFor(occurrence.ruleId, occurrence.originalDueDate)
    )
      context.addIssue({
        code: 'custom',
        path: ['paymentOccurrences', index, 'id'],
        message:
          'Occurrence IDs must be stable from rule ID and original due date.',
      });
    if (
      rule?.schedule.kind === 'one_time' &&
      rule.schedule.dueDate !== occurrence.originalDueDate
    )
      context.addIssue({
        code: 'custom',
        path: ['paymentOccurrences', index, 'originalDueDate'],
        message: 'One-time occurrence date must match its scheduled due date.',
      });
    if (rule?.schedule.kind === 'monthly') {
      const [year, month] = occurrence.originalDueDate.split('-').map(Number);
      const [startYear, startMonth] = rule.schedule.startDate
        .split('-')
        .map(Number);
      const monthDistance = (year - startYear) * 12 + month - startMonth;
      const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
      const expectedDay = Math.min(rule.schedule.dayOfMonth, lastDay);
      const expectedDate = `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(expectedDay).padStart(2, '0')}`;
      if (
        monthDistance < 0 ||
        expectedDate !== occurrence.originalDueDate ||
        (monthDistance === 0 && expectedDate < rule.schedule.startDate) ||
        (rule.schedule.endDate &&
          occurrence.originalDueDate > rule.schedule.endDate)
      ) {
        context.addIssue({
          code: 'custom',
          path: ['paymentOccurrences', index, 'originalDueDate'],
          message:
            'Monthly occurrence must match its rule date, month range and end date.',
        });
      }
    }
    if (occurrence.status !== 'scheduled') {
      const payment = transactions.get(occurrence.paymentTransactionId);
      const linkedRule = rules.get(occurrence.ruleId);
      if (linkedPaymentIds.has(occurrence.paymentTransactionId))
        context.addIssue({
          code: 'custom',
          path: ['paymentOccurrences', index, 'paymentTransactionId'],
          message: 'A payment transaction can count for only one occurrence.',
        });
      linkedPaymentIds.add(occurrence.paymentTransactionId);
      if (!payment || payment.paymentOccurrenceId !== occurrence.id)
        context.addIssue({
          code: 'custom',
          path: ['paymentOccurrences', index, 'paymentTransactionId'],
          message:
            'A recorded occurrence must link to its one payment transaction.',
        });
      else {
        const expectedCashStatus =
          occurrence.status === 'explicitly_unpaid' ? 'pending' : 'settled';
        const expectedConfirmation =
          occurrence.status === 'assumed_unconfirmed'
            ? 'unconfirmed'
            : occurrence.status === 'confirmed_paid'
              ? 'confirmed'
              : 'not_applicable';
        if (
          payment.cashStatus !== expectedCashStatus ||
          payment.confirmationStatus !== expectedConfirmation ||
          payment.date !== occurrence.paymentDate ||
          payment.amount !== occurrence.paymentAmount ||
          payment.type !== linkedRule?.type ||
          payment.source !== 'recurring'
        ) {
          context.addIssue({
            code: 'custom',
            path: ['paymentOccurrences', index],
            message:
              'Occurrence status, amount, payment date and linked transaction must agree.',
          });
        }
      }
    }
  });
  data.transactions.forEach((transaction, index) => {
    if (
      transaction.categoryId &&
      !data.categories.some(
        (category) => category.id === transaction.categoryId,
      )
    )
      context.addIssue({
        code: 'custom',
        path: ['transactions', index, 'categoryId'],
        message: 'Transaction category must exist.',
      });
    if (
      transaction.counterpartyId &&
      !data.counterparties.some(
        (counterparty) => counterparty.id === transaction.counterpartyId,
      )
    )
      context.addIssue({
        code: 'custom',
        path: ['transactions', index, 'counterpartyId'],
        message: 'Transaction counterparty must exist.',
      });
    if (transaction.paymentOccurrenceId) {
      const occurrence = occurrences.get(transaction.paymentOccurrenceId);
      if (
        !occurrence ||
        occurrence.status === 'scheduled' ||
        occurrence.paymentTransactionId !== transaction.id
      )
        context.addIssue({
          code: 'custom',
          path: ['transactions', index, 'paymentOccurrenceId'],
          message:
            'A transaction may link only to its own recorded occurrence.',
        });
    }
  });
  data.scheduleRules.forEach((rule, index) => {
    if (
      rule.categoryId &&
      !data.categories.some((category) => category.id === rule.categoryId)
    )
      context.addIssue({
        code: 'custom',
        path: ['scheduleRules', index, 'categoryId'],
        message: 'Schedule category must exist.',
      });
    if (
      rule.counterpartyId &&
      !data.counterparties.some(
        (counterparty) => counterparty.id === rule.counterpartyId,
      )
    )
      context.addIssue({
        code: 'custom',
        path: ['scheduleRules', index, 'counterpartyId'],
        message: 'Schedule counterparty must exist.',
      });
    if (
      rule.schedule.kind === 'monthly' &&
      rule.schedule.endDate &&
      rule.schedule.endDate < rule.schedule.startDate
    )
      context.addIssue({
        code: 'custom',
        path: ['scheduleRules', index, 'schedule', 'endDate'],
        message: 'Schedule end date cannot be before its start date.',
      });
  });
  data.duplicateReviews.forEach((review, index) => {
    const firstExists = transactions.has(review.firstTransactionId);
    const secondExists = transactions.has(review.secondTransactionId);
    const retainedId =
      review.resolution === 'duplicate_removed'
        ? review.firstTransactionId === review.redundantTransactionId
          ? review.secondTransactionId
          : review.firstTransactionId
        : null;
    const validReferences =
      review.resolution === 'keep_both'
        ? firstExists && secondExists
        : retainedId !== null &&
          transactions.has(retainedId) &&
          !transactions.has(review.redundantTransactionId!);
    if (!validReferences)
      context.addIssue({
        code: 'custom',
        path: ['duplicateReviews', index],
        message:
          'Duplicate review must retain both records or retain one and remove the chosen duplicate.',
      });
  });
});
export type AppData = z.infer<typeof appDataSchema>;

export const persistedStoreSchema = z.object({
  data: appDataSchema,
  storageNotice: z.string().max(300).nullable(),
  timeZone: z.string().refine(isValidTimeZone).default(BUSINESS_TIME_ZONE),
});
export type PersistedStore = z.infer<typeof persistedStoreSchema>;

export const emptyAppData = (): AppData => ({
  openingBalance: null,
  balanceAdjustments: [],
  transactions: [],
  receivables: [],
  counterparties: [],
  categories: [
    { id: 'client-income', name: 'Client income', type: 'income' },
    { id: 'sales', name: 'Sales', type: 'income' },
    { id: 'other-income', name: 'Other income', type: 'income' },
    { id: 'supplies', name: 'Supplies', type: 'expense' },
    { id: 'inventory', name: 'Inventory', type: 'expense' },
    { id: 'transport', name: 'Transport', type: 'expense' },
    { id: 'utilities', name: 'Utilities', type: 'expense' },
    { id: 'rent', name: 'Rent', type: 'expense' },
    { id: 'marketing', name: 'Marketing', type: 'expense' },
    { id: 'food', name: 'Food', type: 'expense' },
    { id: 'other-expense', name: 'Other expense', type: 'expense' },
  ],
  scheduleRules: [],
  paymentOccurrences: [],
  duplicateReviews: [],
  checklist: {},
});

export const occurrenceIdFor = (ruleId: string, originalDueDate: string) =>
  `${ruleId}:${originalDueDate}`;
