import { expect, Page, test } from '@playwright/test'
import { COMPUTATION_TIMEOUT } from '../../libs/constants'
import { destroyAllInstances, setup } from '../../libs/setup'
import user from '../../libs/user'

const TEST_USER = {
  username: 'e2e-test-user-1@email.com',
  password: 'password',
}

const NEW_PASSWORD = 'password123'
const RESET_TOKEN = 'reset-token'

test.describe('Reset Password', () => {
  let page: Page

  test.beforeAll(async () => {
    test.setTimeout(COMPUTATION_TIMEOUT)
    page = (await setup(1)) as Page
  })

  test.afterAll(async () => {
    await destroyAllInstances()
  })

  test('send reset password token with invalid email', async () => {
    await expect(page).toHaveTitle('NeuroFLAME')
    await page.getByRole('button', { name: 'Reset Password' }).click()
    await page.getByPlaceholder('Username \(Email\)').fill('random-email@email.com')
    await page.getByRole('button', { name: 'Send token' }).click()
    await expect(page.getByRole('alert')).toContainText('User not found')
  })

  test('send reset password token with valid email', async () => {
    await page.getByPlaceholder('Username \(Email\)').fill('e2e-test-user-2@email.com')
    await page.getByRole('button', { name: 'Send token' }).click()
    await expect(page.getByPlaceholder('New Password')).toBeVisible()
  })

  test('reset password', async () => {
    // Log in with current password
    await page.getByRole('button', { name: 'Back to Login' }).click()
    await user.logIn(TEST_USER, page)
    await user.logOut(page)

    // Reset password
    await page.getByRole('button', { name: 'Reset Password' }).click()
    await page.getByRole('button', { name: 'I already have a token' }).click()
    await page.getByPlaceholder('New Password').fill(NEW_PASSWORD)
    await page.getByPlaceholder('Token').fill(RESET_TOKEN)
    await page.getByRole('button', { name: 'Reset Password' }).click()

    // Logged in after resetting password
    await expect(page.locator('h2')).toContainText('Welcome to NeuroFLAME')
    await user.logOut(page)
  })
})
