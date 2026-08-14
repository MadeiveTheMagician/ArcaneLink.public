import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: './tests/unit',
  testMatch: '**/*.test.ts',
  fullyParallel: true,
  reporter: 'list',
  workers: 4,
})
