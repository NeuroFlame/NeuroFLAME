import { expect, Page, test } from '@playwright/test'
import { v4 as uuidv4 } from 'uuid'
import {
  changeUserPassword,
  changeUserRoles,
  createVaultUser,
  expectAdminPanel,
  goToAdminPage,
} from '../../libs/admin'
import { COMPUTATION_TIMEOUT, EXIST_TIMEOUT, USER_1, USER_4 } from '../../libs/constants'
import { destroyAllInstances, setup } from '../../libs/setup'
import user from '../../libs/user'

const TEST_PASSWORD = 'password123'

type TestUser = {
  username: string
  password: string
}

function createTestUserCredentials(prefix: string): TestUser {
  return {
    username: `e2e-admin-${prefix}-${uuidv4()}@email.com`,
    password: TEST_PASSWORD,
  }
}

async function createRegularTestUser(page: Page, prefix: string): Promise<TestUser> {
  const credentials = createTestUserCredentials(prefix)

  await user.logOut(page)
  await page.getByRole('button', { name: 'Create User', exact: true }).click()
  await user.register(credentials, page)
  await expect(page.getByRole('alert')).toContainText(
    'New user successfully created. Log In below.',
  )
  await user.logIn(USER_4, page)
  await goToAdminPage(page)

  return credentials
}

test.describe('Admin Page', () => {
  let page: Page

  test.beforeEach(async () => {
    test.setTimeout(COMPUTATION_TIMEOUT)
    page = (await setup(1)) as Page
    await user.logIn(USER_4, page)
    await goToAdminPage(page)
  })

  test.afterEach(async () => {
    await destroyAllInstances()
  })

  test('admin page is accessible only to admin users', async () => {
    await user.logOut(page)
    await user.logIn(USER_1, page)

    await page.evaluate(() => {
      window.location.hash = '#/admin'
    })
    await expect(page).toHaveURL(/#\/home$/)
    await expect(page.getByText('Admin Panel')).not.toBeVisible()

    await page.getByTestId('MenuIcon').click()
    await expect(page.getByTestId('admin-menu-item')).not.toBeVisible()
    await page.getByText('Logout', { exact: true }).click({ timeout: EXIST_TIMEOUT })

    await user.logIn(USER_4, page)
    await goToAdminPage(page)
    await expectAdminPanel(page)
  })

  test('create vault user', async () => {
    const vaultUser = createTestUserCredentials('vault')
    await createVaultUser(page, vaultUser.username, vaultUser.password)
    await expect(page.getByRole('alert')).toContainText(
      `Vault user ${vaultUser.username} created. Use this token as VAULT_ACCESS_TOKEN.`,
    )
    await expect(page.getByRole('button', { name: 'Copy Token' })).toBeVisible()
  })

  test('change user password', async () => {
    const testUser = await createRegularTestUser(page, 'password')

    const updatedPassword = 'password333'
    await changeUserPassword(page, testUser.username, updatedPassword)
    await expect(page.getByRole('alert')).toContainText(
      `Password for ${testUser.username} was successfully updated.`,
    )

    await user.logOut(page)
    await user.logIn({ username: testUser.username, password: updatedPassword }, page)
    await expect(page.getByText('Welcome to NeuroFLAME')).toBeVisible()
  })

  test('change user roles', async () => {
    const testUser = await createRegularTestUser(page, 'roles')

    await changeUserRoles(page, testUser.username, ['admin'])
    await expect(page.getByRole('alert')).toContainText(
      `Roles for ${testUser.username} were successfully updated.`,
    )

    await user.logOut(page)
    await user.logIn(testUser, page)
    await goToAdminPage(page)
    await expectAdminPanel(page)
  })
})
