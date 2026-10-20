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
  await expect(page).toHaveURL(/\/crm\/leads$/);
  await expect(page.getByRole('heading', { name: 'Leads', exact: true })).toBeVisible();
  expect(errors).toEqual([]);
});

test('demo Leads provides an explicit entry to the independent live Leads route', async ({ page }) => {
  await page.goto('http://127.0.0.1:5173/app/leads');
  const live = page.getByRole('link', { name: 'Live Leads (Laravel)' });
  await expect(live).toBeVisible();
  await live.click();
  await expect(page).toHaveURL(/\/crm\/leads$/);
  await expect(page.getByRole('heading', { name: 'Leads', exact: true })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Demo Leads' })).toHaveAttribute('href', '/app/leads');
});

test('demo Contacts and Accounts link to their live Laravel directories', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  for (const [demo, label, live, heading] of [
    ['/app/contacts', 'Live Contacts (Laravel)', '/crm/contacts', 'Contacts'],
    ['/app/accounts', 'Live Accounts (Laravel)', '/crm/accounts', 'Accounts'],
  ] as const) {
    await page.goto('http://127.0.0.1:5173' + demo);
    const link = page.getByRole('link', { name: label });
    await expect(link).toBeVisible();
    await link.click();
    await expect(page).toHaveURL(new RegExp(live.replace(/\//g, '\\/') + '$'));
    await expect(page.getByRole('heading', { name: heading, exact: true })).toBeVisible();
  }
  expect(errors).toEqual([]);
});


test('demo Deals links into the real authenticated pipeline board without backend configuration', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('http://127.0.0.1:5173/app/deals');
  const link = page.getByRole('link', { name: 'Live Deals (Laravel)' }).first();
  await expect(link).toBeVisible();
  await link.click();
  await expect(page).toHaveURL(/\/crm\/deals$/);
  await expect(page.getByRole('heading', { name: 'Sales Pipelines & Deals' })).toBeVisible();
  await expect(page.getByRole('alert')).toContainText('VITE_CRM_API_URL');
  await expect(page.getByRole('link', { name: 'Demo Deals' })).toHaveAttribute('href', '/app/deals');
  expect(errors).toEqual([]);
});

test('demo productivity pages clearly link to separate Laravel-backed Activities and Tasks', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  for (const [source, link, target, heading] of [
    ['/app/activities', 'Live My Work (Laravel)', '/crm/my-work', 'My Work'],
    ['/app/tasks', 'Live Tasks (Laravel)', '/crm/tasks', 'Tasks'],
    ['/app/activities/all', 'Live Activities (Laravel)', '/crm/activities', 'Activities'],
  ] as const) {
    await page.goto('http://127.0.0.1:5173' + source);
    await page.getByRole('link', { name: link }).click();
    await expect(page).toHaveURL(new RegExp(target.replace(/\//g, '\\/') + '$'));
    await expect(page.getByRole('heading', { name: heading, exact: true })).toBeVisible();
    await expect(page.getByRole('alert')).toContainText('VITE_CRM_API_URL');
  }
  expect(errors).toEqual([]);
});
