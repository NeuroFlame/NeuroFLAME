import { expect, Page, test } from '@playwright/test'
import { COMPUTATION_TIMEOUT, USER_1, USER_2 } from '../../libs/constants'
import {
  clearAllFilters,
  expectRunListFilteredByStatus,
  expectVisibleRunCount,
  getRunCard,
  goToRunList,
  openRunList,
  SEEDED_CONSORTIUM_TITLES,
  SEEDED_RUN_COUNT,
  selectConsortiumFilter,
  selectStatusFilter,
  setEndDate,
  setStarredOnly,
  setStartDate,
} from '../../libs/runFilter'
import { destroyAllInstances, setup } from '../../libs/setup'
import user from '../../libs/user'

// Exercises each Run List filter control against the seeded run data (4 runs, mixed statuses/consortia).
test.describe.only('Run list filters', () => {
  let page: Page

  test.beforeAll(async () => {
    test.setTimeout(COMPUTATION_TIMEOUT)
    page = (await setup(1)) as Page
    await user.logIn(USER_1, page)
    await goToRunList(page) // start from a known empty filter state
  })

  test.afterAll(async () => {
    await user.logOut(page)
    await destroyAllInstances()
  })

  // Reset filters between tests so each case starts independently.
  test.afterEach(async () => {
    await clearAllFilters(page)
  })

  test('shows filter controls with clear filters button disabled when no filters are active', async () => {
    // Default state: all filter inputs visible and Clear Filters disabled.
    await expect(page.getByRole('combobox', { name: 'Consortium Name' })).toBeVisible()
    await expect(page.getByLabel('Start Date')).toBeVisible()
    await expect(page.getByLabel('End Date')).toBeVisible()
    await expect(page.getByRole('combobox', { name: 'Status' })).toBeVisible()
    await expect(page.getByRole('checkbox', { name: 'Starred Only' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Clear Filters' })).toBeDisabled()
  })

  test('filters runs by status', async () => {
    // Seeded data has exactly one Complete run.
    await selectStatusFilter(page, 'Complete')
    await expectRunListFilteredByStatus(page, 'Complete', { excludeStatuses: ['Pending'] })
  })

  test('filters runs by consortium', async () => {
    // VBM consortium has 2 seeded runs; ridge consortium runs should be hidden.
    await selectConsortiumFilter(page, SEEDED_CONSORTIUM_TITLES.vbm)
    await expectVisibleRunCount(page, 2)
    await expect(page.getByText(SEEDED_CONSORTIUM_TITLES.ridge)).toHaveCount(0)
  })

  test('filters runs by date range', async () => {
    // Only the Complete run falls within 2024.
    await setStartDate(page, '2024-01-01')
    await setEndDate(page, '2024-12-31')
    await expectVisibleRunCount(page, 1)
    await expect(page.getByText('Status: Complete')).toBeVisible()
  })

  test('filters to starred runs only', async () => {
    // Star one run, enable Starred Only, then unstar to avoid leaving starred state for other tests.
    const completeRidgeRun = getRunCard(page, SEEDED_CONSORTIUM_TITLES.ridge, 'Complete')
    await completeRidgeRun.getByRole('button', { name: 'Star run' }).click()
    await setStarredOnly(page, true)
    await expectVisibleRunCount(page, 1)
    await expect(page.getByText('Status: Complete')).toBeVisible()
    await completeRidgeRun.getByRole('button', { name: 'Unstar run' }).click()
  })

  test('clear filters restores the full run list', async () => {
    // Seeded data has exactly one Failed run.
    await selectStatusFilter(page, 'Failed')
    await expectVisibleRunCount(page, 1)

    await clearAllFilters(page)
    await expectVisibleRunCount(page, SEEDED_RUN_COUNT)
  })

  test('shows empty state when no runs match filters', async () => {
    // Date range with no seeded runs triggers the empty-filter message.
    await setStartDate(page, '2010-01-01')
    await setEndDate(page, '2010-12-31')
    await expectVisibleRunCount(page, 0)
    await expect(page.getByText('No runs match your filters.')).toBeVisible()
  })
})

// Filters are stored in localStorage keyed by userId; each user keeps their own preferences.
test.describe.only('Run list filter persistence', () => {
  let page: Page

  test.beforeAll(async () => {
    test.setTimeout(COMPUTATION_TIMEOUT)
    page = (await setup(1)) as Page
  })

  test.afterAll(async () => {
    await user.logOut(page)
    await destroyAllInstances()
  })

  test('persists filters per user across login sessions', async () => {
    // User1 sets and saves a Complete filter, then logs out.
    await user.logIn(USER_1, page)
    await goToRunList(page)
    await selectStatusFilter(page, 'Complete')
    await expectRunListFilteredByStatus(page, 'Complete')
    await user.logOut(page)

    // User2 sets a different Failed filter; should not overwrite user1's stored preferences.
    await user.logIn(USER_2, page)
    await goToRunList(page)
    await selectStatusFilter(page, 'Failed')
    await expectRunListFilteredByStatus(page, 'Failed')
    await user.logOut(page)

    // User1 logs back in and should see their previously saved Complete filter restored.
    await user.logIn(USER_1, page)
    await openRunList(page) // do not clear filters — we are verifying persistence
    await expectRunListFilteredByStatus(page, 'Complete', { excludeStatuses: ['Failed'] })
    await user.logOut(page)

    // User2 logs back in and should see their previously saved Failed filter restored.
    await user.logIn(USER_2, page)
    await openRunList(page) // do not clear filters — we are verifying persistence
    await expectRunListFilteredByStatus(page, 'Failed', { excludeStatuses: ['Complete'] })
  })
})
