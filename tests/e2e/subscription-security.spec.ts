import { test, expect } from '@playwright/test';

test('subscription usage page has no checkout or mutation without authenticated Laravel API', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('http://127.0.0.1:5173/crm/subscription');
  await expect(page.getByRole('heading', { name: 'Subscription & Usage' })).toBeVisible();
  await expect(page.getByRole('alert')).toContainText('VITE_CRM_API_URL');
  await expect(page.getByRole('button', { name: /pay|upgrade|subscribe|checkout/i })).toHaveCount(0);
  await expect(page.getByRole('link', { name: 'Live Dashboard' })).toHaveAttribute('href', '/crm/dashboard');
  expect(errors).toEqual([]);
});
