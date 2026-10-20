import { test, expect } from '@playwright/test';

test('live dashboard is separate from the synthetic CRM homepage', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('http://127.0.0.1:5173/app/home');
  const link = page.getByRole('link', { name: 'Live CRM Dashboard (Laravel)' });
  await expect(link).toBeVisible();
  await link.click();
  await expect(page).toHaveURL(/crm\/dashboard$/);
  await expect(page.getByRole('heading', { name: 'CRM Dashboard & Reports' })).toBeVisible();
  await expect(page.getByRole('alert')).toContainText('VITE_CRM_API_URL');
  expect(errors).toEqual([]);
});
