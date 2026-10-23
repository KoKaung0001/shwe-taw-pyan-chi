import { expect, test } from '@playwright/test';

test('production demo works offline, stays isolated, and supports the presentation flow', async ({ page }) => {
  const supabaseRequests: string[] = [];
  await page.route(/https:\/\/[^/]+\.supabase\.co\/.*/, async (route) => {
    supabaseRequests.push(route.request().url());
    await route.abort();
  });

  for (const width of [1280, 360]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/');
    await expect(page.getByRole('button', { name: 'Explore with demo data' }).first()).toBeVisible();
    await page.getByRole('button', { name: 'Explore with demo data' }).first().click();
    await expect(page.getByRole('heading', { name: 'Welcome,' })).toBeVisible();
    await expect(page.getByText('Demo preview · sample data')).toBeVisible();

    if (width === 1280) {
      await page.getByRole('link', { name: 'Transactions', exact: true }).first().click();
      const customerRow = page.getByText('Mya Thida Boutique').locator('xpath=ancestor::li[1]');
      await customerRow.getByRole('button', { name: 'Mark paid' }).click();
      await expect(page.getByRole('list', { name: 'Transactions' }).getByText(/Mya Thida Boutique/)).toBeVisible();
      await page.getByRole('link', { name: 'AI Assistant', exact: true }).first().click();
      await page.getByRole('button', { name: 'Roast my unpaid receivables.' }).click();
      await expect(page.getByText(/across 1 unpaid receivable/i)).toBeVisible();
      await page.getByRole('link', { name: 'Credit Readiness', exact: true }).first().click();
      await expect(page.getByRole('heading', { name: 'App-only FlowScore' })).toBeVisible();
      await page.getByRole('button', { name: 'MCB Bank' }).click();
      const download = page.waitForEvent('download');
      await page.getByRole('button', { name: 'Export loan application kit' }).click();
      expect((await download).suggestedFilename()).toBe('flowcredit-mcb-readiness.pdf');
      await expect(page.getByRole('button', { name: 'Exit demo' })).toBeVisible();
    }

    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await page.reload();
    await expect(page.getByRole('button', { name: 'Explore with demo data' }).first()).toBeVisible();
  }

  expect(supabaseRequests).toEqual([]);
});
