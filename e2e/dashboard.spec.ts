import { test, expect } from '@playwright/test'

// These smoke tests run in demo mode (see playwright.config.ts) - no DB needed.

test('dashboard renders with demo animals', async ({ page }) => {
  await page.goto('/')

  await expect(
    page.getByRole('heading', { name: 'Nearling Pulse' })
  ).toBeVisible()
  await expect(page.getByText('Individual Animals')).toBeVisible()
  await expect(page.getByText('Bessie')).toBeVisible()
})

test('status filter narrows the animal grid', async ({ page }) => {
  await page.goto('/')

  await page.getByRole('button', { name: 'Critical' }).click()
  await expect(page.getByText('Clara')).toBeVisible()
  await expect(page.getByText('Bessie')).not.toBeVisible()

  await page.getByRole('button', { name: 'All' }).click()
  await expect(page.getByText('Bessie')).toBeVisible()
})

test('modal opens, history view loads, and back returns to details', async ({
  page,
}) => {
  await page.goto('/')

  await page.getByText('Bessie').first().click()
  await expect(page.getByText('Overall Health')).toBeVisible()

  await page.getByRole('button', { name: 'View History' }).click()
  await expect(page.getByText('Vitals History')).toBeVisible()
  await expect(page.getByText('Check-up Log')).toBeVisible()

  await page.getByRole('button', { name: 'Back to details' }).click()
  await expect(page.getByText('Overall Health')).toBeVisible()
})
