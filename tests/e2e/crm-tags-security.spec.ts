import { test, expect } from '@playwright/test';

test('live CRM tags requires a configured Laravel backend and never substitutes demo tags', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('http://127.0.0.1:5173/crm/tags');
  await expect(page.getByRole('heading', { name: 'Tags & Segments' })).toBeVisible();
  await expect(page.getByRole('alert')).toContainText('VITE_CRM_API_URL');
  await expect(page.getByRole('button', { name: 'Create tag' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Assign tag' })).toHaveCount(0);
  expect(errors).toEqual([]);
});
