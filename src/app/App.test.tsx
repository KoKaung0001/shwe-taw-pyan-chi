import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, it, expect } from 'vitest';
import { App } from './App';
import { useDemoStore } from '../store/demoStore';
describe('foundation', () => {
  it('keeps the demo disclosure and placeholder after navigation', () => {
    render(
      <MemoryRouter>
        <App />
      </MemoryRouter>,
    );
    fireEvent.click(screen.getAllByRole('link', { name: 'Ask AI', hidden: true })[0]);
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(
      'Ask your companion',
    );
    expect(
      screen.getByText(
        'Demo mode: simulated data. Do not enter real financial information.',
      ),
    ).toBeVisible();
    expect(screen.getByText('Not implemented yet')).toBeVisible();
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
  });
  it('recovers unknown addresses', () => {
    render(
      <MemoryRouter initialEntries={['/unknown']}>
        <App />
      </MemoryRouter>,
    );
    expect(
      screen.getByRole('heading', { level: 1, name: 'Page not found' }),
    ).toBeVisible();
    fireEvent.click(screen.getByRole('link', { name: 'Back to dashboard' }));
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(
      'Smarter money management',
    );
  });

  it('shows a recovery notice from validated persistence', () => {
    useDemoStore.setState({
      storageNotice: 'Saved demo data was invalid and has been reset.',
    });
    render(
      <MemoryRouter>
        <App />
      </MemoryRouter>,
    );
    expect(screen.getByRole('status')).toHaveTextContent(
      'Saved demo data was invalid and has been reset.',
    );
    useDemoStore.setState({ storageNotice: null });
  });
});
