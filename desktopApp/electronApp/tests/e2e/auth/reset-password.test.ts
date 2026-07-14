import { expect, Page, test } from '@playwright/test'
import { COMPUTATION_TIMEOUT } from '../../libs/constants'
import { destroyAllInstances, setup } from '../../libs/setup'
import user from '../../libs/user'

const TEST_USER = {
  username: 'e2e-test-user-1@email.com',
  password: 'password',
}

const NEW_PASSWORD = 'password123'
const RESEND_MOCK_URL = process.env.RESEND_MOCK_URL

test.describe('Reset Password', () => {
  let page: Page

  test.beforeAll(async () => {
    test.setTimeout(COMPUTATION_TIMEOUT)
    page = (await setup(1)) as Page
  })

  test.afterAll(async () => {
    await destroyAllInstances()
  })

  test('requests and uses a password reset token without revealing accounts', async () => {
    await expect(page).toHaveTitle('NeuroFLAME')

    if (!RESEND_MOCK_URL) {
      throw new Error('RESEND_MOCK_URL is required for this test')
    }

    const clearResponse = await fetch(`${RESEND_MOCK_URL}/messages`, {
      method: 'DELETE',
    })
    expect(clearResponse.ok).toBe(true)

    // Unknown accounts receive the same public response as known accounts.
    await page.getByRole('button', { name: 'Reset Password' }).click()
    await page.getByPlaceholder('Username (Email)').fill('random-email@email.com')
    await page.getByRole('button', { name: 'Send token' }).click()
    await expect(page.getByPlaceholder('New Password')).toBeVisible()

    const unknownEmailResponse = await fetch(
      `${RESEND_MOCK_URL}/messages/latest?to=random-email%40email.com`,
    )
    expect(unknownEmailResponse.status).toBe(404)

    // Request a token for the seeded test user. CI redirects the normal Resend
    // request to the local mock service.
    await page.getByRole('button', { name: 'Resend Email' }).click()
    await page.getByPlaceholder('Username (Email)').fill(TEST_USER.username)
    await page.getByRole('button', { name: 'Send token' }).click()
    await expect(page.getByPlaceholder('New Password')).toBeVisible()

    const emailResponse = await fetch(
      `${RESEND_MOCK_URL}/messages/latest?to=${encodeURIComponent(TEST_USER.username)}`,
    )
    expect(emailResponse.ok).toBe(true)
    const email = await emailResponse.json() as {
      to: string | string[]
      html: string
    }
    expect(Array.isArray(email.to) ? email.to : [email.to]).toContain(TEST_USER.username)

    const tokenMatch = email.html.match(/Token:\s*<strong>([^<]+)<\/strong>/)
    expect(tokenMatch).not.toBeNull()
    if (!tokenMatch) {
      throw new Error('Password reset token was missing from the email outbox')
    }
    const resetToken = tokenMatch[1]

    // Reset the same user's password with the token intercepted by the mock.
    await page.getByPlaceholder('New Password').fill(NEW_PASSWORD)
    await page.getByPlaceholder('Token').fill(resetToken)
    await page.getByRole('button', { name: 'Reset Password' }).click()

    // Resetting logs the user in; verify the new password also works afterward.
    await expect(page.locator('h2')).toContainText('Welcome to NeuroFLAME')
    await user.logOut(page)
    await user.logIn({ ...TEST_USER, password: NEW_PASSWORD }, page)
    await expect(page.locator('h2')).toContainText('Welcome to NeuroFLAME')
    await user.logOut(page)
  })
})
