import { test, expect } from '@playwright/test';

test('platform-owner app does not expose real operator controls without a configured API', async ({ page }) => {
  const errors: string[] = [];
  const platformRequests: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('request', (request) => {
    if (request.url().includes('/api/v1/platform/')) platformRequests.push(request.url());
  });
  await page.goto('http://127.0.0.1:5174/');
  await expect(page.getByText('Frontend demo')).toBeVisible();
  await expect(page.getByRole('heading', { name: /platform console is separate and ready for secure API configuration/i })).toBeVisible();
  await expect(page.getByRole('button', { name: /apply manual change/i })).toHaveCount(0);
  expect(platformRequests).toEqual([]);
  expect(errors).toEqual([]);
});
