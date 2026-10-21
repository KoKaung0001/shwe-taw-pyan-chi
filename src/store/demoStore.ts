import { create } from 'zustand';
import { persist, type StateStorage } from 'zustand/middleware';
import {
  emptyAppData,
  appDataSchema,
  persistedStoreSchema,
  transactionSchema,
  scheduledRuleSchema,
  occurrenceIdFor,
  type AppData,
  type PersistedStore,
  type ScheduledRule,
  type Transaction,
} from '../domain/types';
import { processSchedules } from '../domain/scheduleLifecycle';
import { systemClock, type Clock } from '../services/clock';
import {
  browserStorage,
  createSafeJsonStorage,
  PERSISTENCE_VERSION,
  STORAGE_KEY,
} from './persistence';

export interface DemoStore extends PersistedStore {
  replaceData(data: AppData): void;
  setOpeningBalance(openingBalance: AppData['openingBalance']): void;
  saveTransaction(transaction: Transaction): void;
  deleteTransaction(id: string): Transaction | null;
  restoreTransaction(transaction: Transaction): void;
  createScheduleRule(rule: ScheduledRule, clock?: Clock): void;
  processDueSchedules(clock?: Clock): void;
  cancelScheduleRule(ruleId: string): void;
  markOccurrenceUnpaid(occurrenceId: string): void;
  dismissStorageNotice(): void;
}

export function createDemoStore(
  backingStorage: StateStorage = browserStorage,
  options: { skipHydration?: boolean } = {},
) {
  const jsonStorage = createSafeJsonStorage(backingStorage, (message) => {
    store.setState({ storageNotice: message });
  });

  const store = create<DemoStore>()(
    persist(
      (set, get) => ({
        data: emptyAppData(),
        storageNotice: null,
        replaceData: (data) => {
          const validated = appDataSchema.parse(data);
          set({ data: validated });
        },
        setOpeningBalance: (openingBalance) => {
          const validated = appDataSchema.parse({
            ...get().data,
            openingBalance,
          });
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
        createScheduleRule: (rule, clock = systemClock) => {
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
        processDueSchedules: (clock = systemClock) => {
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
          }) as DemoStore,
        migrate: (_persistedState, previousVersion) => ({
          data: emptyAppData(),
          storageNotice: `Saved demo data version ${previousVersion} was unsupported and has been reset.`,
        }),
        merge: (persisted, current) => {
          if (persisted === null || persisted === undefined) return current;
          const result = persistedStoreSchema.safeParse(persisted);
          if (!result.success) {
            void Promise.resolve(backingStorage.removeItem(STORAGE_KEY)).catch(
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
            void Promise.resolve(backingStorage.removeItem(STORAGE_KEY)).catch(
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
  return store;
}

export const useDemoStore = createDemoStore();
