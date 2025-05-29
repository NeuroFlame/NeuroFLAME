import { Page } from '@playwright/test'

const createConsortium = async ({ name, description }, page: Page) => {
  // Go to consortium create page
  await page.getByRole("button", { name: /create consortium/i}).click()

  // Enter consotium title and description
  await page.getByPlaceholder("Title").fill(name)
  await page.getByPlaceholder("Description").fill(description)

  await page.getByRole("button", { name: /create and use wizard/i}).click()
}

export default {
  create: createConsortium,
}
