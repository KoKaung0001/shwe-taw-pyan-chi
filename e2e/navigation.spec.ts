import { test, expect } from '@playwright/test';
for (const width of [360, 768, 1280]) {
  test(`navigation, disclosure and layout at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/');
    for (const name of ['Transactions', 'Credit readiness', 'Ask AI', 'Settings', 'Dashboard']) {
      const link = page.getByRole('navigation', { name: 'Main navigation' }).getByRole('link', {
        name,
        exact: true,
      });
      await link.click();
      await expect(page.getByRole('heading', { level: 1 })).toBeFocused();
      await expect(
        page.getByRole('navigation', { name: 'Main navigation' }).getByRole('link', {
          name,
          exact: true,
        }),
      ).toHaveAttribute('aria-current', 'page');
      await expect(
        page.getByText(
          'Demo mode: simulated data. Do not enter real financial information.',
        ),
      ).toBeVisible();
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= window.innerWidth,
        ),
      ).toBe(true);
    }

    await page.screenshot({
      path: `test-results/dashboard-${width}.png`,
      fullPage: true,
    });
    await page.goto('/#/schedules');
    await page.reload();
    await expect(
      page.getByRole('heading', { name: 'Plan the next payment' }),
    ).toBeVisible();
    await page.goto('/#/missing');
    await expect(
      page.getByRole('heading', { level: 1, name: 'Page not found' }),
    ).toBeVisible();
  });
}
test('skip link supports keyboard navigation', async ({ page }) => {
  await page.goto('/#/dashboard');
  await page.keyboard.press('Tab');
  await expect(
    page.getByRole('link', { name: 'Skip to content' }),
  ).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.locator('main')).toBeFocused();
});

test('M5 dashboard periods, outstanding screen and forecast are available', async ({
  page,
}) => {
  await page.addInitScript(() => localStorage.clear());
  await page.goto('/#/dashboard');
  await page.getByLabel('Opening amount (MMK)').fill('470000');
  await page.getByRole('button', { name: 'Save opening balance' }).click();
  await expect(page.getByLabel('Reporting period')).toHaveValue('this_month');
  await expect(
    page.getByText(
      'Based on 0 settled transaction(s); pending items are excluded.',
    ),
  ).toBeVisible();
  await page.getByLabel('Reporting period').selectOption('last_month');
  await expect(page.getByLabel('Reporting period')).toHaveValue('last_month');

  await page
    .getByRole('navigation')
    .getByRole('link', { name: 'Owed payments' })
    .click();
  await expect(
    page.getByRole('heading', { name: 'Incoming payments' }),
  ).toBeVisible();
  await expect(page.getByText('No unpaid incoming payments.')).toBeVisible();
  await expect(page.getByText('No unpaid outgoing obligations.')).toBeVisible();

  await page
    .getByRole('navigation')
    .getByRole('link', { name: 'Forecast & insights' })
    .click();
  await expect(
    page.getByRole('heading', { name: '14-day daily forecast' }),
  ).toBeVisible();
  await expect(
    page.getByText(/Estimated from your recorded available balance/),
  ).toBeVisible();
  await expect(page.getByRole('table').getByRole('row')).toHaveCount(15);
});

test('opening balance and manual transaction workflow', async ({ page }) => {
  await page.goto('/#/dashboard');
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.getByLabel('Opening amount (MMK)').fill('100000');
  await page.getByRole('button', { name: 'Save opening balance' }).click();
  await expect(page.getByText('100,000 MMK')).toBeVisible();
  await page.getByRole('link', { name: 'View transactions' }).click();
  await page.getByLabel('Type').selectOption('income');
  await page.getByLabel('Amount (MMK)').fill('2500');
  await page.getByLabel('Category').selectOption('sales');
  await page.getByLabel('Description').fill('Market sale');
  await page.getByLabel('It happened after the opening balance time').check();
  await page.getByRole('button', { name: 'Save transaction' }).click();
  await expect(page.getByText('Market sale')).toBeVisible();
  await page.getByRole('button', { name: 'Edit', exact: true }).click();
  await expect(page.getByLabel('Amount (MMK)')).toHaveValue('2500');
  await page.getByLabel('Amount (MMK)').fill('3000');
  await page.getByRole('button', { name: 'Save correction' }).click();
  await expect(page.getByText('3,000 MMK')).toBeVisible();
});

test('one-time schedule is assumed once and can be marked unpaid', async ({
  page,
}) => {
  await page.goto('/#/schedules');
  await page.getByLabel('Type').selectOption('expense');
  await page.getByLabel('Amount (MMK)').fill('45000');
  await page.getByLabel('Description').fill('Electricity bill');
  await page.getByRole('button', { name: 'Save schedule' }).click();
  await expect(page.getByText('Auto-recorded · Unconfirmed')).toBeVisible();
  await page.reload();
  await expect(page.getByText('Auto-recorded · Unconfirmed')).toBeVisible();
  await page.getByRole('link', { name: 'Confirm or correct' }).click();
  await expect(
    page.getByRole('heading', { name: 'Correct existing record' }),
  ).toBeVisible();
  await page.getByLabel('Payment confirmation').selectOption('confirmed');
  await page.getByRole('button', { name: 'Save correction' }).click();
  await page
    .getByRole('navigation')
    .getByRole('link', { name: 'Schedules' })
    .click();
  await expect(page.getByText('Confirmed paid')).toBeVisible();
  page.once('dialog', (dialog) => dialog.accept());
  await page.getByRole('button', { name: 'Mark unpaid' }).click();
  await expect(page.getByText('Marked unpaid')).toBeVisible();
  await page.reload();
  await expect(page.getByText('Marked unpaid')).toBeVisible();
});

test('monthly schedule clamps month ends and catches up each eligible occurrence', async ({
  page,
}) => {
  await page.goto('/#/schedules');
  await page.getByLabel('Repeats').selectOption('monthly');
  await page.getByLabel('Amount (MMK)').fill('125000');
  await page.getByLabel('First eligible date').fill('2026-01-31');
  await page.getByLabel('Day of month (1–31)').fill('31');
  await page.getByLabel('Last eligible date (optional)').fill('2026-03-31');
  await page.getByLabel('Description').fill('Monthly rent');
  await page.getByRole('button', { name: 'Save schedule' }).click();

  await expect(page.getByText('2026-01-31 · 125,000 MMK')).toBeVisible();
  await expect(page.getByText('2026-02-28 · 125,000 MMK')).toBeVisible();
  await expect(page.getByText('2026-03-31 · 125,000 MMK')).toBeVisible();
  await expect(page.getByText('Auto-recorded · Unconfirmed')).toHaveCount(3);
  await page.reload();
  await expect(page.getByText('Auto-recorded · Unconfirmed')).toHaveCount(3);
});

test('simulated receipt extraction is reviewed before saving its fields', async ({
  page,
}) => {
  await page.addInitScript(() => localStorage.clear());
  await page.goto('/');
  await expect(
    page.getByText('Saved demo data was invalid and has been reset.'),
  ).toHaveCount(0);
  await page.getByLabel('Opening amount (MMK)').fill('100000');
  await page.getByRole('button', { name: 'Save opening balance' }).click();
  await page
    .getByRole('navigation')
    .getByRole('link', { name: 'Upload & review' })
    .click();
  await page
    .getByLabel('Receipt or screenshot (JPEG, PNG, or WebP; up to 5 MB)')
    .setInputFiles({
      name: 'market-receipt.png',
      mimeType: 'image/png',
      buffer: Buffer.from(
        'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/RZkAAAAASUVORK5CYII=',
        'base64',
      ),
    });
  await expect(
    page.getByRole('img', {
      name: 'Local preview of the selected receipt or screenshot',
    }),
  ).toBeVisible();
  await page
    .getByRole('button', { name: 'Simulate sample extraction' })
    .click();
  await expect(
    page.getByText('Sample extraction · simulated, not OCR'),
  ).toBeVisible();
  await page.getByLabel('Amount (MMK)').fill('14800');
  await page.getByLabel('Description').fill('Market vegetables');
  await page.getByLabel('It happened after the opening balance time').check();
  const reviewConfirmation = page.getByLabel(
    'I reviewed and confirm these transaction fields.',
  );
  await reviewConfirmation.check();
  await page.getByLabel('Amount (MMK)').fill('14801');
  await expect(reviewConfirmation).not.toBeChecked();
  await page.getByRole('button', { name: 'Save reviewed transaction' }).click();
  await expect(page.getByRole('alert')).toHaveText(
    'Review the fields and confirm them before saving.',
  );
  await page.getByLabel('Amount (MMK)').fill('14800');
  await page.getByLabel('It happened after the opening balance time').check();
  await reviewConfirmation.check();
  await page.getByRole('button', { name: 'Save reviewed transaction' }).click();
  await expect(
    page.getByText('Reviewed transaction saved. The image was not stored.'),
  ).toBeVisible();
  await page
    .getByRole('navigation')
    .getByRole('link', { name: 'Transactions' })
    .click();
  await expect(page.getByText('Market vegetables')).toBeVisible();
  await expect(page.getByText('14,800 MMK')).toBeVisible();
});

test('unreadable image supports manual entry and rejects invalid files', async ({
  page,
}) => {
  await page.addInitScript(() => localStorage.clear());
  await page.goto('/');
  await expect(
    page.getByText('Saved demo data was invalid and has been reset.'),
  ).toHaveCount(0);
  await page.getByLabel('Opening amount (MMK)').fill('100000');
  await page.getByRole('button', { name: 'Save opening balance' }).click();
  await page
    .getByRole('navigation')
    .getByRole('link', { name: 'Upload & review' })
    .click();
  const upload = page.getByLabel(
    'Receipt or screenshot (JPEG, PNG, or WebP; up to 5 MB)',
  );
  await upload.setInputFiles({
    name: 'unsupported.pdf',
    mimeType: 'application/pdf',
    buffer: Buffer.from('pdf'),
  });
  await expect(page.getByRole('alert')).toHaveText(
    'Choose a JPEG, PNG, or WebP image.',
  );
  await upload.setInputFiles({
    name: 'empty.png',
    mimeType: 'image/png',
    buffer: Buffer.alloc(0),
  });
  await expect(page.getByRole('alert')).toHaveText(
    'That image file is empty. Choose another file or enter the details manually.',
  );
  await upload.setInputFiles({
    name: 'large.png',
    mimeType: 'image/png',
    buffer: Buffer.alloc(5 * 1024 * 1024 + 1),
  });
  await expect(page.getByRole('alert')).toHaveText(
    'The image must be 5 MB or smaller. Choose a smaller image or enter the details manually.',
  );
  await upload.setInputFiles({
    name: 'blurry-receipt.webp',
    mimeType: 'image/webp',
    buffer: Buffer.from(
      'UklGRiIAAABXRUJQVlA4IBYAAAAwAQCdASoBAAEAAUAmJaQAA3AA/v89WAAAAA==',
      'base64',
    ),
  });
  await page
    .getByRole('button', {
      name: 'Image unreadable or unavailable · enter manually',
    })
    .click();
  await page.getByLabel('Amount (MMK)').fill('7900');
  await page.getByLabel('Description').fill('Manually read bill');
  await page.getByLabel('It happened after the opening balance time').check();
  await page
    .getByLabel('I reviewed and confirm these transaction fields.')
    .check();
  await page.getByRole('button', { name: 'Save reviewed transaction' }).click();
  await page
    .getByRole('navigation')
    .getByRole('link', { name: 'Transactions' })
    .click();
  await expect(page.getByText('Manually read bill')).toBeVisible();
});
