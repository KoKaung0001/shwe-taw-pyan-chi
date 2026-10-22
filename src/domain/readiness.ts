import type { AppData } from './types';

export const readinessDocumentIds = [
  'identity_document',
  'invoice_payment_evidence',
] as const;

export type ReadinessDocumentId = (typeof readinessDocumentIds)[number];

export type RecordCheckId =
  | 'income_records'
  | 'expense_records'
  | 'receipt_evidence'
  | 'transaction_complete'
  | 'identity_document'
  | 'invoice_payment_evidence';

export function buildRecordChecks(data: AppData) {
  const categorizedCount = data.transactions.filter(
    (transaction) => transaction.categoryId !== null,
  ).length;
  return [
    {
      id: 'income_records' as const,
      complete: data.transactions.some(
        (transaction) => transaction.type === 'income',
      ),
    },
    {
      id: 'expense_records' as const,
      complete: data.transactions.some(
        (transaction) => transaction.type === 'expense',
      ),
    },
    {
      id: 'receipt_evidence' as const,
      complete: data.transactions.some((transaction) => transaction.source === 'receipt_image' || transaction.source === 'screenshot'),
    },
    {
      id: 'transaction_complete' as const,
      complete:
        data.transactions.length > 0 &&
        data.transactions.every((transaction) => Boolean(transaction.categoryId || transaction.description?.trim())),
      values: {
        categorized: categorizedCount,
        total: data.transactions.length,
      },
    },
    { id: 'identity_document' as const, complete: Boolean(data.checklist.identity_document) },
    { id: 'invoice_payment_evidence' as const, complete: Boolean(data.checklist.invoice_payment_evidence) },
  ];
}

const categoryKeywords: Record<string, readonly string[]> = {
  'client-income': ['client', 'freelance', 'project', 'consulting', 'service'],
  sales: ['sale', 'sales', 'order', 'customer', 'product'],
  'other-income': ['refund', 'interest', 'bonus'],
  supplies: ['supply', 'supplies', 'packaging', 'stationery'],
  inventory: ['stock', 'inventory', 'wholesale', 'goods'],
  transport: ['taxi', 'bus', 'fuel', 'delivery', 'transport'],
  utilities: ['electricity', 'internet', 'phone bill', 'water bill', 'utility'],
  rent: ['rent', 'lease'],
  marketing: ['ads', 'advertising', 'promotion', 'marketing'],
  food: ['meal', 'lunch', 'dinner', 'food'],
};

/** Suggest a matching existing category; callers must ask the user to apply it. */
export function suggestCategory(
  description: string,
  type: 'income' | 'expense',
  categories: AppData['categories'],
): string | null {
  const normalized = description.toLocaleLowerCase().trim();
  if (!normalized) return null;
  const matches = categories
    .filter((category) => category.type === type || category.type === 'both')
    .map((category) => ({
      categoryId: category.id,
      keyword: (categoryKeywords[category.id] ?? []).find((keyword) =>
        normalized.includes(keyword),
      ),
    }))
    .filter((match) => match.keyword)
    .sort((a, b) => b.keyword!.length - a.keyword!.length);
  return matches[0]?.categoryId ?? null;
}
