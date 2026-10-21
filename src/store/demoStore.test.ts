import { describe, expect, it } from 'vitest';
import type { StateStorage } from 'zustand/middleware';
import { emptyAppData, type AppData } from '../domain/types';
import { createDemoStore } from './demoStore';
import { PERSISTENCE_VERSION, STORAGE_KEY } from './persistence';
import { fixedClock } from '../services/clock';

function memoryStorage(initial: string | null = null) {
  const values = new Map<string, string>();
  if (initial !== null) values.set(STORAGE_KEY, initial);
  const storage: StateStorage = {
    getItem: async (key) => values.get(key) ?? null,
    setItem: async (key, value) => {
      values.set(key, value);
    },
    removeItem: async (key) => {
      values.delete(key);
    },
  };
  return { storage, values };
}

const exampleData = (): AppData => ({
  ...emptyAppData(),
  openingBalance: {
    amount: 125_000,
    referenceAt: '2026-10-21T08:00:00+06:30',
    timeZone: 'Asia/Rangoon',
  },
});

describe('versioned demo persistence', () => {
  it('starts with an empty workspace without reporting corrupt saved data', async () => {
    const store = createDemoStore(memoryStorage().storage, {
      skipHydration: true,
    });
    await store.persist.rehydrate();
    expect(store.getState().data).toEqual(emptyAppData());
    expect(store.getState().storageNotice).toBeNull();
  });

  it('processes a due one-time schedule once and restores it as unpaid on request', () => {
    const store = createDemoStore(memoryStorage().storage, {
      skipHydration: true,
    });
    const rule = {
      id: 'bill-1',
      type: 'expense' as const,
      amount: 45_000,
      categoryId: 'utilities',
      description: 'Electricity bill',
      counterpartyId: null,
      schedule: { kind: 'one_time' as const, dueDate: '2026-11-05' },
      active: true,
      createdAt: '2026-11-01T04:30:00.000Z',
      updatedAt: '2026-11-01T04:30:00.000Z',
    };
    store
      .getState()
      .createScheduleRule(rule, fixedClock('2026-11-01T12:00:00+06:30'));
    expect(store.getState().data.paymentOccurrences[0].status).toBe(
      'scheduled',
    );
    store
      .getState()
      .processDueSchedules(fixedClock('2026-11-06T09:00:00+06:30'));
    expect(store.getState().data.transactions).toHaveLength(1);
    const occurrenceId = store.getState().data.paymentOccurrences[0].id;
    expect(store.getState().data.paymentOccurrences[0].status).toBe(
      'assumed_unconfirmed',
    );
    store
      .getState()
      .processDueSchedules(fixedClock('2026-11-07T09:00:00+06:30'));
    expect(store.getState().data.transactions).toHaveLength(1);
    store.getState().markOccurrenceUnpaid(occurrenceId);
    expect(store.getState().data.paymentOccurrences[0].status).toBe(
      'explicitly_unpaid',
    );
    expect(store.getState().data.transactions[0]).toMatchObject({
      date: '2026-11-05',
      dueDate: '2026-11-05',
      cashStatus: 'pending',
      confirmationStatus: 'not_applicable',
    });
    store
      .getState()
      .processDueSchedules(fixedClock('2026-11-20T09:00:00+06:30'));
    expect(store.getState().data.transactions).toHaveLength(1);
    expect(store.getState().data.paymentOccurrences[0].status).toBe(
      'explicitly_unpaid',
    );
  });
  it('creates monthly catch-up occurrences and cancels only future months', () => {
    const store = createDemoStore(memoryStorage().storage, {
      skipHydration: true,
    });
    store.getState().createScheduleRule(
      {
        id: 'monthly-rent',
        type: 'expense',
        amount: 220_000,
        categoryId: 'rent',
        counterpartyId: null,
        schedule: { kind: 'monthly', startDate: '2026-01-31', dayOfMonth: 31 },
        active: true,
        createdAt: '2026-01-01T00:00:00Z',
        updatedAt: '2026-01-01T00:00:00Z',
      },
      fixedClock('2026-02-28T12:00:00+06:30'),
    );
    const beforeCancel = store.getState().data;
    expect(
      beforeCancel.paymentOccurrences.filter(
        (item) => item.status === 'assumed_unconfirmed',
      ),
    ).toHaveLength(2);
    expect(
      beforeCancel.paymentOccurrences.find(
        (item) => item.originalDueDate === '2026-03-31',
      )?.status,
    ).toBe('scheduled');

    store.getState().cancelScheduleRule('monthly-rent');
    const afterCancel = store.getState().data;
    expect(
      afterCancel.paymentOccurrences.every(
        (item) => item.status !== 'scheduled',
      ),
    ).toBe(true);
    expect(
      afterCancel.paymentOccurrences.filter(
        (item) => item.status === 'assumed_unconfirmed',
      ),
    ).toHaveLength(2);
    store
      .getState()
      .processDueSchedules(fixedClock('2026-04-30T12:00:00+06:30'));
    expect(store.getState().data.transactions).toHaveLength(2);
    expect(store.getState().data.scheduleRules[0].active).toBe(false);
  });
  it('saves a manual transaction, corrects the same ID, then supports delete and undo', () => {
    const store = createDemoStore(memoryStorage().storage, {
      skipHydration: true,
    });
    store.getState().setOpeningBalance({
      amount: 100_000,
      referenceAt: '2026-10-21T08:00:00+06:30',
      timeZone: 'Asia/Rangoon',
    });
    const record = {
      id: 'manual-1',
      type: 'expense' as const,
      amount: 12_000,
      currency: 'MMK' as const,
      date: '2026-10-21',
      dueDate: '2026-10-22',
      openingDayDisposition: 'after_reference' as const,
      categoryId: 'supplies',
      counterpartyId: null,
      cashStatus: 'pending' as const,
      confirmationStatus: 'not_applicable' as const,
      source: 'manual' as const,
      ocrReviewStatus: 'not_applicable' as const,
      createdAt: '2026-10-21T02:00:00Z',
      updatedAt: '2026-10-21T02:00:00Z',
    };
    store.getState().saveTransaction(record);
    store.getState().saveTransaction({
      ...record,
      amount: 10_000,
      cashStatus: 'settled',
      dueDate: undefined,
      updatedAt: '2026-10-21T03:00:00Z',
    });
    expect(store.getState().data.transactions).toHaveLength(1);
    expect(store.getState().data.transactions[0]).toMatchObject({
      id: 'manual-1',
      amount: 10_000,
      createdAt: record.createdAt,
    });
    const deleted = store.getState().deleteTransaction('manual-1');
    expect(store.getState().data.transactions).toHaveLength(0);
    store.getState().restoreTransaction(deleted!);
    expect(store.getState().data.transactions[0].id).toBe('manual-1');
  });
  it('validates updates and persists the single versioned app-data record', async () => {
    const { storage, values } = memoryStorage();
    const store = createDemoStore(storage, { skipHydration: true });
    await store.persist.rehydrate();
    store.getState().replaceData(exampleData());
    await new Promise((resolve) => setTimeout(resolve, 0));
    const saved = JSON.parse(values.get(STORAGE_KEY)!);
    expect(saved.version).toBe(PERSISTENCE_VERSION);
    expect(saved.state.data.openingBalance.amount).toBe(125_000);
    const restored = createDemoStore(storage, { skipHydration: true });
    await restored.persist.rehydrate();
    expect(restored.getState().data.openingBalance?.amount).toBe(125_000);
    expect(() =>
      store.getState().replaceData({
        ...emptyAppData(),
        transactions: [{}],
      } as unknown as AppData),
    ).toThrow();
    expect(store.getState().data.openingBalance?.amount).toBe(125_000);
  });
  it('resets corrupt JSON and leaves a visible recovery notice', async () => {
    const { storage, values } = memoryStorage('{bad json');
    const store = createDemoStore(storage, { skipHydration: true });
    await store.persist.rehydrate();
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(store.getState().data).toEqual(emptyAppData());
    expect(store.getState().storageNotice).toMatch(/could not be read/);
    expect(JSON.parse(values.get(STORAGE_KEY)!).version).toBe(
      PERSISTENCE_VERSION,
    );
  });
  it('resets unknown versions with a recovery notice', async () => {
    const { storage } = memoryStorage(
      JSON.stringify({ version: 99, state: { legacy: true } }),
    );
    const store = createDemoStore(storage, { skipHydration: true });
    await store.persist.rehydrate();
    expect(store.getState().data).toEqual(emptyAppData());
    expect(store.getState().storageNotice).toContain('version 99');
  });
  it('resets data that fails current schema validation', async () => {
    const { storage } = memoryStorage(
      JSON.stringify({
        version: PERSISTENCE_VERSION,
        state: { data: { transactions: [{}] }, storageNotice: null },
      }),
    );
    const store = createDemoStore(storage, { skipHydration: true });
    await store.persist.rehydrate();
    expect(store.getState().data).toEqual(emptyAppData());
    expect(store.getState().storageNotice).toContain('invalid');
  });
  it('keeps current in-memory data and reports a browser storage write failure', async () => {
    const storage: StateStorage = {
      getItem: async () => null,
      setItem: async () => {
        throw new Error('storage unavailable');
      },
      removeItem: async () => {},
    };
    const store = createDemoStore(storage, { skipHydration: true });
    await store.persist.rehydrate();
    store.getState().replaceData(exampleData());
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(store.getState().data.openingBalance?.amount).toBe(125_000);
    expect(store.getState().storageNotice).toMatch(/could not be saved/);
  });
});
