import { expect, test } from '@playwright/test'

test('loads the portfolio shell', async ({ page }) => {
  await page.goto('/')

  await expect(page).toHaveTitle('Trading Dashboard')
  await expect(page.getByRole('heading', { name: 'Overview' })).toBeVisible()
  await expect(page.getByText('No sources connected')).toBeVisible()
})
