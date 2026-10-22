import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createSeedData } from '../domain/seedData';
import { STORAGE_KEY } from '../store/persistence';
import { getLocalImportCandidate } from './workspaceRepository';

const backend = vi.hoisted(() => ({ tables: new Map<string, Record<string, unknown>[]>(), client: null as unknown }));
vi.mock('./supabaseClient', () => ({ getSupabaseClient: () => backend.client }));
import { importLocalWorkspace, loadWorkspace, saveWorkspace } from './workspaceRepository';

interface MockResult { data: Record<string, unknown>[] | null; error: null }
interface FakeQuery extends PromiseLike<MockResult> {
  mode: string;
  filters: [string, unknown][];
  excluded: { key: string; values: string[] } | null;
  input: Record<string, unknown>[];
  select(): FakeQuery;
  eq(key: string, value: unknown): FakeQuery;
  not(key: string, operator: string, value: string): FakeQuery;
  maybeSingle(): Promise<{ data: Record<string, unknown> | null; error: null }>;
  upsert(rows: Record<string, unknown> | Record<string, unknown>[]): FakeQuery;
  delete(): FakeQuery;
  execute(): Promise<MockResult>;
}

function fakeClient() {
  return {
    from(table: string) {
      const query = { mode: 'select', filters: [] as [string, unknown][], excluded: null as { key: string; values: string[] } | null, input: [] as Record<string, unknown>[] } as FakeQuery;
      query.select = () => query;
      query.eq = (key: string, value: unknown) => { query.filters.push([key, value]); return query; };
      query.not = (key: string, _operator: string, value: string) => { query.excluded = { key, values: value.slice(1, -1).split(',').map((item) => item.replace(/^"|"$/g, '').replaceAll('\\"', '"')) }; return query; };
      query.maybeSingle = async () => {
        const result = await query.execute();
        return { data: result.data?.[0] ?? null, error: null };
      };
      query.upsert = (rows: Record<string, unknown> | Record<string, unknown>[]) => { query.mode = 'upsert'; query.input = Array.isArray(rows) ? rows : [rows]; return query; };
      query.delete = () => { query.mode = 'delete'; return query; };
      query.execute = async () => {
        const existing = backend.tables.get(table) ?? [];
        if (query.mode === 'upsert') {
          const merged = [...existing];
          for (const row of query.input) {
            const index = merged.findIndex((item) => Object.keys(row).filter((key) => key !== 'payload').every((key) => item[key] === row[key]) || item.user_id === row.user_id && (row.id ? item.id === row.id : item.document_key === row.document_key));
            if (index < 0) merged.push(row); else merged[index] = { ...merged[index], ...row };
          }
          backend.tables.set(table, merged);
          return { data: null, error: null };
        }
        if (query.mode === 'delete') {
          const remaining = existing.filter((row) => {
            const matches = query.filters.every(([key, value]: [string, unknown]) => row[key] === value);
            const excluded = query.excluded?.values.includes(String(row[query.excluded.key])) ?? false;
            return !matches || excluded;
          });
          backend.tables.set(table, remaining);
          return { data: null, error: null };
        }
        const selected = existing.filter((row) => query.filters.every(([key, value]: [string, unknown]) => row[key] === value));
        return { data: selected, error: null };
      };
      query.then = (resolve, reject) => query.execute().then(resolve, reject);
      return query;
    },
  };
}

const email = 'legacy@example.com';
const accountKey = `${STORAGE_KEY}:account:${encodeURIComponent(email)}`;
afterEach(() => window.localStorage.clear());
beforeEach(() => { backend.tables = new Map(); backend.client = fakeClient(); });

describe('legacy workspace import preview', () => {
  it('previews all data, including sample records, only for the matching account email', async () => {
    const data = createSeedData();
    const workspace = { data, storageNotice: null, timeZone: 'Asia/Rangoon' };
    window.localStorage.setItem(accountKey, JSON.stringify({ version: 1, state: workspace }));
    window.localStorage.setItem(`${STORAGE_KEY}:account:other%40example.com`, JSON.stringify({ version: 1, state: { ...workspace, data: createSeedData() } }));
    window.localStorage.setItem(STORAGE_KEY, 'legacy shared data stays untouched');

    const candidate = await getLocalImportCandidate('Legacy@Example.com');

    expect(candidate?.workspace.data.transactions).toHaveLength(data.transactions.length);
    expect(candidate?.counts.transactions).toBe(data.transactions.length);
    expect(candidate?.counts.receivables).toBe(data.receivables.length);
    expect(window.localStorage.getItem(STORAGE_KEY)).toBe('legacy shared data stays untouched');
    expect(candidate?.key).toBe(accountKey);
  });

  it('ignores malformed or absent account records instead of importing them', async () => {
    window.localStorage.setItem(accountKey, '{malformed');
    await expect(getLocalImportCandidate(email)).resolves.toBeNull();
    window.localStorage.clear();
    await expect(getLocalImportCandidate(email)).resolves.toBeNull();
  });

  it('round-trips all relational collections under the owning user and isolates another user', async () => {
    const data = createSeedData();
    const workspace = { data, storageNotice: null, timeZone: 'Asia/Rangoon' };
    await saveWorkspace('owner-a', workspace);
    const restored = await loadWorkspace('owner-a');
    const otherUser = await loadWorkspace('owner-b');
    expect(restored.data).toEqual(data);
    expect(otherUser.data.transactions).toEqual([]);
    expect(backend.tables.get('transactions')?.every((row) => row.user_id === 'owner-a')).toBe(true);
    expect(backend.tables.get('categories')?.length).toBe(data.categories.length);
    expect(backend.tables.get('payment_occurrences')?.length).toBe(data.paymentOccurrences.length);
    expect(backend.tables.get('readiness_documents')?.length).toBe(0);
  });

  it('merges and safely retries a confirmed local import without removing existing rows', async () => {
    const serverData = createSeedData();
    await saveWorkspace('owner-a', { data: serverData, storageNotice: null, timeZone: 'Asia/Rangoon' });
    const localData = createSeedData();
    localData.transactions.push({ id: 'legacy-extra', type: 'income', amount: 15_000, currency: 'MMK', date: '2026-10-22', categoryId: 'client-income', counterpartyId: null, cashStatus: 'settled', confirmationStatus: 'not_applicable', source: 'manual', ocrReviewStatus: 'not_applicable', createdAt: '2026-10-22T08:00:00+06:30', updatedAt: '2026-10-22T08:00:00+06:30', description: 'Legacy extra' });
    const localWorkspace = { data: localData, storageNotice: null, timeZone: 'Asia/Rangoon' };

    await importLocalWorkspace('owner-a', email, localWorkspace);
    await importLocalWorkspace('owner-a', email, localWorkspace);
    const restored = await loadWorkspace('owner-a');

    expect(restored.data.transactions).toHaveLength(serverData.transactions.length + 1);
    expect(restored.data.transactions.filter((item) => item.id === 'legacy-extra')).toHaveLength(1);
    expect(backend.tables.get('workspace_imports')?.[0]).toMatchObject({ status: 'imported', source_email: email });
  });
});
