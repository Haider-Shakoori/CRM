import { test, expect } from '@playwright/test';

test('bulk CRM transfer never exposes real data without a Laravel API session', async ({ page }) => {
  const failures: string[] = [];
  page.on('pageerror', (error) => failures.push(error.message));
  await page.goto('http://127.0.0.1:5173/crm/data-transfer');
  await expect(page.getByRole('heading', { name: 'CRM CSV Import & Export' })).toBeVisible();
  await expect(page.getByRole('alert')).toContainText('VITE_CRM_API_URL');
  await expect(page.getByRole('button', { name: 'Import validated rows' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: /Download.*CSV/i })).toHaveCount(0);
  expect(failures).toEqual([]);
});
