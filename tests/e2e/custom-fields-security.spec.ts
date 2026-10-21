import { test, expect } from '@playwright/test';

test('custom fields cannot show tenant values without Laravel API configuration', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('http://127.0.0.1:5173/crm/custom-fields');
  await expect(page.getByRole('heading', { name: 'Custom Fields' })).toBeVisible();
  await expect(page.getByRole('alert')).toContainText('VITE_CRM_API_URL');
  await expect(page.getByRole('button', { name: 'Create field' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Save value' })).toHaveCount(0);
  expect(errors).toEqual([]);
});
