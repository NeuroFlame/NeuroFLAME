import { expect, Page } from '@playwright/test'
import { EXIST_TIMEOUT } from './constants'

type AdminTab = 'Vault Status' | 'User Password' | 'User Roles'

export async function goToAdminPage(page: Page) {
  await page.getByTestId('MenuIcon').click()
  await page.getByTestId('admin-menu-item').click()
  await expectAdminPanel(page)
}

export async function expectAdminPanel(page: Page) {
  await expect(page.getByText('Admin Panel')).toBeVisible({ timeout: EXIST_TIMEOUT })
}

export async function goToAdminTab(page: Page, tabName: AdminTab) {
  await page.getByRole('tab', { name: tabName }).click()
}

export async function selectRoles(page: Page, roles: string[]) {
  await page.getByRole('combobox', { name: 'Roles' }).click()
  for (const role of roles) {
    await page.getByRole('option', { name: role }).click()
  }
  await page.keyboard.press('Escape')
}

export async function createVaultUser(page: Page, email: string, password: string) {
  await goToAdminTab(page, 'Vault Status')
  await page.getByPlaceholder('Vault User Email').fill(email)
  await page.getByPlaceholder('Password').fill(password)
  await page.getByRole('button', { name: 'Create User' }).click()
}

export async function changeUserPassword(page: Page, username: string, newPassword: string) {
  await goToAdminTab(page, 'User Password')
  await page.getByPlaceholder('Enter username').fill(username)
  await page.getByPlaceholder('Enter new password').fill(newPassword)
  await page.getByRole('button', { name: 'Update Password' }).click()
}

export async function changeUserRoles(page: Page, username: string, roles: string[]) {
  await goToAdminTab(page, 'User Roles')
  await page.getByPlaceholder('Enter username').fill(username)
  await selectRoles(page, roles)
  await page.getByRole('button', { name: 'Update Roles' }).click()
}
