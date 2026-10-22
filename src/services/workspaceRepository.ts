import type { AppData, PersistedStore, Transaction, Receivable, Category, Counterparty, BalanceAdjustment, ScheduledRule, PaymentOccurrence, DuplicateReview } from '../domain/types';
import { appDataSchema, emptyAppData, persistedStoreSchema } from '../domain/types';
import type { Database, Json } from './database.types';
import { getSupabaseClient } from './supabaseClient';

type Tables = Database['public']['Tables'];
type EntityTable = 'categories' | 'counterparties' | 'transactions' | 'receivables' | 'balance_adjustments' | 'scheduled_rules' | 'payment_occurrences' | 'duplicate_reviews';
const entityTables: EntityTable[] = ['categories', 'counterparties', 'transactions', 'receivables', 'balance_adjustments', 'scheduled_rules', 'payment_occurrences', 'duplicate_reviews'];
const throwIfError = (error: { message: string } | null) => { if (error) throw new Error(error.message); };
const optional = <T>(value: T | undefined) => value ?? null;

function encode(userId: string, data: AppData) {
  return {
    categories: data.categories.map((x: Category) => ({ user_id: userId, id: x.id, name: x.name, type: x.type })),
    counterparties: data.counterparties.map((x: Counterparty) => ({ user_id: userId, id: x.id, name: x.name, kind: x.kind })),
    transactions: data.transactions.map((x: Transaction) => ({ user_id: userId, id: x.id, type: x.type, amount: x.amount, currency: x.currency, date: x.date, due_date: optional(x.dueDate), occurred_at: optional(x.occurredAt), opening_day_disposition: optional(x.openingDayDisposition), category_id: x.categoryId, description: optional(x.description), reference: optional(x.reference), counterparty_id: x.counterpartyId, cash_status: x.cashStatus, confirmation_status: x.confirmationStatus, source: x.source, ocr_review_status: x.ocrReviewStatus, payment_occurrence_id: optional(x.paymentOccurrenceId), created_at: x.createdAt, updated_at: x.updatedAt })),
    receivables: data.receivables.map((x: Receivable) => ({ user_id: userId, id: x.id, amount: x.amount, currency: x.currency, date: x.date, counterparty: x.counterparty, description: optional(x.description), category_id: x.categoryId, status: x.status, settled_at: optional(x.settledAt), linked_income_transaction_id: optional(x.linkedIncomeTransactionId), created_at: x.createdAt, updated_at: x.updatedAt })),
    balance_adjustments: data.balanceAdjustments.map((x: BalanceAdjustment) => ({ user_id: userId, id: x.id, amount: x.amount, currency: x.currency, date: x.date, occurred_at: x.occurredAt, description: x.description, created_at: x.createdAt })),
    scheduled_rules: data.scheduleRules.map((x: ScheduledRule) => ({ user_id: userId, id: x.id, type: x.type, amount: x.amount, category_id: x.categoryId, description: optional(x.description), counterparty_id: x.counterpartyId, schedule: x.schedule as unknown as Json, active: x.active, created_at: x.createdAt, updated_at: x.updatedAt })),
    payment_occurrences: data.paymentOccurrences.map((x: PaymentOccurrence) => ({ user_id: userId, id: x.id, rule_id: x.ruleId, original_due_date: x.originalDueDate, status: x.status, payment_transaction_id: 'paymentTransactionId' in x ? x.paymentTransactionId : null, payment_date: 'paymentDate' in x ? x.paymentDate : null, payment_amount: 'paymentAmount' in x ? x.paymentAmount : null, history: 'history' in x ? x.history as unknown as Json : [] })),
    duplicate_reviews: data.duplicateReviews.map((x: DuplicateReview) => ({ user_id: userId, id: x.id, first_transaction_id: x.firstTransactionId, second_transaction_id: x.secondTransactionId, fingerprint: x.fingerprint, resolution: x.resolution, redundant_transaction_id: optional(x.redundantTransactionId), reviewed_at: x.reviewedAt })),
  };
}

