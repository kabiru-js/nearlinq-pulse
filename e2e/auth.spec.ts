import { test, expect } from '@playwright/test'

// Full auth flow. Requires a seeded database (pnpm seed) and
// E2E_WITH_DB=true - skipped otherwise.
const WITH_DB = process.env.E2E_WITH_DB === 'true'

test('login redirects and signs in with demo credentials', async ({ page }) => {
  test.skip(!WITH_DB, 'requires a seeded database (E2E_WITH_DB=true)')

  await page.goto('/')
  await expect(page).toHaveURL(/\/login/)

  await page.getByPlaceholder('you@farm.com').fill('demo@nearling.dev')
  await page.getByPlaceholder('••••••••').fill('demo1234')
  await page.getByRole('button', { name: 'Sign in' }).click()

  await expect(
    page.getByRole('heading', { name: 'Nearling Pulse' })
  ).toBeVisible()
  await expect(page.getByText('Bessie')).toBeVisible()

  // Sign out returns to the login page.
  await page.getByRole('button', { name: 'Sign out' }).click()
  await expect(page).toHaveURL(/\/login/)
})
