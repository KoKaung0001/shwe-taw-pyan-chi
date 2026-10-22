import { test, expect } from '@playwright/test';
import { existsSync, readFileSync } from 'node:fs';

const primary = ['Home', 'Transactions', 'Add', 'AI Assistant', 'Credit Readiness'];
const demoPassword = 'demo-password-123';
const localEnv = existsSync('.env.local') ? readFileSync('.env.local', 'utf8') : '';
const hasLocalEnvValue = (key: string) => {
  const line = localEnv.split(/\r?\n/).find((entry) => entry.trim().startsWith(`${key}=`));
  return Boolean(line?.slice(line.indexOf('=') + 1).trim().replace(/^['"]|['"]$/g, ''));
};
const supabaseConfigured = Boolean(
  (process.env.VITE_SUPABASE_URL || hasLocalEnvValue('VITE_SUPABASE_URL')) &&
  (process.env.VITE_SUPABASE_ANON_KEY || hasLocalEnvValue('VITE_SUPABASE_ANON_KEY')),
);
const emailsByPage = new WeakMap<import('@playwright/test').Page, Map<string, string>>();

function testEmail(page: import('@playwright/test').Page, requested: string) {
  let addresses = emailsByPage.get(page);
  if (!addresses) { addresses = new Map(); emailsByPage.set(page, addresses); }
  let address = addresses.get(requested);
  if (!address) {
    const [local, domain] = requested.split('@');
    address = `${local}+e2e-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@${domain}`;
    addresses.set(requested, address);
  }
  return address;
}

test.beforeEach(async ({ page }, testInfo) => {
  void page;
  if (!supabaseConfigured && !/landing gathers|development CSP|unauthenticated routes/i.test(testInfo.title)) {
    testInfo.skip(true, 'Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to run authenticated browser flows.');
  }
});

async function signUpAndEnter(page: import('@playwright/test').Page, email = 'person@example.com') {
  email = testEmail(page, email);
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
  email = testEmail(page, email);
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
    await expect(page.locator('.welcome-hook')).toHaveText('Your finances, in one place');
    await expect(page.locator('.welcome-object')).toHaveCount(7);
    expect(await page.locator('.welcome-experience').evaluate((element) => getComputedStyle(element).backgroundColor)).toBe('rgb(38, 43, 51)');
    expect(await page.locator('.welcome-artboard').evaluate((element) => getComputedStyle(element).backgroundImage)).toContain('radial-gradient');
    expect(await page.locator('.welcome-object').first().evaluate((element) => getComputedStyle(element).backgroundColor)).toBe('rgb(248, 249, 250)');
    if (width === 360) {
      await page.emulateMedia({ reducedMotion: 'reduce' });
      expect(await page.locator('.welcome-object').first().evaluate((element) => getComputedStyle(element).animationName)).toBe('none');
      await page.emulateMedia({ reducedMotion: 'no-preference' });
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await page.getByRole('button', { name: 'Get Started' }).click();
    await expect(page).toHaveURL(/#\/auth$/);
    await expect(page.getByLabel('Email address')).toBeVisible({ timeout: 3000 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await page.getByLabel('Email address').fill('person@example.com');
    await page.getByLabel('Password').fill('wrong-password');
    await page.getByRole('button', { name: 'Log in' }).click();
    await expect(page.getByRole('status')).toContainText(supabaseConfigured ? 'Email or password is incorrect' : 'not configured');
    await page.getByRole('link', { name: 'Sign up' }).click();
    await expect(page.getByLabel('Full name')).toBeVisible();
  }
});

test('signup, login, route protection, and sign-out work with Supabase Auth', async ({ page }) => {
  const email = testEmail(page, 'person@example.com');
  await page.goto('/');
  await page.getByRole('button', { name: 'Get Started' }).click();
  await page.getByRole('link', { name: 'Sign up' }).click();
  await page.getByLabel('Full name').fill('Demo Person');
  await page.getByLabel('Email address').fill(email);
  await page.getByLabel('Password').fill(demoPassword);
  await page.getByRole('button', { name: 'Create account' }).click();
  await expect(page).toHaveURL(/#\/dashboard$/);
  await expect(page.getByRole('heading', { name: 'Welcome, Demo Person' })).toBeVisible();

  await page.reload();
  await expect(page.getByRole('heading', { name: 'Welcome, Demo Person' })).toBeVisible();
  await page.getByRole('button', { name: 'Sign out' }).click();
  await expect(page.getByRole('button', { name: 'Get Started' })).toBeVisible();
  await page.getByRole('button', { name: 'Get Started' }).click();
  await page.getByLabel('Email address').fill(email);
  await page.getByLabel('Password').fill(demoPassword);
  await page.getByRole('button', { name: 'Log in' }).click();
  await expect(page.getByRole('heading', { name: 'Welcome, Demo Person' })).toBeVisible();

  await page.getByRole('button', { name: 'Sign out' }).click();
  await expect(page.getByRole('button', { name: 'Get Started' })).toBeVisible();
  await page.getByRole('button', { name: 'Get Started' }).click();
  await page.getByRole('link', { name: 'Sign up' }).click();
  await page.getByLabel('Full name').fill('Duplicate Person');
  await page.getByLabel('Email address').fill(email.toUpperCase());
  await page.getByLabel('Password').fill(demoPassword);
  await page.getByRole('button', { name: 'Create account' }).click();
  await expect(page.getByRole('status')).toContainText('An account already exists');

  await page.getByRole('link', { name: 'Log in' }).click();
  await page.getByLabel('Email address').fill(email);
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
      await expect(page.getByRole('button', { name: 'Sign out' })).toBeVisible();
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
  expect(policy).toContain("connect-src 'self' https://*.supabase.co ws://127.0.0.1:*");
  expect(policy).toContain("style-src 'self' 'unsafe-inline'");
  expect(policy).not.toMatch(/script-src[^;]*'unsafe-(?:inline|eval)'/);
});

test('unauthenticated routes return to the Get Started screen', async ({ page }) => {
  await page.goto('/#/transactions');
  await expect(page.getByRole('button', { name: 'Get Started' })).toBeVisible();
});

test('dashboard compares cash flow and cumulative net change without an opening balance', async ({ page }) => {
  await signUpAndEnter(page, 'chart@example.com');
  await expect(page.getByLabel('Reporting period')).toHaveValue('this_week');
  await expect(page.locator('.dashboard-metrics article')).toHaveCount(4);
  await expect(page.locator('.dashboard-chart h2')).toHaveText('Income and expenses');
  await expect(page.locator('.dashboard-chart-hook')).toHaveText('See the pace of your cash flow');
  await expect(page.locator('.dashboard-chart-explanation')).toContainText('Daily settled income and expenses');
  expect(await page.locator('.dashboard-chart').evaluate((element) => getComputedStyle(element).backgroundColor)).toBe('rgb(38, 43, 51)');
  expect(await page.locator('.dashboard-chart').evaluate((element) => getComputedStyle(element, '::before').backgroundColor)).toBe('rgb(30, 34, 41)');
  expect(await page.locator('.dashboard-chart .financial-chart-view-switch').evaluate((element) => getComputedStyle(element).backgroundColor)).toBe('rgb(248, 249, 250)');
  expect(await page.locator('.dashboard-chart .financial-chart-view.is-active').evaluate((element) => getComputedStyle(element).backgroundColor)).toBe('rgb(248, 249, 250)');
  expect(await page.locator('.navigation-link-active').first().evaluate((element) => getComputedStyle(element).borderLeftColor)).toBe('rgb(255, 85, 0)');
  await expect(page.getByRole('button', { name: 'Cash flow', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByRole('button', { name: 'Balance', exact: true })).toHaveCount(0);
  await expect(page.locator('.financial-chart-svg')).toHaveAttribute('aria-label', /Daily income and expense bars/);
  await expect(page.locator('.financial-chart-date-point')).toHaveCount(7);
  await expect(page.locator('.financial-chart-income-bar')).toHaveCount(7);
  await expect(page.locator('.financial-chart-expense-bar')).toHaveCount(7);
  await page.getByRole('button', { name: 'Net change', exact: true }).click();
  await expect(page.locator('.financial-chart-net-change-line')).toHaveAttribute('d', /M/);
  await expect(page.locator('.financial-chart-tooltip')).toHaveCount(0);
  await page.locator('.financial-chart-date-point').first().focus();
  await expect(page.locator('.financial-chart-net-change-point').first()).toHaveClass(/is-selected/);
  await page.getByLabel('Reporting period').selectOption('last_30_days');
  await expect(page.locator('.financial-chart-date-point')).toHaveCount(30);
  await expect(page.getByRole('heading', { name: 'Recent activity' })).toBeVisible();
  await page.setViewportSize({ width: 360, height: 800 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  const dateLabelBounds = await page.locator('.financial-chart-x-label').evaluateAll((labels) => labels.map((label) => {
    const { left, right } = label.getBoundingClientRect();
    return { left, right };
  }));
  expect(dateLabelBounds.every((bounds, index) => index === 0 || dateLabelBounds[index - 1].right <= bounds.left + 1)).toBe(true);
  await navigateWithinApp(page, '/settings');
  await expect(page.getByLabel('Time zone')).toBeVisible();
  expect(await page.locator('.settings-panel').first().evaluate((element) => getComputedStyle(element).backgroundColor)).toBe('rgb(248, 249, 250)');
  await expect(page.getByText(/opening balance|reconcile current balance|current calculated balance/i)).toHaveCount(0);
  await navigateWithinApp(page, '/insights');
  await expect(page.getByRole('heading', { name: 'Page not found' })).toBeVisible();
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
    return document.body.innerText.split('Invoice 42').length - 1;
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
  await expect(page.getByText('Sample receipt purchase')).toHaveCount(0);
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
  await expect(page.getByText('Record assistant')).toBeVisible();
  await page.getByRole('button', { name: 'What is my income this week?' }).click();
  await expect(page.getByText(/This week .* recorded income is 0 MMK/)).toBeVisible();
  await page.getByRole('button', { name: 'How much did I spend this week?' }).click();
  await expect(page.getByText(/This week .* recorded expenses are 0 MMK/)).toBeVisible();
  await page.getByRole('button', { name: 'What is my highest expense category this week?' }).click();
  await expect(page.getByText(/highest expense category is/)).toBeVisible();
  await page.getByRole('button', { name: 'How much do I have in outstanding receivables?' }).click();
  await expect(page.getByText(/unpaid receivable/)).toBeVisible();
  await page.getByLabel('Ask about your records').fill('Will I get a loan?');
  await page.getByRole('button', { name: 'Ask', exact: true }).click();
  await expect(page.getByText(/I can't provide projections/)).toBeVisible();
});

test('credit readiness matches bank requirements, persists self-reported items, and downloads a PDF', async ({ page }) => {
  await signUpAndEnter(page, 'readiness@example.com');
  await navigateWithinApp(page, '/readiness');
  await expect(page.getByText(/not a bank score, creditworthiness assessment, or loan approval prediction/i)).toBeVisible();
  await expect(page.getByRole('heading', { name: 'App-only FlowScore' })).toBeVisible();
  await page.getByRole('button', { name: /Yoma Bank/ }).click();
  await expect(page.getByRole('heading', { name: 'Yoma Bank requirements' })).toBeVisible();
  await expect(page.locator('section').nth(1).getByRole('listitem')).toHaveCount(6);
  await page.setViewportSize({ width: 360, height: 800 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  const identity = page.getByRole('checkbox', { name: 'I have this document: Borrower identity' });
  await identity.check();
  await page.reload();
  await signIn(page, 'readiness@example.com');
  await navigateWithinApp(page, '/readiness');
  await page.getByRole('button', { name: /Yoma Bank/ }).click();
  await expect(page.getByRole('checkbox', { name: 'I have this document: Borrower identity' })).toBeChecked();
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export loan application kit' }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe('flowcredit-yoma-readiness.pdf');
});

test('new accounts start without seeded records or a demo reset control', async ({ page }) => {
  await signUpAndEnter(page, `settings-${Date.now()}@example.com`);
  await navigateWithinApp(page, '/settings');
  await expect(page.getByLabel('Time zone')).toBeVisible();
  await expect(page.getByRole('button', { name: /reset demo data/i })).toHaveCount(0);
  await navigateWithinApp(page, '/transactions');
  await expect(page.getByText(/No transactions yet|Nothing here yet|No records/i)).toBeVisible();
});

test('confirmed browser workspace import includes the matching account records', async ({ page }) => {
  const importEmail = testEmail(page, `import@example.com`);
  await page.addInitScript((email) => {
    const data = {
      openingBalance: null,
      balanceAdjustments: [],
      transactions: [{ id: 'legacy-import-record', type: 'income', amount: 18000, currency: 'MMK', date: '2026-10-20', categoryId: 'sales', counterpartyId: null, cashStatus: 'settled', confirmationStatus: 'not_applicable', source: 'manual', ocrReviewStatus: 'not_applicable', createdAt: '2026-10-20T08:00:00+06:30', updatedAt: '2026-10-20T08:00:00+06:30', description: 'Legacy import record' }],
      receivables: [], counterparties: [], categories: [{ id: 'sales', name: 'Sales', type: 'income' }], scheduleRules: [], paymentOccurrences: [], duplicateReviews: [], checklist: {},
    };
    const emailKey = encodeURIComponent(email.trim().toLowerCase());
    localStorage.setItem(`fintech-companion-demo-v1:account:${emailKey}`, JSON.stringify({ version: 1, state: { data, storageNotice: null, timeZone: 'Asia/Rangoon' } }));
  }, importEmail);
  await signUpAndEnter(page, importEmail);
  const dialog = page.getByRole('dialog', { name: /Import this browser's saved records/i });
  await expect(dialog).toBeVisible();
  await expect(dialog).toContainText('1');
  await dialog.getByRole('button', { name: 'Import records' }).click();
  await expect(dialog).toHaveCount(0);
  await navigateWithinApp(page, '/transactions');
  await expect(page.getByText('Legacy import record')).toBeVisible();
});

test('transaction descriptions render as text after a save', async ({ page }) => {
  await signUpAndEnter(page, `safe-text-${Date.now()}@example.com`);
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
