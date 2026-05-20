import { expect, Page, test } from '@playwright/test'
import { v4 as uuidv4 } from 'uuid'
import { COMPUTATION_TIMEOUT } from '../../libs/constants'
import { destroyAllInstances, setup } from '../../libs/setup'
import user from '../../libs/user'

const EMAIL_ID = uuidv4()

const NEW_USER = {
  username: `e2e-test-user-${EMAIL_ID}@email.com`,
  password: 'password',
}

test.describe.only('User Registration', () => {
  let page: Page

  test.beforeAll(async () => {
    test.setTimeout(COMPUTATION_TIMEOUT)
    page = (await setup(1)) as Page
  })

  test.afterAll(async () => {
    await destroyAllInstances()
  })

  test('create a new user', async () => {
    await expect(page).toHaveTitle('NeuroFLAME')
    await page.getByRole('button', { name: 'Create User' }).click()
    await user.register(NEW_USER, page)
    await expect(page.getByRole('alert')).toContainText('New user successfully created. Log In below.')
  })

  test('login with the new user', async () => {
    await user.logIn(NEW_USER, page)
    await expect(page.locator('h2')).toContainText('Welcome to NeuroFLAME')
    await user.logOut(page)
  })

  test('get error when creata a new user with existing email', async () => {
    await page.getByRole('button', { name: 'Create User' }).click()
    await user.register(NEW_USER, page)
    await expect(page.getByRole('alert')).toContainText('User already exists')
  })
})
