import { Page } from '@playwright/test'
import { EXIST_TIMEOUT } from './constants'

const logIn = async ({ username, password }, page: Page) => {
  await page.getByPlaceholder(/Username( \(Email\)| or Email)/i).fill(username, { timeout: EXIST_TIMEOUT })
  await page.getByPlaceholder('Password').fill(password)
  await page.getByRole('button', { name: 'Log In' }).click()
}

const logOut = async (page: Page) => {
  if (page.isClosed()) {
    return
  }

  if (await page.getByRole('button', { name: /log in/i }).isVisible().catch(() => false)) {
    return
  }

  await page.getByLabel('menu').click({ timeout: EXIST_TIMEOUT })
  await page.getByText('Logout', { exact: true }).click({ timeout: EXIST_TIMEOUT })
}

const register = async ({ username, password }, page: Page) => {
  await page.getByPlaceholder('Username \(Email\)').fill(username)
  await page.getByPlaceholder('Password').fill(password)
  await page.getByRole('button', { name: 'Create User' }).click()
}

export default {
  logIn,
  logOut,
  register,
}
