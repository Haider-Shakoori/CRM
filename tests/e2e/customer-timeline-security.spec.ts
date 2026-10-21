import { test, expect } from '@playwright/test';

test('customer timeline cannot display demo notes when Laravel API is not configured', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('http://127.0.0.1:5173/crm/timeline');
  await expect(page.getByRole('heading', { name: 'Customer Timeline' })).toBeVisible();
  await expect(page.getByRole('alert')).toContainText('VITE_CRM_API_URL');
  await expect(page.getByRole('button', { name: 'Add note' })).toHaveCount(0);
  expect(errors).toEqual([]);
});
