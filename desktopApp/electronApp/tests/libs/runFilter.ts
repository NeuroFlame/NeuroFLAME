import { expect, Page } from '@playwright/test'
import { EXIST_TIMEOUT } from './constants'

export const SEEDED_CONSORTIUM_TITLES = {
  ridge: 'Single Round Ridge Regression Consortium',
  vbm: 'Single Round Closedform Regression VBM',
} as const

export const SEEDED_RUN_COUNT = 4

// Navigate to Run List without changing filter state (used when verifying persisted filters).
export async function openRunList(page: Page) {
  await page.getByTestId('menu-icon').click()
  await page.getByTestId('runs-list-menu-item').click()
  await expect(page.getByRole('heading', { name: 'Run List' })).toBeVisible({
    timeout: EXIST_TIMEOUT,
  })
}

// Opens Run List with a clean slate for filter interaction tests.
export async function goToRunList(page: Page) {
  await openRunList(page)
  await clearAllFilters(page)
}

const clearFiltersButton = (page: Page) =>
  page.getByRole('button', { name: 'Clear Filters' })

async function waitForActiveFilters(page: Page) {
  await expect(clearFiltersButton(page)).toBeEnabled({ timeout: EXIST_TIMEOUT })
}

export async function clearAllFilters(page: Page) {
  const clearButton = clearFiltersButton(page)
  if (await clearButton.isEnabled()) {
    await clearButton.click()
    await expect(clearButton).toBeDisabled({ timeout: EXIST_TIMEOUT })
  }
}

export async function selectConsortiumFilter(page: Page, consortiumTitle: string) {
  await page.getByRole('combobox', { name: 'Consortium Name' }).click()
  await page.getByRole('option', { name: consortiumTitle }).click()
  await page.keyboard.press('Escape')
  await waitForActiveFilters(page)
}

export async function selectStatusFilter(page: Page, status: string) {
  await page.getByRole('combobox', { name: 'Status' }).click()
  await page.getByRole('option', { name: status, exact: true }).click()
  await page.keyboard.press('Escape')
  await waitForActiveFilters(page)
}

export async function setStartDate(page: Page, date: string) {
  await page.getByLabel('Start Date').fill(date)
  if (date) {
    await waitForActiveFilters(page)
  }
}

export async function setEndDate(page: Page, date: string) {
  await page.getByLabel('End Date').fill(date)
  if (date) {
    await waitForActiveFilters(page)
  }
}

export async function setStarredOnly(page: Page, enabled: boolean) {
  const toggle = page.getByRole('checkbox', { name: 'Starred Only' })
  const checked = await toggle.isChecked()
  if (checked !== enabled) {
    await toggle.click()
  }
  if (enabled) {
    await waitForActiveFilters(page)
  }
}

export function getRunCard(page: Page, consortiumTitle: string, status: string) {
  return page.getByTestId('run-list-item')
    .filter({ hasText: consortiumTitle })
    .filter({ hasText: `Status: ${status}` })
}

export async function expectVisibleRunCount(page: Page, count: number) {
  await expect(page.getByRole('button', { name: 'View Details' })).toHaveCount(count, {
    timeout: EXIST_TIMEOUT,
  })
}

// Asserts selected status chips and whether Clear Filters reflects active filter state.
export async function expectStatusFilter(page: Page, statuses: string[]) {
  const statusCombobox = page.getByRole('combobox', { name: 'Status' })

  for (const status of statuses) {
    await expect(statusCombobox.getByText(status, { exact: true })).toBeVisible()
  }

  if (statuses.length === 0) {
    await expect(clearFiltersButton(page)).toBeDisabled()
  } else {
    await expect(clearFiltersButton(page)).toBeEnabled()
  }
}

export async function expectRunListFilteredByStatus(
  page: Page,
  status: string,
  options?: { excludeStatuses?: string[] },
) {
  await expectStatusFilter(page, [status])
  await expectVisibleRunCount(page, 1)
  await expect(page.getByText(`Status: ${status}`)).toBeVisible()

  for (const excludedStatus of options?.excludeStatuses ?? []) {
    await expect(page.getByText(`Status: ${excludedStatus}`)).toHaveCount(0)
  }
}
