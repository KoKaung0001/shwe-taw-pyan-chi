import { test, expect } from '@playwright/test';

const primary = ['Home', 'Transactions', 'Add', 'AI Assistant', 'Credit Readiness'];
const demoPassword = 'demo-password-123';

async function signUpAndEnter(page: import('@playwright/test').Page, email = 'person@example.com') {
  await page.goto('/');
  await page.getByRole('button', { name: 'Get Started' }).click();
  await page.getByRole('link', { name: 'Sign up' }).click();
  await page.getByLabel('Full name').fill('Demo Person');
  await page.getByLabel('Email address').fill(email);
  await page.getByLabel('Password').fill(demoPassword);
  await page.getByRole('button', { name: 'Create account' }).click();
  await expect(page.getByRole('heading', { name: 'Welcome, Demo Person' })).toBeVisible();
}

async function signIn(page: import('@playwright/test').Page, email = 'person@example.com') {
  await page.goto('/');
  await page.getByRole('button', { name: 'Get Started' }).click();
  await page.getByLabel('Email address').fill(email);
  await page.getByLabel('Password').fill(demoPassword);
  await page.getByRole('button', { name: 'Log in' }).click();
  await expect(page.getByRole('heading', { name: 'Welcome, Demo Person' })).toBeVisible();
}

async function navigateWithinApp(page: import('@playwright/test').Page, path: string) {
  await page.evaluate((target) => { window.location.hash = `#${target}`; }, path);
}

