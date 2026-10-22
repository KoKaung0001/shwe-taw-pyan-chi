import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, it, expect } from 'vitest';
import { App } from './App';
import { useDemoStore } from '../store/demoStore';
import { setDemoSession } from '../services/demoAuthSession';
afterEach(() => setDemoSession(null));
describe('foundation', () => {
  it('keeps the synthetic-data indicator and grounded assistant after navigation', () => {
    setDemoSession({ name: 'Demo User', email: 'demo@example.com' });
    render(
      <MemoryRouter initialEntries={['/dashboard']}>
        <App />
      </MemoryRouter>,
    );
    fireEvent.click(screen.getAllByRole('link', { name: 'AI Assistant' })[0]);
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(
      'Ask about your records',
    );
    expect(screen.getByText('Synthetic data', { exact: true })).toBeVisible();
    expect(screen.getByLabelText('Ask about your records')).toBeVisible();
    expect(screen.queryByText('Not implemented yet')).not.toBeInTheDocument();
  });
  it('recovers unknown addresses', () => {
    setDemoSession({ name: 'Demo User', email: 'demo@example.com' });
    render(
      <MemoryRouter initialEntries={['/unknown']}>
        <App />
      </MemoryRouter>,
    );
    expect(
      screen.getByRole('heading', { name: 'Page not found' }),
    ).toBeVisible();
    fireEvent.click(screen.getByRole('link', { name: 'Back to dashboard' }));
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(
      'Welcome, Demo User',
    );
  });

  it('shows a recovery notice from validated persistence', () => {
    setDemoSession({ name: 'Demo User', email: 'demo@example.com' });
    useDemoStore.setState({
      storageNotice: 'Saved demo data was invalid and has been reset.',
    });
    render(
      <MemoryRouter initialEntries={['/dashboard']}>
        <App />
      </MemoryRouter>,
    );
    expect(screen.getByRole('status')).toHaveTextContent(
      'Saved demo data was invalid and has been reset.',
    );
    useDemoStore.setState({ storageNotice: null });
  });

  it('shows record checks and a persistent document checklist on readiness', () => {
    setDemoSession({ name: 'Demo User', email: 'demo@example.com' });
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
      screen.getByRole('heading', { name: 'Prepare your records' }),
    ).toBeVisible();
    expect(screen.getByText(/not a credit score/i)).toBeVisible();
    const identityAvailability = screen.getByRole('checkbox', {
      name: 'Identity-document availability',
    });
    fireEvent.click(identityAvailability);
    expect(useDemoStore.getState().data.checklist.identity_document).toBe(true);
    useDemoStore.getState().setReadinessDocument('identity_document', false);
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