function decode(rows: { [K in EntityTable]: Tables[K]['Row'][] }, settings: Tables['workspace_settings']['Row'] | null, readiness: Tables['readiness_documents']['Row'][]): PersistedStore {
  const data = emptyAppData();
  data.categories = rows.categories.map((x) => ({ id: x.id, name: x.name, type: x.type }));
  if (data.categories.length === 0) data.categories = emptyAppData().categories;
  data.counterparties = rows.counterparties.map((x) => ({ id: x.id, name: x.name, kind: x.kind }));
  data.transactions = rows.transactions.map((x) => ({ id: x.id, type: x.type, amount: Number(x.amount), currency: x.currency, date: x.date, ...(x.due_date ? { dueDate: x.due_date } : {}), ...(x.occurred_at ? { occurredAt: x.occurred_at } : {}), ...(x.opening_day_disposition ? { openingDayDisposition: x.opening_day_disposition } : {}), categoryId: x.category_id, ...(x.description ? { description: x.description } : {}), ...(x.reference ? { reference: x.reference } : {}), counterpartyId: x.counterparty_id, cashStatus: x.cash_status, confirmationStatus: x.confirmation_status, source: x.source, ocrReviewStatus: x.ocr_review_status, ...(x.payment_occurrence_id ? { paymentOccurrenceId: x.payment_occurrence_id } : {}), createdAt: x.created_at, updatedAt: x.updated_at }));
  data.receivables = rows.receivables.map((x) => ({ id: x.id, amount: Number(x.amount), currency: x.currency, date: x.date, counterparty: x.counterparty, ...(x.description ? { description: x.description } : {}), categoryId: x.category_id, status: x.status, ...(x.settled_at ? { settledAt: x.settled_at } : {}), ...(x.linked_income_transaction_id ? { linkedIncomeTransactionId: x.linked_income_transaction_id } : {}), createdAt: x.created_at, updatedAt: x.updated_at }));
  data.balanceAdjustments = rows.balance_adjustments.map((x) => ({ id: x.id, amount: Number(x.amount), currency: x.currency, date: x.date, occurredAt: x.occurred_at, description: x.description, createdAt: x.created_at }));
  data.scheduleRules = rows.scheduled_rules.map((x) => ({ id: x.id, type: x.type, amount: Number(x.amount), categoryId: x.category_id, ...(x.description ? { description: x.description } : {}), counterpartyId: x.counterparty_id, schedule: x.schedule as unknown as ScheduledRule['schedule'], active: x.active, createdAt: x.created_at, updatedAt: x.updated_at }));
  data.paymentOccurrences = rows.payment_occurrences.map((x) => x.status === 'scheduled'
    ? ({ id: x.id, ruleId: x.rule_id, originalDueDate: x.original_due_date, status: 'scheduled' as const })
    : ({ id: x.id, ruleId: x.rule_id, originalDueDate: x.original_due_date, status: x.status as Exclude<PaymentOccurrence['status'], 'scheduled'>, paymentTransactionId: x.payment_transaction_id ?? '', paymentDate: x.payment_date ?? '', paymentAmount: Number(x.payment_amount ?? 0), history: Array.isArray(x.history) ? x.history as unknown as Extract<PaymentOccurrence, { history: unknown[] }>['history'] : [] }));
  data.duplicateReviews = rows.duplicate_reviews.map((x) => ({ id: x.id, firstTransactionId: x.first_transaction_id, secondTransactionId: x.second_transaction_id, fingerprint: x.fingerprint, resolution: x.resolution, ...(x.redundant_transaction_id ? { redundantTransactionId: x.redundant_transaction_id } : {}), reviewedAt: x.reviewed_at }));
  data.checklist = Object.fromEntries(readiness.map((x) => [x.document_key, x.available]));
  data.openingBalance = settings?.opening_balance as unknown as AppData['openingBalance'] ?? null;
  return persistedStoreSchema.parse({ data: appDataSchema.parse(data), timeZone: settings?.time_zone, storageNotice: null });
}

export async function loadWorkspace(userId: string): Promise<PersistedStore> {
  const supabase = getSupabaseClient();
  const [settings, categories, counterparties, transactions, receivables, balanceAdjustments, scheduleRules, paymentOccurrences, duplicateReviews, readiness] = await Promise.all([
    supabase.from('workspace_settings').select('*').eq('user_id', userId).maybeSingle(),
    supabase.from('categories').select('*').eq('user_id', userId),
    supabase.from('counterparties').select('*').eq('user_id', userId),
    supabase.from('transactions').select('*').eq('user_id', userId),
    supabase.from('receivables').select('*').eq('user_id', userId),
    supabase.from('balance_adjustments').select('*').eq('user_id', userId),
    supabase.from('scheduled_rules').select('*').eq('user_id', userId),
    supabase.from('payment_occurrences').select('*').eq('user_id', userId),
    supabase.from('duplicate_reviews').select('*').eq('user_id', userId),
    supabase.from('readiness_documents').select('*').eq('user_id', userId),
  ]);
  [settings, categories, counterparties, transactions, receivables, balanceAdjustments, scheduleRules, paymentOccurrences, duplicateReviews, readiness].forEach((result) => throwIfError(result.error));
  const rows = { categories: categories.data ?? [], counterparties: counterparties.data ?? [], transactions: transactions.data ?? [], receivables: receivables.data ?? [], balance_adjustments: balanceAdjustments.data ?? [], scheduled_rules: scheduleRules.data ?? [], payment_occurrences: paymentOccurrences.data ?? [], duplicate_reviews: duplicateReviews.data ?? [] } as unknown as Parameters<typeof decode>[0];
  return decode(rows, settings.data, readiness.data ?? []);
}

