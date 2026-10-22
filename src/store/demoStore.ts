import { create } from 'zustand';
import { createJSONStorage, persist, type StateStorage } from 'zustand/middleware';
import {
  emptyAppData,
  appDataSchema,
  isValidTimeZone,
  persistedStoreSchema,
  transactionSchema,
  scheduledRuleSchema,
  occurrenceIdFor,
  type AppData,
  type DuplicateReview,
  type PersistedStore,
  type ScheduledRule,
  type Transaction,
  type Receivable,
  receivableSchema,
} from '../domain/types';
import type { ReadinessDocumentId } from '../domain/readiness';
import { processSchedules } from '../domain/scheduleLifecycle';
import { clockForTimeZone, systemClock, type Clock } from '../services/clock';
import { createSeedData } from '../domain/seedData';
import {
  browserStorage,
  createSafeJsonStorage,
  PERSISTENCE_VERSION,
  STORAGE_KEY,
} from './persistence';

export interface DemoStore extends PersistedStore {
  activateWorkspace(email: string): Promise<void>;
  setTimeZone(timeZone: string): void;
  replaceData(data: AppData): void;
  saveTransaction(transaction: Transaction): void;
  createReceivable(receivable: Receivable): void;
  settleReceivable(id: string): void;
  resetDemoData(): void;
  deleteTransaction(id: string): Transaction | null;
  restoreTransaction(transaction: Transaction): void;
  createScheduleRule(rule: ScheduledRule, clock?: Clock): void;
  processDueSchedules(clock?: Clock): void;
  cancelScheduleRule(ruleId: string): void;
  markOccurrenceUnpaid(occurrenceId: string): void;
  resolveDuplicate(review: DuplicateReview): void;
  setReadinessDocument(id: ReadinessDocumentId, available: boolean): void;
  dismissStorageNotice(): void;
}

function workspaceHasNoUserData(data: AppData) {
  const defaults = emptyAppData().categories;
  const hasDefaultCategories = data.categories.length === defaults.length && defaults.every((category) =>
    data.categories.some((candidate) => candidate.id === category.id && candidate.name === category.name && candidate.type === category.type),
  );
  // A user-entered opening balance alone does not mean the workspace has activity;
  // preserve it while adding the sample transactions to otherwise empty accounts.
  return data.transactions.length === 0 && data.balanceAdjustments.length === 0 &&
    data.receivables.length === 0 && data.counterparties.length === 0 && data.scheduleRules.length === 0 &&
    data.paymentOccurrences.length === 0 && data.duplicateReviews.length === 0 &&
    Object.keys(data.checklist).length === 0 && hasDefaultCategories;
}

