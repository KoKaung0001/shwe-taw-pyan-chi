import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, it, expect, vi } from 'vitest';
import { App } from './App';
import { useDemoStore } from '../store/demoStore';
import { setAuthUser } from '../services/supabaseAuthSession';
import { emptyAppData } from '../domain/types';
vi.mock('../services/supabaseAuthSession', async (importOriginal) => ({
  ...await importOriginal<typeof import('../services/supabaseAuthSession')>(),
  startAuthSession: () => () => {},
}));
vi.mock('../services/workspaceRepository', () => ({
  loadWorkspace: async () => ({ data: emptyAppData(), storageNotice: null, timeZone: 'Asia/Rangoon' }),
  getImportStatus: async () => 'skipped',
  getLocalImportCandidate: async () => null,
  saveWorkspace: async () => {},
  importLocalWorkspace: async () => ({ data: emptyAppData(), storageNotice: null, timeZone: 'Asia/Rangoon' }),
  skipLocalWorkspaceImport: async () => {},
}));
afterEach(() => setAuthUser(null));
describe('foundation', () => {
  it('retains the reporting period and chart mode after visiting credit readiness', async () => {
    setAuthUser({ id: 'test-user', name: 'Demo User', email: 'demo@example.com' });
    render(<MemoryRouter initialEntries={['/dashboard']}><App /></MemoryRouter>);
    const period = await screen.findByLabelText('Reporting period');
    fireEvent.change(period, { target: { value: 'last_6_months' } });
    fireEvent.click(screen.getByRole('button', { name: 'Net change' }));
    fireEvent.click(screen.getAllByRole('link', { name: 'Credit Readiness' })[0]);
    await screen.findByRole('heading', { name: 'Credit readiness' });
    fireEvent.click(screen.getAllByRole('link', { name: 'Home' })[0]);
    expect(await screen.findByLabelText('Reporting period')).toHaveValue('last_6_months');
    expect(screen.getByRole('button', { name: 'Net change' })).toHaveAttribute('aria-pressed', 'true');
  });
  it('keeps the account session and grounded assistant after navigation', async () => {
    setAuthUser({ id: 'test-user', name: 'Demo User', email: 'demo@example.com' });
    render(
      <MemoryRouter initialEntries={['/dashboard']}>
        <App />
      </MemoryRouter>,
    );
    fireEvent.click((await screen.findAllByRole('link', { name: 'AI Assistant' }))[0]);
    expect(await screen.findByRole('heading', { level: 1 })).toHaveTextContent(
      'Ask about your records',
    );
    expect(await screen.findByRole('button', { name: 'Sign out' })).toBeVisible();
    expect(screen.getByLabelText('Ask about your records')).toBeVisible();
    expect(screen.queryByText('Not implemented yet')).not.toBeInTheDocument();
  });
  it('recovers unknown addresses', async () => {
    setAuthUser({ id: 'test-user', name: 'Demo User', email: 'demo@example.com' });
    render(
      <MemoryRouter initialEntries={['/unknown']}>
        <App />
      </MemoryRouter>,
    );
    expect(
      await screen.findByRole('heading', { name: 'Page not found' }),
    ).toBeVisible();
    fireEvent.click(await screen.findByRole('link', { name: 'Back to dashboard' }));
    expect(await screen.findByRole('heading', { level: 1 })).toHaveTextContent(
      'Welcome, Demo User',
    );
  });

  it('shows bank checklists, app-only FlowScore, and self-reported document controls', async () => {
    setAuthUser({ id: 'test-user', name: 'Demo User', email: 'demo@example.com' });
    useDemoStore.getState().replaceData({
      ...useDemoStore.getState().data,
      checklist: {},
    });
    render(
      <MemoryRouter initialEntries={['/readiness']}>
        <App />
      </MemoryRouter>,
    );
    expect(
      await screen.findByRole('heading', { name: 'Credit readiness' }),
    ).toBeVisible();
    expect(
      screen.getByText(/not a bank score, creditworthiness assessment, or loan approval prediction/i),
    ).toBeVisible();
    expect(screen.getByRole('button', { name: /A Bank/ })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    expect(
      screen.getByRole('progressbar', { name: 'Bank checklist completion' }),
    ).toHaveAttribute('aria-valuenow', '0');
    expect(
      screen.getByRole('heading', { name: 'App-only FlowScore' }),
    ).toBeVisible();
    const identityAvailability = screen.getByRole('checkbox', {
      name: 'I have this document: Personal KYC',
    });
    fireEvent.click(identityAvailability);
    expect(
      useDemoStore.getState().data.checklist['bank.a_bank.personal_kyc'],
    ).toBe(true);
    useDemoStore
      .getState()
      .setBankReadinessDocument('a_bank', 'personal_kyc', false);
  });

  it('returns unauthenticated finance routes to the Get Started screen', () => {
    render(
      <MemoryRouter initialEntries={['/transactions']}>
        <App />
      </MemoryRouter>,
    );
    expect(screen.getByRole('button', { name: /get started/i })).toBeVisible();
  });
});
