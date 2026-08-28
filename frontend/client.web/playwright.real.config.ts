import { defineConfig } from '@playwright/test';
import { env } from 'node:process';

const baseURL = env.ARCANELINK_REAL_BASE_URL?.trim() || 'http://127.0.0.1:5173';

export default defineConfig({
  testDir: './e2e/real',
  testMatch: '**/*.real.spec.ts',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 90_000,
  expect: {
    timeout: 10_000
  },
  outputDir: 'test-results/real',
  reporter: [
    ['list'],
    ['html', { open: 'never', outputFolder: 'playwright-report/real' }]
  ],
  use: {
    baseURL,
    trace: 'retain-on-failure'
  }
});
