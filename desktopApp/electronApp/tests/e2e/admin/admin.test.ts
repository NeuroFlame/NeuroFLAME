import { expect, Page, test } from '@playwright/test'
import {
  changeUserPassword,
  changeUserRoles,
  createVaultUser,
  expectAdminPanel,
  goToAdminPage,
} from '../../libs/admin'
import { COMPUTATION_TIMEOUT, EXIST_TIMEOUT, USER_1, USER_2, USER_3, USER_4 } from '../../libs/constants'
import { destroyAllInstances, setup } from '../../libs/setup'
import user from '../../libs/user'

const UPDATED_PASSWORD = 'password333'

const VAULT_TEST_USER = {
  email: 'test-vault-user@email.com',
  password: 'password123',
}

test.describe('Admin Page', () => {
  let page: Page

  test.beforeAll(async () => {
    test.setTimeout(COMPUTATION_TIMEOUT)
    page = (await setup(1)) as Page
    await user.logIn(USER_4, page)
    await goToAdminPage(page)
  })

  test.afterAll(async () => {
    await destroyAllInstances()
  })

  test('admin page is accessible only to admin users', async () => {
    await user.logOut(page)
    await user.logIn(USER_1, page)
    await page.getByTestId('MenuIcon').click()
    await expect(page.getByTestId('admin-menu-item')).not.toBeVisible()
    await page.getByText('Logout', { exact: true }).click({ timeout: EXIST_TIMEOUT })

    await user.logIn(USER_4, page)
    await goToAdminPage(page)
    await expectAdminPanel(page)
  })

  test('create vault user', async () => {
    await createVaultUser(page, VAULT_TEST_USER.email, VAULT_TEST_USER.password)
    await expect(page.getByRole('alert')).toContainText(
      `Vault user ${VAULT_TEST_USER.email} created. Use this token as VAULT_ACCESS_TOKEN.`,
    )
    await expect(page.getByRole('button', { name: 'Copy Token' })).toBeVisible()
  })

  test('change user password', async () => {
    await changeUserPassword(page, USER_3.username, UPDATED_PASSWORD)
    await expect(page.getByRole('alert')).toContainText(
      `Password for ${USER_3.username} was successfully updated.`,
    )

    await user.logOut(page)
    await user.logIn({ username: USER_3.username, password: UPDATED_PASSWORD }, page)
    await expect(page.getByText('Welcome to NeuroFLAME')).toBeVisible()
    await user.logOut(page)
    await user.logIn(USER_4, page)
    await goToAdminPage(page)
  })

  test('change user roles', async () => {
    await changeUserRoles(page, USER_2.username, ['admin'])

    await user.logOut(page)
    await user.logIn(USER_2, page)
    await goToAdminPage(page)
    await expectAdminPanel(page)
    await user.logOut(page)
    await user.logIn(USER_4, page)
    await goToAdminPage(page)
  })
})
