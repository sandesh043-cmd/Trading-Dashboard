import { expect, test } from '@playwright/test'

test('loads the owner sign-in shell', async ({ page }) => {
  await page.goto('/')

  await expect(page).toHaveTitle('Trading Dashboard')
  await expect(page.getByRole('heading', { name: 'Sign in' })).toBeVisible()
  await expect(page.getByLabel('Email')).toHaveValue('sandesh043@gmail.com')
})
