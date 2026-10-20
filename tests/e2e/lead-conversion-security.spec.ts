import { test, expect } from '@playwright/test';

test('live conversion interface remains secured when Laravel API is not configured', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('http://127.0.0.1:5173/crm/leads');
  await expect(page.getByRole('heading', { name: 'Leads', exact: true })).toBeVisible();
  await expect(page.getByRole('alert')).toContainText('VITE_CRM_API_URL');
  await expect(page.getByRole('button', { name: 'Confirm conversion' })).toHaveCount(0);
  await expect(page.getByRole('link', { name: 'Demo Leads' })).toHaveAttribute('href', '/app/leads');
  expect(errors).toEqual([]);
});
