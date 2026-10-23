import { fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, expect, it, vi } from 'vitest';
import { TransactionsPage } from './FinancialPages';
import { createSeedData } from '../domain/seedData';
import { emptyAppData } from '../domain/types';
import { useDemoStore } from '../store/demoStore';

afterEach(() => {
  vi.useRealTimers();
  useDemoStore.getState().replaceData(emptyAppData());
});

it('shows a paid demo receivable as identifiable, searchable income exactly once', () => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-10-23T06:00:00Z'));
  useDemoStore.getState().replaceData(createSeedData());
  render(<MemoryRouter><TransactionsPage /></MemoryRouter>);
  const receivableRow = screen.getByText('Mya Thida Boutique').closest('li')!;
  fireEvent.click(within(receivableRow).getByRole('button', { name: 'Mark paid' }));
  const data = useDemoStore.getState().data;
  const receivable = data.receivables.find((item) => item.counterparty === 'Mya Thida Boutique')!;
  expect(receivable.status).toBe('paid');
  expect(data.transactions.find((item) => item.id === receivable.linkedIncomeTransactionId))
    .toMatchObject({ type: 'income', amount: 185_000, cashStatus: 'settled', date: '2026-10-23' });
  const records = screen.getByRole('list', { name: 'Transactions' });
  expect(within(records).getByText(/Mya Thida Boutique/)).toBeVisible();
  fireEvent.change(screen.getByLabelText('Search records'), { target: { value: 'Mya Thida Boutique' } });
  expect(within(records).getAllByRole('listitem')).toHaveLength(1);
  expect(within(records).getByText('185,000 MMK')).toBeVisible();
  useDemoStore.getState().settleReceivable(receivable.id);
  expect(useDemoStore.getState().data.transactions).toHaveLength(data.transactions.length);
});
