import { emptyAppData, transactionSchema, type AppData, type Transaction } from './types';

const rows: Array<Pick<Transaction, 'id' | 'type' | 'amount' | 'date' | 'categoryId' | 'description' | 'occurredAt'>> = [
  { id: 'oct-2026-01-salary', type: 'income', amount: 1_200_000, date: '2026-10-01', categoryId: 'client-income', description: 'Monthly salary', occurredAt: '2026-10-01T09:00:00+06:30' },
  { id: 'oct-2026-02-food', type: 'expense', amount: 85_000, date: '2026-10-02', categoryId: 'food', description: 'Groceries', occurredAt: '2026-10-02T18:10:00+06:30' },
  { id: 'oct-2026-03-transport', type: 'expense', amount: 18_000, date: '2026-10-03', categoryId: 'transport', description: 'Transportation', occurredAt: '2026-10-03T08:25:00+06:30' },
  { id: 'oct-2026-04-food', type: 'expense', amount: 22_000, date: '2026-10-04', categoryId: 'food', description: 'Lunch and dinner', occurredAt: '2026-10-04T19:05:00+06:30' },
  { id: 'oct-2026-05-bills', type: 'expense', amount: 35_000, date: '2026-10-05', categoryId: 'utilities', description: 'Internet bill', occurredAt: '2026-10-05T10:15:00+06:30' },
  { id: 'oct-2026-06-freelance', type: 'income', amount: 250_000, date: '2026-10-06', categoryId: 'sales', description: 'Design project payment', occurredAt: '2026-10-06T14:35:00+06:30' },
  { id: 'oct-2026-07-shopping', type: 'expense', amount: 75_000, date: '2026-10-07', categoryId: 'supplies', description: 'Household essentials', occurredAt: '2026-10-07T16:40:00+06:30' },
  { id: 'oct-2026-08-food', type: 'expense', amount: 48_000, date: '2026-10-08', categoryId: 'food', description: 'Groceries', occurredAt: '2026-10-08T18:20:00+06:30' },
  { id: 'oct-2026-09-transport', type: 'expense', amount: 16_000, date: '2026-10-09', categoryId: 'transport', description: 'Taxi', occurredAt: '2026-10-09T20:10:00+06:30' },
  { id: 'oct-2026-10-bills', type: 'expense', amount: 55_000, date: '2026-10-10', categoryId: 'utilities', description: 'Electricity', occurredAt: '2026-10-10T11:25:00+06:30' },
  { id: 'oct-2026-11-entertainment', type: 'expense', amount: 30_000, date: '2026-10-11', categoryId: 'other-expense', description: 'Cinema and snacks', occurredAt: '2026-10-11T20:30:00+06:30' },
  { id: 'oct-2026-12-other-income', type: 'income', amount: 120_000, date: '2026-10-12', categoryId: 'other-income', description: 'Part-time project', occurredAt: '2026-10-12T13:20:00+06:30' },
  { id: 'oct-2026-13-food', type: 'expense', amount: 28_000, date: '2026-10-13', categoryId: 'food', description: 'Restaurant', occurredAt: '2026-10-13T19:45:00+06:30' },
  { id: 'oct-2026-14-health', type: 'expense', amount: 24_000, date: '2026-10-14', categoryId: 'other-expense', description: 'Pharmacy', occurredAt: '2026-10-14T12:05:00+06:30' },
  { id: 'oct-2026-15-shopping', type: 'expense', amount: 65_000, date: '2026-10-15', categoryId: 'supplies', description: 'Personal items', occurredAt: '2026-10-15T17:15:00+06:30' },
  { id: 'oct-2026-16-transport', type: 'expense', amount: 20_000, date: '2026-10-16', categoryId: 'transport', description: 'Transportation', occurredAt: '2026-10-16T08:35:00+06:30' },
  { id: 'oct-2026-17-bills', type: 'expense', amount: 15_000, date: '2026-10-17', categoryId: 'utilities', description: 'Mobile data', occurredAt: '2026-10-17T10:50:00+06:30' },
  { id: 'oct-2026-18-food', type: 'expense', amount: 60_000, date: '2026-10-18', categoryId: 'food', description: 'Groceries', occurredAt: '2026-10-18T18:05:00+06:30' },
  { id: 'oct-2026-19-entertainment', type: 'expense', amount: 42_000, date: '2026-10-19', categoryId: 'other-expense', description: 'Weekend outing', occurredAt: '2026-10-19T20:45:00+06:30' },
  { id: 'oct-2026-20-freelance', type: 'income', amount: 180_000, date: '2026-10-20', categoryId: 'sales', description: 'Small project payment', occurredAt: '2026-10-20T15:10:00+06:30' },
  { id: 'oct-2026-21-food', type: 'expense', amount: 25_000, date: '2026-10-21', categoryId: 'food', description: 'Meals', occurredAt: '2026-10-21T19:30:00+06:30' },
];

export function createSeedData(): AppData {
  const data = emptyAppData();
  data.transactions = rows.map((row) => transactionSchema.parse({
    ...row,
    currency: 'MMK',
    counterpartyId: null,
    cashStatus: 'settled',
    confirmationStatus: 'not_applicable',
    source: 'manual',
    ocrReviewStatus: 'not_applicable',
    createdAt: row.occurredAt,
    updatedAt: row.occurredAt,
  }));
  return data;
}
