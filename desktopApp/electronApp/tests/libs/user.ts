import { Page } from "@playwright/test"
import { EXIST_TIMEOUT } from './constants'

const logIn = async ({ username, password }, page: Page) => {
  await page.getByPlaceholder('Username').fill(username, { timeout: EXIST_TIMEOUT })
  await page.getByPlaceholder('Password').fill(password)
  await page.getByRole('button', { name: 'Log In' }).click()
}

const logOut = async (page: Page) => {
  await page.getByLabel("menu").click({ timeout: EXIST_TIMEOUT });
  (await page.$('div:text("Logout")'))?.click()
}

export default {
  logIn,
  logOut,
}