async function writeTable(table: EntityTable, rows: Record<string, unknown>[]) {
  const supabase = getSupabaseClient();
  if (rows.length) throwIfError((await supabase.from(table).upsert(rows as never)).error);
}

async function removeMissing(table: EntityTable, userId: string, rows: Record<string, unknown>[]) {
  const supabase = getSupabaseClient();
  const ids = rows.map((row) => String(row.id).replaceAll('\\', '\\\\').replaceAll('"', '\\"'));
  let deletion = supabase.from(table).delete().eq('user_id', userId);
  if (ids.length) deletion = deletion.not('id', 'in', `(${ids.map((id) => `"${id}"`).join(',')})`);
  throwIfError((await deletion).error);
}

export async function saveWorkspace(userId: string, workspace: PersistedStore, options: { pruneMissing?: boolean } = {}) {
  const supabase = getSupabaseClient();
  const data = appDataSchema.parse(workspace.data);
  const encoded = encode(userId, data);
  for (const table of entityTables) await writeTable(table, encoded[table] as unknown as Record<string, unknown>[]);
  if (options.pruneMissing !== false) {
    for (const table of ['duplicate_reviews', 'payment_occurrences', 'scheduled_rules', 'receivables', 'transactions', 'balance_adjustments', 'counterparties', 'categories'] as EntityTable[]) {
      await removeMissing(table, userId, encoded[table] as unknown as Record<string, unknown>[]);
    }
  }
  const checklistRows = Object.entries(data.checklist).map(([document_key, available]) => ({ user_id: userId, document_key, available }));
  if (checklistRows.length) throwIfError((await supabase.from('readiness_documents').upsert(checklistRows, { onConflict: 'user_id,document_key' })).error);
  if (options.pruneMissing !== false) {
    const documentKeys = checklistRows.map((x) => x.document_key.replaceAll('"', '\\"'));
    let checklistDeletion = supabase.from('readiness_documents').delete().eq('user_id', userId);
    if (documentKeys.length) checklistDeletion = checklistDeletion.not('document_key', 'in', `(${documentKeys.map((key) => `"${key}"`).join(',')})`);
    throwIfError((await checklistDeletion).error);
  }
  const setting: Tables['workspace_settings']['Insert'] = { user_id: userId, time_zone: workspace.timeZone, opening_balance: data.openingBalance as unknown as Json, updated_at: new Date().toISOString() };
  throwIfError((await supabase.from('workspace_settings').upsert(setting, { onConflict: 'user_id', ignoreDuplicates: options.pruneMissing === false })).error);
}

function countsFor(data: AppData) {
  return { transactions: data.transactions.length, receivables: data.receivables.length, categories: data.categories.length, counterparties: data.counterparties.length, schedules: data.scheduleRules.length + data.paymentOccurrences.length, checklistItems: Object.keys(data.checklist).length, adjustments: data.balanceAdjustments.length };
}

export async function getLocalImportCandidate(email: string) {
  if (typeof window === 'undefined') return null;
  const normalized = email.trim().toLowerCase();
  if (!normalized) return null;
  const key = `fintech-companion-demo-v1:account:${encodeURIComponent(normalized)}`;
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return null;
    const value: unknown = JSON.parse(raw);
    if (!value || typeof value !== 'object' || !('state' in value)) return null;
    const parsed = persistedStoreSchema.safeParse((value as { state?: unknown }).state);
    if (!parsed.success) return null;
    const counts = countsFor(parsed.data.data);
    if (counts.transactions + counts.receivables + counts.counterparties + counts.schedules + counts.checklistItems + counts.adjustments === 0) return null;
    return { key, workspace: parsed.data, counts };
  } catch { return null; }
}

export async function getImportStatus(userId: string) {
  const { data, error } = await getSupabaseClient().from('workspace_imports').select('status').eq('user_id', userId).maybeSingle();
  throwIfError(error);
  return data?.status ?? null;
}

export async function importLocalWorkspace(userId: string, email: string, workspace: PersistedStore) {
  const data = appDataSchema.parse(workspace.data);
  await saveWorkspace(userId, workspace, { pruneMissing: false });
  throwIfError((await getSupabaseClient().from('workspace_imports').upsert({ user_id: userId, source_email: email.trim().toLowerCase(), status: 'imported', record_counts: countsFor(data) as unknown as Json, completed_at: new Date().toISOString() }, { onConflict: 'user_id' })).error);
  return loadWorkspace(userId);
}

export async function skipLocalWorkspaceImport(userId: string, email: string) {
  throwIfError((await getSupabaseClient().from('workspace_imports').upsert({ user_id: userId, source_email: email.trim().toLowerCase(), status: 'skipped', record_counts: {}, completed_at: new Date().toISOString() }, { onConflict: 'user_id' })).error);
}
