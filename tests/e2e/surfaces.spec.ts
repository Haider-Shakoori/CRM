import { expect, test } from '@playwright/test';

test('website homepage and pricing render without browser errors', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('http://127.0.0.1:4321/');
  await expect(page.locator('main')).toBeVisible();
  await page.goto('http://127.0.0.1:4321/pricing');
  await expect(page.locator('main')).toBeVisible();
  expect(errors).toEqual([]);
});

test('CRM sales and support routes render their actual screens', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  for (const [path, text] of [
    ['/app/leads', 'Lead'],
    ['/app/contacts', 'Contact'],
    ['/app/deals', 'Deal'],
    ['/app/tickets', 'Ticket'],
  ] as const) {
    await page.goto(`http://127.0.0.1:5173${path}`);
    const main = page.locator('#main');
    await expect(main).toBeVisible();
    await expect(main).toContainText(text);
    await expect(main).not.toContainText('The application encountered a problem');
  }
  expect(errors).toEqual([]);
});

test('platform owner surface clearly identifies its demo status', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('http://127.0.0.1:5174/');
  await expect(page.locator('body')).toContainText('SaaS platform owner console');
  await expect(page.locator('body')).toContainText('landing');
  expect(errors).toEqual([]);
});

test('Laravel authentication and recovery previews render safely without backend configuration', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('http://127.0.0.1:5173/api-sign-in');
  await expect(page.getByRole('heading', { name: 'CRM API sign in' })).toBeVisible();
  await page.goto('http://127.0.0.1:5173/forgot-password');
  await expect(page.getByRole('heading', { name: 'Recover your account' })).toBeVisible();
  await page.goto('http://127.0.0.1:5173/reset-password');
  await expect(page.getByRole('alert')).toBeVisible();
  await page.goto('http://127.0.0.1:5173/api-workspace');
  await expect(page.getByRole('heading', { name: 'CRM — Live API workspace' })).toBeVisible();
  expect(errors).toEqual([]);
});
