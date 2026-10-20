import { test, expect } from '@playwright/test';

test('Laravel calendar without a configured API never shows synthetic appointments', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('http://127.0.0.1:5173/crm/calendar');
  await expect(page.getByRole('heading', { name: 'CRM Calendar' })).toBeVisible();
  await expect(page.getByRole('alert')).toContainText('VITE_CRM_API_URL');
  await expect(page.getByText('Loading real CRM activities…')).toHaveCount(0);
  expect(errors).toEqual([]);
});

test('default CRM still labels the synthetic experience as a demo', async ({ page }) => {
  await page.goto('http://127.0.0.1:5173/app/home');
  await expect(page).toHaveURL(/\/app\/home$/);
  await expect(page.getByRole('link', { name: 'Live CRM Dashboard (Laravel)' })).toBeVisible();
});
