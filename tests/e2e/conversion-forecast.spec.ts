import { test, expect } from '@playwright/test';

test('Lead conversion and stage forecast remain gated behind live Laravel session', async ({ page }) => {
  const pageErrors: string[] = [];
  page.on('pageerror', (error) => pageErrors.push(error.message));
  await page.goto('http://127.0.0.1:5173/crm/leads');
  await expect(page.getByRole('heading', { name: 'Leads', exact: true })).toBeVisible();
  await expect(page.getByRole('alert')).toContainText('VITE_CRM_API_URL');
  await page.goto('http://127.0.0.1:5173/crm/dashboard');
  await expect(page.getByRole('heading', { name: 'CRM Dashboard & Reports' })).toBeVisible();
  await expect(page.getByRole('alert')).toContainText('VITE_CRM_API_URL');
  expect(pageErrors).toEqual([]);
});
