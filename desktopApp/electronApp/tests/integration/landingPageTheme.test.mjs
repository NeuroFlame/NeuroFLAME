/* global window, document, getComputedStyle */
import assert from 'node:assert/strict'
import { createServer } from 'node:http'
import { mkdtemp, rm, mkdir } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import test from 'node:test'
import { _electron as electron, expect } from '@playwright/test'

const theme = {
  mode: 'dark',
  page: '#0b1428',
  surface: '#13213b',
  text: '#e6ebf4',
  muted: '#a9b7ce',
  border: '#354866',
  primary: '#528fff',
  error: '#ff626d',
  warning: '#f5ae36',
}

test('Electron themes only the cross-origin home iframe and restores its original light styles',
  { timeout: 60000 }, async () => {
    const base = await mkdtemp(path.join(tmpdir(), 'nf-landing-theme-'))
    const server = createServer((_, response) => {
      response.setHeader('Content-Type', 'text/html')
      response.end(`<!doctype html><body style="margin:0">
        <iframe id="home" title="Home" src="https://coinstac.org/app-landing-page/" style="width:100%;height:700px;border:0"></iframe>
        <iframe id="report" title="Report" src="https://coinstac.org/report.html"></iframe>
      </body>`)
    })
    let instance
    try {
      await new Promise((resolve, reject) => {
        server.once('error', reject)
        server.listen(0, '127.0.0.1', resolve)
      })
      instance = await electron.launch({
        args: [
          fileURLToPath(new URL('../fixtures/landingPageTheme.mjs', import.meta.url)),
          `--fixture-base=${base}`, `--fixture-url=http://127.0.0.1:${server.address().port}`,
        ],
        env: { ...process.env, NODE_ENV: 'test' },
      })
      const page = await instance.firstWindow()
      page.setDefaultTimeout(10000)
      const home = page.frameLocator('#home')
      const report = page.frameLocator('#report')
      await expect(home.getByText('Global Collaborators', { exact: true })).toBeVisible()
      assert.equal(await page.evaluate(() => {
        try {
          return !document.querySelector('#home').contentWindow.document.body
        } catch { return true }
      }), true, 'fixture must exercise the cross-origin boundary')
      assert.equal(await home.locator('body').evaluate(() => typeof window.ElectronAPI), 'undefined')
      const originalBackground = await home.locator('body').evaluate((el) => getComputedStyle(el).backgroundColor)
      const originalContent = await home.locator('.fl-builder-content, body').last().innerText()
      await page.evaluate((value) => window.ElectronAPI.setLandingPageTheme(value), theme)
      await expect(home.locator('body')).toHaveCSS('background-color', 'rgb(11, 20, 40)')
      await expect(home.locator('.fl-col-content').first()).toHaveCSS('background-color', 'rgb(19, 33, 59)')
      await expect(home.getByText('Global Collaborators', { exact: true })).toHaveCSS('color', 'rgb(230, 235, 244)')
      await expect(report.locator('body')).toHaveCSS('background-color', 'rgb(255, 255, 255)')
      assert.equal(await home.locator('.fl-builder-content, body').last().innerText(), originalContent)

      const screenshots = process.env.THEME_SCREENSHOT_DIR
      if (screenshots) {
        await mkdir(screenshots, { recursive: true })
        await page.locator('#home').screenshot({ path: path.join(screenshots, 'hosted-home-dark.png') })
      }
      // The current palette also applies after iframe reload and recreation.
      const child = page.frames().find((frame) => frame.url() === 'https://coinstac.org/app-landing-page/')
      await child.goto('https://coinstac.org/app-landing-page/')
      await expect(home.locator('body')).toHaveCSS('background-color', 'rgb(11, 20, 40)')
      await page.evaluate(() => {
        const frame = document.querySelector('#home')
        frame.replaceWith(frame.cloneNode())
      })
      await expect(home.locator('body')).toHaveCSS('background-color', 'rgb(11, 20, 40)')
      // Repeated toggles must reuse one stylesheet and fully restore light mode.
      for (let i = 0; i < 3; i++) {
        await page.evaluate((value) => window.ElectronAPI.setLandingPageTheme(value), { ...theme, mode: 'light' })
        await expect(home.locator('#neuroflame-landing-theme')).toHaveCount(0)
        await expect(home.locator('body')).toHaveCSS('background-color', originalBackground)
        await page.evaluate((value) => window.ElectronAPI.setLandingPageTheme(value), theme)
        await expect(home.locator('#neuroflame-landing-theme')).toHaveCount(1)
      }
      await page.evaluate((value) => window.ElectronAPI.setLandingPageTheme(value), { ...theme, mode: 'light' })
      if (screenshots) {
        await page.locator('#home').screenshot({ path: path.join(screenshots, 'hosted-home-light.png') })
      }
      for (const invalid of [null, { ...theme, mode: 'system' }, { ...theme, text: '#fff; color:red' }]) {
        await assert.rejects(page.evaluate((value) => window.ElectronAPI.setLandingPageTheme(value), invalid),
          /Invalid landing page theme/)
      }
      // Even the right host/path with an extra query is outside the allowlist.
      const reloaded = page.frames().find((frame) => frame.url() === 'https://coinstac.org/app-landing-page/')
      await reloaded.goto('https://coinstac.org/app-landing-page/?report=1')
      await page.evaluate((value) => window.ElectronAPI.setLandingPageTheme(value), theme)
      await expect(home.locator('#neuroflame-landing-theme')).toHaveCount(0)
      await expect(report.locator('body')).toHaveCSS('background-color', 'rgb(255, 255, 255)')
      // A navigated top-level page cannot invoke the bridge as the app renderer.
      await page.goto(`http://localhost:${server.address().port}/`)
      await assert.rejects(page.evaluate((value) => window.ElectronAPI.setLandingPageTheme(value), theme),
        /Theme changes must originate from the app renderer/)
    } finally {
      if (instance) await instance.close()
      await new Promise((resolve) => server.close(resolve))
      await rm(base, { recursive: true, force: true })
    }
  })
