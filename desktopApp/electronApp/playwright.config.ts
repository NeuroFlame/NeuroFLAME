import { defineConfig, devices } from '@playwright/test'

/**
 * See https://playwright.dev/docs/test-configuration.
 */

process.env.NODE_ENV = 'test'

export default defineConfig({
  testDir: './tests',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: 'html',
  use: {
    ...devices['Desktop Chrome'],
    channel: 'chromium',
  },
  projects: [
    {
      name: 'runFilter',
      testMatch: '**/runFilter/**/*.test.ts',
    },
    {
      name: 'auth-registration',
      testMatch: '**/auth/registration.test.ts',
      dependencies: ['runFilter'],
    },
    {
      name: 'auth-reset-password',
      testMatch: '**/auth/reset-password.test.ts',
      dependencies: ['auth-registration'],
    },
    {
      name: 'computation',
      testMatch: '**/computation/**/*.test.ts',
      dependencies: ['auth-reset-password'],
    },
  ],
})
