import fs from 'fs/promises'
import path from 'path'
import { expect, Page } from '@playwright/test'
import { EXIST_TIMEOUT, COMPUTATION_TIMEOUT } from './constants'

const SRR_FREESURFER_PARAMETER_FILE = path.resolve(
  'tests/data/freesurfer-parameters.json',
)
const SRR_FREESURFER_SITE1_DIR = path.resolve('tests/data/freesurfer-site1')

const goToRunResults = async (page: Page) => {
  const resultsButton = page.getByRole('button', { name: /results/i }).first()

  if (await resultsButton.isVisible({ timeout: COMPUTATION_TIMEOUT }).catch(() => false)) {
    await resultsButton.click()
    await page.waitForURL(/\/run\/results\//, { timeout: EXIST_TIMEOUT })
    return
  }

  await page.getByRole('button', { name: /details/i }).click({ timeout: COMPUTATION_TIMEOUT })
  await page.waitForURL(/\/run\/details\//, { timeout: EXIST_TIMEOUT })
  await page.getByRole('button', { name: /view run results/i }).click({
    timeout: COMPUTATION_TIMEOUT,
  })
  await page.waitForURL(/\/run\/results\//, { timeout: EXIST_TIMEOUT })
}

const expectRunResults = async (page: Page) => {
  await expect(page.getByRole('heading', { name: /run results:/i })).toBeVisible()
  await expect(page.getByRole('link', { name: /download results/i })).toBeVisible()
  await expect(page.getByText(/failed to fetch results/i)).toHaveCount(0)

  const resultFile = page.getByText('global_regression_result.json')
  if (await resultFile.first().isVisible({ timeout: EXIST_TIMEOUT / 3 }).catch(() => false)) {
    await expect(resultFile).toBeVisible()
    return
  }

  await expect(
    page.getByText(/no index\.html file in the output folder\.|viewing:/i),
  ).toBeVisible({ timeout: EXIST_TIMEOUT })
}

const selectComputation = async ({ name }, page: Page) => {
  // Select a computation
  await page.getByRole('button', { name: /select a computation/i }).click()
  await page.getByTestId(name).click()

  // Go to next step
  await page.getByRole('button', { name: /go to next step/i }).click()
  await page.waitForTimeout(500)

  // Go to next step
  await page.getByRole('button', { name: /go to next step/i }).click()
}

const setDataForSRRFreesurfer = async (page: Page) => {
  // Set parameters
  const jsonData = await fs.readFile(SRR_FREESURFER_PARAMETER_FILE, 'utf8')
  const parameters = JSON.parse(jsonData)

  await page.getByRole('button', { name: /edit/i }).click()
  await page.getByTestId('parameters-textarea')
    .getByRole('textbox')
    .fill(JSON.stringify(parameters, null, 2), { timeout: EXIST_TIMEOUT })
  await page.getByRole('button', { name: /save/i }).click()

  // Go to next step
  await page.getByRole('button', { name: /go to next step/i }).click({ timeout: EXIST_TIMEOUT })

  // Select data
  await page.getByPlaceholder(/enter your data directory path/i).click({ timeout: EXIST_TIMEOUT })
  await page.getByPlaceholder(/enter your data directory path/i)
    .fill(process.env.CI === 'true'
      ? (process.env.CI_DATA_DIR ?? (() => { throw new Error('CI_DATA_DIR is not set') })())
      : SRR_FREESURFER_SITE1_DIR)
  await page.getByRole('button', { name: /save/i }).click()
}

const runComputation = async (page: Page) => {
  // Go to next step
  await page.getByRole('button', { name: /go to next step/i }).click()
  await page.waitForTimeout(500)

  // Go to next step
  await page.getByRole('button', { name: /go to next step/i }).click()

  const readyButton = page.getByRole('button', { name: /Set Yourself as "Ready"|You're Ready!/i })
  const hasWizardReadyButton = await readyButton
    .first()
    .isVisible({ timeout: EXIST_TIMEOUT / 6 })
    .catch(() => false)

  if (hasWizardReadyButton) {
    if (await page.getByRole('button', { name: /Set Yourself as "Ready"/i }).isVisible().catch(() => false)) {
      await page.getByRole('button', { name: /Set Yourself as "Ready"/i }).click()
    }
    await page.getByRole('button', { name: /view consortium details/i }).click()
  } else {
    const activeToggle = page.getByRole('checkbox', { name: /^Active$/i })
    if (!(await activeToggle.isChecked())) {
      await activeToggle.click()
    }

    const readyToggle = page.getByRole('checkbox', { name: /^Ready$/i })
    if (!(await readyToggle.isChecked())) {
      await readyToggle.click()
    }
  }

  // Start run
  await page.getByRole('button', { name: /start run/i }).click()

  // Go to results page
  await goToRunResults(page)
  await expectRunResults(page)
}

export default {
  select: selectComputation,
  setDataForSRRFreesurfer,
  run: runComputation,
}
