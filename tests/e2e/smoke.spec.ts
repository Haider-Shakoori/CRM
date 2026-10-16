import { expect, test } from '@playwright/test';

test('public site loads its real marketing homepage', async ({ page }) => {
  await page.goto('http://127.0.0.1:4321/');
  await expect(page.locator('h1')).toBeVisible();
  await expect(page).toHaveTitle(/CRM/i);
});

test('CRM shell opens home and sales navigation without crashing', async ({ page }) => {
  await page.goto('/app/home');
  await expect(page.locator('main')).toBeVisible();
  await expect(page.locator('body')).not.toContainText('Something went wrong');
  await page.goto('/app/leads');
  await expect(page).toHaveURL(/\/app\/leads$/);
  await expect(page.locator('main')).toBeVisible();
  await expect(page.locator('body')).not.toContainText('Something went wrong');
});

test('platform-owner application is a separate, honestly labelled surface', async ({ page }) => {
  await page.goto('http://127.0.0.1:5174/');
  await expect(page.locator('h1')).toContainText('platform console', { ignoreCase: true });
});
