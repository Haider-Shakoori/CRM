import { test, expect } from '@playwright/test';

test('global live search refuses mock records when API URL is missing', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('http://127.0.0.1:5173/crm/search');
  await expect(page.getByRole('heading', { name: 'Global CRM Search' })).toBeVisible();
  await expect(page.getByRole('alert')).toContainText('VITE_CRM_API_URL');
  await expect(page.getByRole('searchbox')).toHaveCount(0);
  expect(errors).toEqual([]);
});
