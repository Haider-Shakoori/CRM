import { defineConfig, devices } from '@playwright/test';

/**
 * Real Chromium smoke tests for the three existing frontend applications.
 * No backend or credentials are required; all data remains the labelled mock dataset.
 */
const inCI = Boolean(process.env.CI);

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  forbidOnly: inCI,
  retries: inCI ? 1 : 0,
  workers: inCI ? 2 : undefined,
  reporter: inCI ? [['github'], ['html', { open: 'never' }]] : 'list',
  timeout: 45_000,
  expect: { timeout: 15_000 },
  use: {
    ...devices['Desktop Chrome'],
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  webServer: [
    {
      command: 'npm run dev --workspace @crm/website -- --host 127.0.0.1',
      url: 'http://127.0.0.1:4321/',
      timeout: 120_000,
      reuseExistingServer: !inCI,
    },
    {
      command: 'npm run dev --workspace @crm/app -- --host 127.0.0.1',
      url: 'http://127.0.0.1:5173/app/home',
      timeout: 120_000,
      reuseExistingServer: !inCI,
    },
    {
      command: 'npm run dev --workspace @crm/platform-admin -- --host 127.0.0.1',
      url: 'http://127.0.0.1:5174/',
      timeout: 120_000,
      reuseExistingServer: !inCI,
    },
  ],
});
