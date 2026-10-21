import { test, expect } from '@playwright/test';
for (const width of [360, 768, 1280]) {
  test(`navigation, disclosure and layout at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/');
    for (const name of ['Transactions', 'Credit readiness', 'Ask AI', 'Settings', 'Dashboard']) {
      if (name === 'Dashboard') {
        await page.goto('/');
        await expect(
          page.getByRole('heading', {
            level: 1,
            name: /Smarter money management/i,
          }),
        ).toBeVisible();
        continue;
      }
      let enteredApp = false;
      if (width < 1024 && page.url().endsWith('/')) {
        await page.getByRole('link', { name: 'Get Started Free', exact: true }).first().click();
        enteredApp = true;
      }
      const link = page.getByRole('navigation', { name: 'Main navigation' }).getByRole('link', {
        name,
        exact: true,
      });
      if (!(enteredApp && name === 'Transactions')) {
        await link.click();
        await expect(page.getByRole('heading', { level: 1 })).toBeFocused();
      } else {
        await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
      }
      await expect(
        page.getByRole('navigation', { name: 'Main navigation' }).getByRole('link', {
          name,
          exact: true,
        }),
      ).toHaveAttribute('aria-current', 'page');
      if (name !== 'Dashboard') {
        await expect(
          page.getByText(
            'Demo mode: simulated data. Do not enter real financial information.',
          ),
        ).toBeVisible();
      }
      await expect(page.getByText('Not implemented yet')).toBeVisible();
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= window.innerWidth,
        ),
      ).toBe(true);
    }

    if (width < 1024 && page.url().endsWith('/')) {
      await page.getByRole('link', { name: 'Get Started Free', exact: true }).first().click();
    }
    await page.getByRole('navigation', { name: 'Main navigation' }).getByRole('link', {
      name: 'Settings',
      exact: true,
    }).click();
    for (const name of [
      'Upload & review',
      'Owed payments',
      'Schedules',
      'Forecast & insights',
    ]) {
      await page.locator('.profile-navigation').getByRole('link', { name, exact: true }).click();
      await expect(page.getByRole('heading', { level: 1 })).toBeFocused();
      await expect(
        page.getByRole('link', { name: 'Back to profile', exact: true }),
      ).toBeVisible();
      await page.getByRole('link', { name: 'Back to profile', exact: true }).click();
      await expect(
        page.getByRole('heading', { name: 'Make a clear starting point' }),
      ).toBeVisible();
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
  await page.goto('/');
  await page.keyboard.press('Tab');
  await expect(
    page.getByRole('link', { name: 'Skip to content' }),
  ).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.locator('main')).toBeFocused();
});