test('landing gathers the scattered records into authentication on desktop and mobile', async ({ page }) => {
  for (const width of [360, 1280]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/');
    await expect(page.getByRole('heading', { name: 'Bring your money together.' })).toBeVisible();
    await expect(page.locator('.welcome-object')).toHaveCount(7);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await page.getByRole('button', { name: 'Get Started' }).click();
    await expect(page).toHaveURL(/#\/auth$/);
    await expect(page.getByLabel('Email address')).toBeVisible({ timeout: 3000 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await page.getByLabel('Email address').fill('person@example.com');
    await page.getByLabel('Password').fill('wrong-password');
    await page.getByRole('button', { name: 'Log in' }).click();
    await expect(page.getByRole('status')).toContainText('Email or password is incorrect');
    await page.getByRole('link', { name: 'Sign up' }).click();
    await expect(page.getByLabel('Full name')).toBeVisible();
  }
});

test('signup, login, route protection, and sign-out work with browser-local accounts', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Get Started' }).click();
  await page.getByRole('link', { name: 'Sign up' }).click();
  await page.getByLabel('Full name').fill('Demo Person');
  await page.getByLabel('Email address').fill('person@example.com');
  await page.getByLabel('Password').fill(demoPassword);
  await page.getByRole('button', { name: 'Create account' }).click();
  await expect(page).toHaveURL(/#\/dashboard$/);
  await expect(page.getByRole('heading', { name: 'Welcome, Demo Person' })).toBeVisible();

  await page.reload();
  await expect(page.getByRole('button', { name: 'Get Started' })).toBeVisible();
  await page.getByRole('button', { name: 'Get Started' }).click();
  await page.getByLabel('Email address').fill('person@example.com');
  await page.getByLabel('Password').fill(demoPassword);
  await page.getByRole('button', { name: 'Log in' }).click();
  await expect(page.getByRole('heading', { name: 'Welcome, Demo Person' })).toBeVisible();

  await page.getByRole('button', { name: 'Sign out' }).click();
  await expect(page.getByRole('button', { name: 'Get Started' })).toBeVisible();
  await page.getByRole('button', { name: 'Get Started' }).click();
  await page.getByRole('link', { name: 'Sign up' }).click();
  await page.getByLabel('Full name').fill('Duplicate Person');
  await page.getByLabel('Email address').fill('PERSON@example.com');
  await page.getByLabel('Password').fill(demoPassword);
  await page.getByRole('button', { name: 'Create account' }).click();
  await expect(page.getByRole('status')).toContainText('An account already exists');

  await page.getByRole('link', { name: 'Log in' }).click();
  await page.getByLabel('Email address').fill('person@example.com');
  await page.getByLabel('Password').fill('wrong-password');
  await page.getByRole('button', { name: 'Log in' }).click();
  await expect(page.getByRole('status')).toContainText('Email or password is incorrect');
  await page.getByLabel('Password').fill(demoPassword);
  await page.getByRole('button', { name: 'Log in' }).click();
  await expect(page.getByRole('heading', { name: 'Welcome, Demo Person' })).toBeVisible();

  await page.reload();
  await expect(page.getByRole('button', { name: 'Get Started' })).toBeVisible();
  await page.goto('/#/transactions');
  await expect(page.getByRole('button', { name: 'Get Started' })).toBeVisible();
});

for (const width of [360, 768, 1280]) {
  test(`five destinations and responsive layout at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await signUpAndEnter(page, `person-${width}@example.com`);
    for (const name of primary) {
      const nav = width < 1024
        ? page.locator('.mobile-bottom-nav')
        : page.getByRole('navigation', { name: 'Main navigation' }).first();
      const link = nav.getByRole('link', { name, exact: true });
      const alreadyActive = (await link.getAttribute('aria-current')) === 'page';
      await link.click();
      await expect(link).toHaveAttribute('aria-current', 'page');
      if (!alreadyActive) await expect(page.getByRole('heading', { level: 1 })).toBeFocused();
      await expect(page.locator('.demo-badge')).toBeVisible();
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    }
    await navigateWithinApp(page, '/payments/upcoming');
    await expect(page.getByRole('heading', { name: 'Payments' })).toBeVisible();
    await navigateWithinApp(page, '/missing');
    await expect(page.getByRole('heading', { name: 'Page not found' })).toBeVisible();
  });
}

test('skip link supports keyboard navigation', async ({ page }) => {
  await signUpAndEnter(page, 'keyboard@example.com');
  await page.evaluate(() => {
    document.body.tabIndex = -1;
    document.body.focus();
  });
  await page.keyboard.press('Tab');
  await expect(page.getByRole('link', { name: 'Skip to content' })).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.locator('main')).toBeFocused();
});

test('development CSP keeps the local HMR exceptions bounded', async ({ page }) => {
  await page.goto('/');
  const policy = await page.locator('meta[http-equiv="Content-Security-Policy"]').getAttribute('content');
  expect(policy).toContain("connect-src 'self' ws://127.0.0.1:*");
  expect(policy).toContain("style-src 'self' 'unsafe-inline'");
  expect(policy).not.toMatch(/script-src[^;]*'unsafe-(?:inline|eval)'/);
});

test('dashboard compares cash flow and cumulative net change without an opening balance', async ({ page }) => {
  await signUpAndEnter(page, 'chart@example.com');
  await expect(page.getByLabel('Reporting period')).toHaveValue('this_week');
  await expect(page.locator('.dashboard-metrics article')).toHaveCount(4);
  await expect(page.locator('.dashboard-chart h2')).toHaveText('Income and expenses');
  await expect(page.getByRole('button', { name: 'Cash flow', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByRole('button', { name: 'Balance', exact: true })).toHaveCount(0);
  await expect(page.locator('.financial-chart-svg')).toHaveAttribute('aria-label', /Daily income and expense bars/);
  await expect(page.locator('.financial-chart-date-point')).toHaveCount(7);
  await expect(page.locator('.financial-chart-income-bar')).toHaveCount(7);
  await expect(page.locator('.financial-chart-expense-bar')).toHaveCount(7);
  await page.getByRole('button', { name: 'Net change', exact: true }).click();
  await expect(page.locator('.financial-chart-net-change-line')).toHaveAttribute('d', /M/);
  await expect(page.locator('.financial-chart-tooltip')).toHaveCount(0);
  await page.getByLabel('Reporting period').selectOption('last_30_days');
  await expect(page.locator('.financial-chart-date-point')).toHaveCount(30);
  await expect(page.getByRole('heading', { name: 'Recent activity' })).toBeVisible();
  await navigateWithinApp(page, '/settings');
  await expect(page.getByLabel('Time zone')).toBeVisible();
  await expect(page.getByText(/opening balance|reconcile current balance|current calculated balance/i)).toHaveCount(0);
  await navigateWithinApp(page, '/insights');
  await expect(page.getByRole('heading', { name: 'Page not found' })).toBeVisible();
  await page.setViewportSize({ width: 360, height: 800 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});
test('manual transaction create, edit, filter and persistence work', async ({ page }) => {
  await signUpAndEnter(page, 'manual@example.com');
  await navigateWithinApp(page, '/add');
  await page.getByRole('link', { name: 'Manual entry' }).click();
  const form = page.locator('#transaction-form');
  const transactionDate = form.locator('#transaction-date');
  const initialDate = await transactionDate.inputValue();
  await page.getByRole('button', { name: 'Open calendar for Transaction date' }).click();
  const calendar = page.getByRole('dialog', { name: 'Calendar for Transaction date' });
  await expect(calendar).toBeVisible();
  await calendar.locator('.date-picker-day[aria-pressed="true"]').click();
  await expect(calendar).toHaveCount(0);
  await expect(transactionDate).toHaveValue(initialDate);
  await form.getByLabel('Type').selectOption('income');
  await form.getByLabel('Amount (MMK)').fill('2500');
  await form.getByLabel('Category').selectOption('sales');
  await form.getByLabel('Description').fill('Market sale');
  await form.getByRole('button', { name: 'Save transaction' }).click();
  await expect(page.getByText('Market sale')).toBeVisible();
  await page.reload();
  await signIn(page, 'manual@example.com');
  await navigateWithinApp(page, '/transactions');
  await expect(page.getByText('Market sale')).toBeVisible();
  await page.locator('.activity-list-panel li').filter({ hasText: 'Market sale' }).getByRole('button', { name: 'Edit', exact: true }).click();
  await expect(form.getByLabel('Amount (MMK)')).toHaveValue('2500');
  await form.getByLabel('Amount (MMK)').fill('3000');
  await form.getByRole('button', { name: 'Save correction' }).click();
  await expect(page.getByText('3,000 MMK')).toBeVisible();
  await page.getByRole('combobox', { name: 'Category', exact: true }).last().selectOption('sales');
});

test('receivables are explicit and settle into one linked income record', async ({ page }) => {
  await signUpAndEnter(page, 'receivable@example.com');
  await navigateWithinApp(page, '/add');
  await page.getByRole('link', { name: 'Record a receivable' }).click();
  await page.getByLabel('Amount (MMK)').fill('42000');
  await page.getByLabel('Client or payer').fill('New client');
  await page.getByLabel('Category').selectOption('sales');
  await page.getByLabel('Description').fill('Invoice 42');
  await page.getByRole('button', { name: 'Save receivable' }).click();
  await expect(page.getByRole('status')).toHaveText('Receivable saved as unpaid.');
  await page.getByRole('navigation', { name: 'Main navigation' }).first().getByRole('link', { name: 'Transactions' }).click();
  const receivable = page.locator('#receivables li').filter({ hasText: 'New client' });
  await expect(receivable).toContainText('Unpaid');
  await receivable.getByRole('button', { name: 'Mark paid' }).click();
  await expect(receivable).toContainText('Paid');
  const afterFirstSettlement = await page.evaluate(() => {
    const store = JSON.parse(localStorage.getItem('fintech-companion-demo-v1:account:receivable%40example.com') ?? '{}');
    return store.state.data.transactions.filter((item: { description?: string }) => item.description === 'Invoice 42').length;
  });
  expect(afterFirstSettlement).toBe(1);
  await page.reload();
  await signIn(page, 'receivable@example.com');
  await navigateWithinApp(page, '/transactions');
  await expect(page.locator('#receivables li').filter({ hasText: 'New client' })).toContainText('Paid');
});

test('receipt upload remains a draft until reviewed and explicitly saved', async ({ page }) => {
  await signUpAndEnter(page, 'receipt@example.com');
  await navigateWithinApp(page, '/add');
  await page.getByRole('link', { name: 'Upload receipt or screenshot' }).click();
  await page.getByLabel('Receipt or screenshot (JPEG, PNG, or WebP; up to 5 MB)').setInputFiles({
    name: 'market-receipt.png', mimeType: 'image/png',
    buffer: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/RZkAAAAASUVORK5CYII=', 'base64'),
  });
  await page.getByRole('button', { name: 'Simulate sample extraction' }).click();
  await expect(page.getByText('Sample extraction · simulated, not OCR')).toBeVisible();
  const amount = page.getByLabel('Amount (MMK)');
  await expect(amount).toHaveValue('12500');
  expect(await page.evaluate(() => {
    const state = JSON.parse(localStorage.getItem('fintech-companion-demo-v1:account:receipt%40example.com') ?? 'null')?.state;
    return Boolean(state?.data.transactions.some((item: { description?: string }) => item.description === 'Sample receipt purchase'));
  })).toBe(false);
  await page.getByLabel('Category').selectOption('supplies');
  await page.getByLabel('I reviewed and confirm these transaction fields.').check();
  await page.getByRole('button', { name: 'Save reviewed transaction' }).click();
  await expect(page.getByText('Reviewed transaction saved. The image was not stored.')).toBeVisible();
  await navigateWithinApp(page, '/transactions');
  await expect(page.getByText(/Receipt review/)).toBeVisible();
});

test('assistant suggested questions return current weekly totals and receivables', async ({ page }) => {
  await page.addInitScript(() => localStorage.clear());
  await signUpAndEnter(page, 'assistant@example.com');
  await navigateWithinApp(page, '/chat');
  await expect(page.getByText('Demo assistant')).toBeVisible();
  await page.getByRole('button', { name: 'What is my income this week?' }).click();
  await expect(page.getByText(/This week .* recorded income is 180,000 MMK/)).toBeVisible();
  await page.getByRole('button', { name: 'How much did I spend this week?' }).click();
  await expect(page.getByText(/This week .* recorded expenses are 67,000 MMK/)).toBeVisible();
  await page.getByRole('button', { name: 'What is my highest expense category this week?' }).click();
  await expect(page.getByText(/highest expense category is/)).toBeVisible();
  await page.getByRole('button', { name: 'How much do I have in outstanding receivables?' }).click();
  await expect(page.getByText(/unpaid receivable/)).toBeVisible();
  await page.getByLabel('Ask about your records').fill('Will I get a loan?');
  await page.getByRole('button', { name: 'Ask', exact: true }).click();
  await expect(page.getByText(/I can't provide projections/)).toBeVisible();
});

test('credit readiness shows six binary items and persists availability choices', async ({ page }) => {
  await signUpAndEnter(page, 'readiness@example.com');
  await navigateWithinApp(page, '/readiness');
  await expect(page.getByText(/not a credit score, creditworthiness assessment/i)).toBeVisible();
  await expect(page.locator('.page-content section').first().getByRole('listitem')).toHaveCount(6);
  const identity = page.getByRole('checkbox', { name: 'Identity-document availability' });
  await identity.check();
  await page.reload();
  await signIn(page, 'readiness@example.com');
  await navigateWithinApp(page, '/readiness');
  await expect(page.getByRole('checkbox', { name: 'Identity-document availability' })).toBeChecked();
});

test('Settings reset requires confirmation and restores synthetic records', async ({ page }) => {
  await page.addInitScript(() => localStorage.clear());
  await signUpAndEnter(page, 'settings@example.com');
  await navigateWithinApp(page, '/settings');
  await page.getByRole('button', { name: 'Reset demo data' }).click();
  const dialog = page.getByRole('dialog', { name: 'Reset demo data?' });
  await expect(dialog).toBeVisible();
  await dialog.getByRole('button', { name: 'Cancel' }).click();
  await expect(dialog).toHaveCount(0);
  await page.getByRole('button', { name: 'Reset demo data' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Reset demo data' }).click();
  await expect(page.getByRole('status')).toContainText('Demo data has been restored.');
  await navigateWithinApp(page, '/transactions');
  await expect(page.getByText('Monthly salary')).toBeVisible();
});

test('malformed saved data recovers visibly and descriptions render as text', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('fintech-companion-demo-v1:account:recovery%40example.com', '{malformed'));
  await signUpAndEnter(page, 'recovery@example.com');
  await expect(page.getByText('Saved demo data could not be read and has been reset.')).toBeVisible();
  await page.getByRole('navigation', { name: 'Main navigation' }).first().getByRole('link', { name: 'Transactions' }).click();
  await page.getByRole('button', { name: 'Add transaction' }).click();
  const form = page.locator('#transaction-form');
  const unsafeText = '<img src=x onerror=window.__xss=1>';
  await form.getByLabel('Type').selectOption('income');
  await form.getByLabel('Amount (MMK)').fill('2500');
  await form.getByLabel('Category').selectOption('sales');
  await form.getByLabel('Description').fill(unsafeText);
  await form.getByRole('button', { name: 'Save transaction' }).click();
  await expect(page.getByText(unsafeText, { exact: true })).toBeVisible();
  await expect(page.locator('img[src="x"]')).toHaveCount(0);
  expect(await page.evaluate(() => (window as Window & { __xss?: number }).__xss)).toBeUndefined();
});