export function createDemoStore(
  backingStorage: StateStorage = browserStorage,
  options: { skipHydration?: boolean; seedInitialData?: boolean } = {},
) {
  const localTimeZone =
    Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Rangoon';
  const jsonStorage = createSafeJsonStorage(backingStorage, (message) => {
    store.setState({ storageNotice: message });
  });
  const volatileStorage = createJSONStorage(() => ({
    getItem: async () => null,
    setItem: async () => {},
    removeItem: async () => {},
  }));
  let activeStorageKey = STORAGE_KEY;
  let activateWorkspace: (email: string) => Promise<void> = async () => {};

  const store = create<DemoStore>()(
    persist(
      (set, get) => ({
        data: options.seedInitialData ? createSeedData() : emptyAppData(),
        storageNotice: null,
        timeZone: localTimeZone,
        activateWorkspace: (email) => activateWorkspace(email),
        setTimeZone: (timeZone) => {
          if (!isValidTimeZone(timeZone))
            throw new Error('Choose a valid time zone.');
          set({ timeZone });
        },
        replaceData: (data) => {
          const validated = appDataSchema.parse(data);
          set({ data: validated });
        },
        saveTransaction: (transaction) => {
          const current = get().data;
          const parsed = transactionSchema.parse(transaction);
          const prior = current.transactions.find(
            (item) => item.id === parsed.id,
          );
          const saved = {
            ...parsed,
            id: prior?.id ?? parsed.id,
            createdAt: prior?.createdAt ?? parsed.createdAt,
            paymentOccurrenceId:
              prior?.paymentOccurrenceId ?? parsed.paymentOccurrenceId,
          };
          const transactions = prior
            ? current.transactions.map((item) =>
                item.id === saved.id ? saved : item,
              )
            : [...current.transactions, saved];
          let paymentOccurrences = current.paymentOccurrences;
          if (saved.paymentOccurrenceId) {
            const now = new Date().toISOString();
            paymentOccurrences = current.paymentOccurrences.map(
              (occurrence) => {
                if (
                  occurrence.id !== saved.paymentOccurrenceId ||
                  occurrence.status === 'scheduled'
                )
                  return occurrence;
                const status =
                  saved.cashStatus === 'pending'
                    ? 'explicitly_unpaid'
                    : saved.confirmationStatus === 'unconfirmed'
                      ? 'assumed_unconfirmed'
                      : 'confirmed_paid';
                const action =
                  status === 'explicitly_unpaid'
                    ? 'marked_unpaid'
                    : status === 'confirmed_paid'
                      ? 'confirmed'
                      : 'corrected';
                return {
                  ...occurrence,
                  status,
                  paymentDate: saved.date,
                  paymentAmount: saved.amount,
                  history: [
                    ...occurrence.history,
                    {
                      action,
                      at: now,
                      previousAmount: occurrence.paymentAmount,
                      previousPaymentDate: occurrence.paymentDate,
                    },
                  ].slice(-100),
                } as typeof occurrence;
              },
            );
          }
          const validated = appDataSchema.parse({
            ...current,
            transactions,
            paymentOccurrences,
          });
          set({ data: validated });
        },
        createReceivable: (receivable) => {
          const current = get().data;
          const parsed = receivableSchema.parse(receivable);
          set({ data: appDataSchema.parse({ ...current, receivables: [...current.receivables, parsed] }) });
        },
        settleReceivable: (id) => {
          const current = get().data;
          const receivable = current.receivables.find((item) => item.id === id);
          if (!receivable || receivable.status === 'paid') return;
          const now = systemClock.now();
          const timestamp = now.toISOString();
          const transactionId = globalThis.crypto?.randomUUID?.() ?? `settlement-${Date.now()}`;
          const transaction = transactionSchema.parse({
            id: transactionId,
            type: 'income',
            amount: receivable.amount,
            currency: receivable.currency,
            date: clockForTimeZone(get().timeZone).today(),
            categoryId: receivable.categoryId,
            description: receivable.description || `Receivable paid by ${receivable.counterparty}`,
            counterpartyId: null,
            cashStatus: 'settled',
            confirmationStatus: 'not_applicable',
            source: 'manual',
            ocrReviewStatus: 'not_applicable',
            createdAt: timestamp,
            updatedAt: timestamp,
          });
          set({ data: appDataSchema.parse({
            ...current,
            transactions: [...current.transactions, transaction],
            receivables: current.receivables.map((item) => item.id === id ? {
              ...item,
              status: 'paid' as const,
              settledAt: timestamp,
              linkedIncomeTransactionId: transactionId,
              updatedAt: timestamp,
            } : item),
          }) });
        },
        resetDemoData: () => {
          const openingBalance = get().data.openingBalance;
          set({ data: { ...createSeedData(), openingBalance } });
        },
        deleteTransaction: (id): Transaction | null => {
          const current = get().data;
          const transaction = current.transactions.find(
            (item) => item.id === id,
          );
          if (!transaction) return null;
          if (transaction.paymentOccurrenceId)
            throw new Error(
              'A scheduled payment must be corrected through its occurrence.',
            );
          const validated = appDataSchema.parse({
            ...current,
            transactions: current.transactions.filter((item) => item.id !== id),
            duplicateReviews: current.duplicateReviews.filter(
              (review) =>
                review.firstTransactionId !== id &&
                review.secondTransactionId !== id,
            ),
          });
          set({ data: validated });
          return transaction;
        },
        restoreTransaction: (transaction) => {
          const current = get().data;
          if (current.transactions.some((item) => item.id === transaction.id))
            return;
          set({
            data: appDataSchema.parse({
              ...current,
              transactions: [...current.transactions, transaction],
            }),
          });
        },
        resolveDuplicate: (review) => {
          const current = get().data;
          const candidate = current.transactions.find(
            (transaction) => transaction.id === review.redundantTransactionId,
          );
          if (review.resolution === 'duplicate_removed') {
            if (!candidate || candidate.paymentOccurrenceId)
              throw new Error('The selected duplicate cannot be removed.');
          }
          const duplicateReviews = [
            ...current.duplicateReviews.filter(
              (item) =>
                item.id !== review.id &&
                (review.resolution !== 'duplicate_removed' ||
                  (item.firstTransactionId !== review.redundantTransactionId &&
                    item.secondTransactionId !==
                      review.redundantTransactionId)),
            ),
            review,
          ];
          set({
            data: appDataSchema.parse({
              ...current,
              transactions:
                review.resolution === 'duplicate_removed'
                  ? current.transactions.filter(
                      (transaction) =>
                        transaction.id !== review.redundantTransactionId,
                    )
                  : current.transactions,
              duplicateReviews,
            }),
          });
        },
        createScheduleRule: (rule, clock) => {
          clock ??= clockForTimeZone(get().timeZone);
          const parsed = scheduledRuleSchema.parse(rule);
          const current = get().data;
          if (current.scheduleRules.some((item) => item.id === parsed.id)) {
            throw new Error('A schedule with this ID already exists.');
          }
          const created = appDataSchema.parse({
            ...current,
            scheduleRules: [...current.scheduleRules, parsed],
          });
          set({ data: processSchedules(created, clock) });
        },
        processDueSchedules: (clock) => {
          clock ??= clockForTimeZone(get().timeZone);
          const current = get().data;
          const processed = processSchedules(current, clock);
          if (processed !== current) set({ data: processed });
        },
        cancelScheduleRule: (ruleId) => {
          const current = get().data;
          const rule = current.scheduleRules.find((item) => item.id === ruleId);
          if (!rule) return;
          const occurrenceId =
            rule.schedule.kind === 'one_time'
              ? occurrenceIdFor(ruleId, rule.schedule.dueDate)
              : null;
          const occurrences = current.paymentOccurrences.filter(
            (item) => item.ruleId === ruleId,
          );
          if (
            rule.schedule.kind === 'one_time' &&
            occurrences.some((item) => item.status !== 'scheduled')
          ) {
            throw new Error(
              'A due schedule cannot be canceled after payment processing.',
            );
          }
          if (
            rule.schedule.kind === 'monthly' &&
            occurrences.some((item) => item.status === 'scheduled')
          ) {
            set({
              data: appDataSchema.parse({
                ...current,
                scheduleRules: current.scheduleRules.map((item) =>
                  item.id === ruleId
                    ? {
                        ...item,
                        active: false,
                        updatedAt: systemClock.now().toISOString(),
                      }
                    : item,
                ),
                paymentOccurrences: current.paymentOccurrences.filter(
                  (item) =>
                    item.ruleId !== ruleId || item.status !== 'scheduled',
                ),
              }),
            });
            return;
          }
          if (rule.schedule.kind === 'monthly') {
            set({
              data: appDataSchema.parse({
                ...current,
                scheduleRules: current.scheduleRules.map((item) =>
                  item.id === ruleId
                    ? {
                        ...item,
                        active: false,
                        updatedAt: systemClock.now().toISOString(),
                      }
                    : item,
                ),
              }),
            });
            return;
          }
          set({
            data: appDataSchema.parse({
              ...current,
              scheduleRules: current.scheduleRules.filter(
                (item) => item.id !== ruleId,
              ),
              paymentOccurrences: occurrenceId
                ? current.paymentOccurrences.filter(
                    (item) => item.id !== occurrenceId,
                  )
                : current.paymentOccurrences,
            }),
          });
        },
        markOccurrenceUnpaid: (occurrenceId) => {
          const current = get().data;
          const occurrence = current.paymentOccurrences.find(
            (item) => item.id === occurrenceId,
          );
          if (
            !occurrence ||
            occurrence.status === 'scheduled' ||
            occurrence.status === 'explicitly_unpaid'
          )
            return;
          const payment = current.transactions.find(
            (item) => item.id === occurrence.paymentTransactionId,
          );
          if (!payment)
            throw new Error('The occurrence payment record is missing.');
          const now = systemClock.now().toISOString();
          const transactions = current.transactions.map((item) =>
            item.id === payment.id
              ? {
                  ...item,
                  date: occurrence.originalDueDate,
                  dueDate: occurrence.originalDueDate,
                  cashStatus: 'pending' as const,
                  confirmationStatus: 'not_applicable' as const,
                  updatedAt: now,
                }
              : item,
          );
          const paymentOccurrences = current.paymentOccurrences.map((item) =>
            item.id === occurrenceId && item.status !== 'scheduled'
              ? {
                  ...item,
                  status: 'explicitly_unpaid' as const,
                  paymentDate: occurrence.originalDueDate,
                  paymentAmount: payment.amount,
                  history: [
                    ...item.history,
                    {
                      action: 'marked_unpaid' as const,
                      at: now,
                      previousAmount: occurrence.paymentAmount,
                      previousPaymentDate: occurrence.paymentDate,
                    },
                  ].slice(-100),
                }
              : item,
          );
          set({
            data: appDataSchema.parse({
              ...current,
              transactions,
              paymentOccurrences,
            }),
          });
        },
        setReadinessDocument: (id, available) => {
          const current = get().data;
          set({
            data: appDataSchema.parse({
              ...current,
              checklist: { ...current.checklist, [id]: available },
            }),
          });
        },
        dismissStorageNotice: () => set({ storageNotice: null }),
      }),
      {
        name: STORAGE_KEY,
        version: PERSISTENCE_VERSION,
        storage: jsonStorage,
        skipHydration: options.skipHydration,
        partialize: (state) =>
          ({
            data: state.data,
            storageNotice: state.storageNotice,
            timeZone: state.timeZone,
          }) as DemoStore,
        migrate: (_persistedState, previousVersion) => ({
          data: emptyAppData(),
          storageNotice: `Saved demo data version ${previousVersion} was unsupported and has been reset.`,
        }),
        merge: (persisted, current) => {
          if (persisted === null || persisted === undefined) return current;
          const result = persistedStoreSchema.safeParse(persisted);
          if (!result.success) {
            void Promise.resolve(backingStorage.removeItem(activeStorageKey)).catch(
              () => {},
            );
            return {
              ...current,
              data: emptyAppData(),
              storageNotice: 'Saved demo data was invalid and has been reset.',
            };
          }
          return {
            ...current,
            ...result.data,
            data: {
              ...result.data.data,
              categories:
                result.data.data.categories.length > 0
                  ? result.data.data.categories
                  : emptyAppData().categories,
            },
          };
        },
        onRehydrateStorage: () => (_state, error) => {
          if (error) {
            void Promise.resolve(backingStorage.removeItem(activeStorageKey)).catch(
              () => {},
            );
            store.setState({
              data: emptyAppData(),
              storageNotice:
                'Saved demo data could not be read and has been reset.',
            });
          }
        },
      },
    ),
  );
  activateWorkspace = async (email) => {
    const normalized = email.trim().toLocaleLowerCase('en-US');
    if (!normalized) throw new Error('An account email is required to open its finance workspace.');
    activeStorageKey = `${STORAGE_KEY}:account:${encodeURIComponent(normalized)}`;
    store.persist.setOptions({ name: activeStorageKey, storage: volatileStorage });
    store.setState({ data: emptyAppData(), storageNotice: null });
    store.persist.setOptions({ name: activeStorageKey, storage: jsonStorage });
    await store.persist.rehydrate();
    const state = store.getState();
    if (!state.storageNotice && workspaceHasNoUserData(state.data)) {
      store.setState({ data: { ...createSeedData(), openingBalance: state.data.openingBalance } });
    }
  };
  return store;
}

export const useDemoStore = createDemoStore(browserStorage, { seedInitialData: true, skipHydration: true });
