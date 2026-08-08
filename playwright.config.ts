import { defineConfig, devices } from '@playwright/test'

/**
 * E2E tests.
 *
 * The webServer runs the app in DEMO mode (NEXT_PUBLIC_DEMO_MODE=true), so
 * the dashboard smoke tests run without a database. The full auth flow
 * (e2e/auth.spec.ts) is skipped unless E2E_WITH_DB=true and a seeded
 * database is reachable.
 */
export default defineConfig({
  testDir: './e2e',
  timeout: 30_000,
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: 'list',
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: 'pnpm dev',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
    env: { NEXT_PUBLIC_DEMO_MODE: 'true' },
  },
})
