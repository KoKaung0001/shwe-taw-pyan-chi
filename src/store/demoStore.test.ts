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

describe('workspace persistence', () => {
  it('starts new workspaces empty and leaves the old shared workspace untouched', async () => {
    const { storage, values } = memoryStorage();
    const legacy = JSON.stringify({ version: PERSISTENCE_VERSION, state: { oldSharedRecords: true } });
    values.set(STORAGE_KEY, legacy);
    const store = createDemoStore(storage, { skipHydration: true });
    expect(store.getState().data.transactions).toHaveLength(0);
    expect(store.getState().data.receivables).toHaveLength(0);
    expect(values.get(STORAGE_KEY)).toBe(legacy);
  });
  it('preserves legacy opening balance, adjustments and transaction classifications while ignoring them in new flows', async () => {
    const { storage } = memoryStorage();
    const legacyData: AppData = {
      ...exampleData(),
      balanceAdjustments: [{ id: 'adjustment-1', amount: -5_000, currency: 'MMK', date: '2026-10-21', occurredAt: '2026-10-21T01:00:00Z', description: 'Legacy adjustment', createdAt: '2026-10-21T01:00:00Z' }],
      transactions: [{ id: 'old', type: 'income', amount: 10_000, currency: 'MMK', date: '2026-10-21', categoryId: null, counterpartyId: null, cashStatus: 'settled', confirmationStatus: 'not_applicable', openingDayDisposition: 'already_in_opening', source: 'manual', ocrReviewStatus: 'not_applicable', createdAt: '2026-10-21T00:00:00Z', updatedAt: '2026-10-21T00:00:00Z' }],
    };
    const store = createDemoStore(storage, { skipHydration: true });
    await store.persist.rehydrate();
    store.getState().replaceData(legacyData);
    store.getState().setTimeZone('America/New_York');
    await new Promise((resolve) => setTimeout(resolve, 0));
    const restored = createDemoStore(storage, { skipHydration: true });
    await restored.persist.rehydrate();
    expect(restored.getState().data.openingBalance).toEqual(legacyData.openingBalance);
    expect(restored.getState().data.balanceAdjustments).toEqual(legacyData.balanceAdjustments);
    expect(restored.getState().data.transactions[0].openingDayDisposition).toBe('already_in_opening');
  });
  it('settles each explicit receivable into exactly one linked income record', () => {
    const store = createDemoStore(memoryStorage().storage, { skipHydration: true });
    const now = '2026-10-21T08:00:00Z';
    store.getState().createReceivable({ id: 'receivable-1', amount: 42_000, currency: 'MMK', date: '2026-10-20', counterparty: 'Customer', description: 'Order', categoryId: 'sales', status: 'unpaid', createdAt: now, updatedAt: now });
    store.getState().settleReceivable('receivable-1');
    store.getState().settleReceivable('receivable-1');
    const data = store.getState().data;
    expect(data.receivables[0]).toMatchObject({ status: 'paid', linkedIncomeTransactionId: expect.any(String) });
    expect(data.transactions.filter((item) => item.type === 'income' && item.amount === 42_000)).toHaveLength(1);
  });

  it('persists readiness document availability as checklist state', async () => {
    const { storage } = memoryStorage();
    const store = createDemoStore(storage, { skipHydration: true });
    await store.persist.rehydrate();
    store.getState().setReadinessDocument('identity_document', true);
    expect(store.getState().data.checklist.identity_document).toBe(true);

    const restored = createDemoStore(storage, { skipHydration: true });
    await restored.persist.rehydrate();
    expect(restored.getState().data.checklist.identity_document).toBe(true);
  });

  it('persists bank-specific self-reported readiness documents without changing the storage schema', async () => {
    const { storage } = memoryStorage();
    const store = createDemoStore(storage, { skipHydration: true });
    await store.persist.rehydrate();
    store.getState().setBankReadinessDocument('yoma', 'business_license', true);
    const restored = createDemoStore(storage, { skipHydration: true });
    await restored.persist.rehydrate();
    expect(restored.getState().data.checklist['bank.yoma.business_license']).toBe(true);
    expect(() => restored.getState().setBankReadinessDocument('mcb', 'profit_loss', true)).toThrow(/only user-reported/i);
  });

  it('starts with an empty workspace without reporting corrupt saved data', async () => {
    const store = createDemoStore(memoryStorage().storage, {
      skipHydration: true,
    });
    await store.persist.rehydrate();
    expect(store.getState().data).toEqual(emptyAppData());
    expect(store.getState().storageNotice).toBeNull();
  });

  it('persists Keep both and removes only the selected duplicate record', () => {
    const store = createDemoStore(memoryStorage().storage, {
      skipHydration: true,
    });
    const transaction = (id: string) => ({
      id,
      type: 'expense' as const,
      amount: 12_000,
      currency: 'MMK' as const,
      date: '2026-10-10',
      categoryId: 'supplies',
      counterpartyId: null,
      description: 'Packaging supplies',
      cashStatus: 'settled' as const,
      confirmationStatus: 'not_applicable' as const,
      source: 'manual' as const,
      ocrReviewStatus: 'not_applicable' as const,
      createdAt: '2026-10-10T00:00:00Z',
      updatedAt: '2026-10-10T00:00:00Z',
    });
    store.getState().replaceData({
      ...exampleData(),
      transactions: [transaction('first'), transaction('second')],
    });
    store.getState().resolveDuplicate({
      id: 'review-keep',
      firstTransactionId: 'first',
      secondTransactionId: 'second',
      fingerprint: 'version-a',
      resolution: 'keep_both',
      reviewedAt: '2026-10-21T00:00:00Z',
    });
    expect(store.getState().data.transactions).toHaveLength(2);
    expect(store.getState().data.duplicateReviews[0].resolution).toBe(
      'keep_both',
    );

    store.getState().resolveDuplicate({
      id: 'review-remove',
      firstTransactionId: 'first',
      secondTransactionId: 'second',
      fingerprint: 'version-b',
      resolution: 'duplicate_removed',
      redundantTransactionId: 'second',
      reviewedAt: '2026-10-21T00:01:00Z',
    });
    expect(store.getState().data.transactions.map((item) => item.id)).toEqual([
      'first',
    ]);
    expect(store.getState().data.duplicateReviews).toHaveLength(1);
    expect(
      store.getState().data.duplicateReviews[0].redundantTransactionId,
    ).toBe('second');
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
