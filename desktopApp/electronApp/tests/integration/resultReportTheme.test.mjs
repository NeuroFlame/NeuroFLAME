/* global window, document, localStorage */
import assert from 'node:assert/strict'
import { createServer } from 'node:http'
import { mkdtemp, rm, mkdir } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import test from 'node:test'
import { _electron as electron, expect } from '@playwright/test'
import { build } from 'esbuild'

const reportUrl = 'https://coinstac.org/run-results/synthetic/index.html'

test('embedded reports follow the app theme without reloading, changing artifacts or exposing the bridge',
  { timeout: 60000 }, async () => {
    const base = await mkdtemp(path.join(tmpdir(), 'nf-report-theme-'))
    const bundle = await build({
      stdin: {
        contents: `import React from 'react';
          import {createRoot} from 'react-dom/client';
          import {AppThemeProvider} from './src/theme/AppThemeProvider';
          import ResultReportViewer from './src/pages/RunResults/ResultReportViewer';
          import {useThemePreference} from './src/theme/AppThemeProvider';
          function Screen() { const {mode,setPreference}=useThemePreference();
            return <><button onClick={()=>setPreference(mode==='dark'?'light':'dark')}>Switch app theme</button>
              <ResultReportViewer src='${reportUrl}' /></>; }
          createRoot(document.getElementById('root')).render(<AppThemeProvider><Screen /></AppThemeProvider>);`,
        loader: 'tsx',
        resolveDir: fileURLToPath(new URL('../../../reactApp', import.meta.url)),
      },
      bundle: true,
      write: false,
      jsx: 'automatic',
      define: { 'process.env.NODE_ENV': '"production"' },
    })
    const server = createServer((request, response) => {
      response.setHeader('Content-Type', request.url === '/app.js' ? 'text/javascript' : 'text/html')
      response.end(request.url === '/app.js' ? bundle.outputFiles[0].text
        : '<!doctype html><div id=root></div><script src=/app.js></script>')
    })
    let instance
    try {
      await new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve) })
      instance = await electron.launch({
        args: [
          fileURLToPath(new URL('../fixtures/landingPageTheme.mjs', import.meta.url)),
        `--fixture-base=${base}`, `--fixture-url=http://127.0.0.1:${server.address().port}`,
        ],
        env: { ...process.env, NODE_ENV: 'test' },
      })
      const page = await instance.firstWindow()
      page.setDefaultTimeout(10000)
      const errors = []
      page.on('pageerror', (error) => errors.push(error.message))
      await page.evaluate(() => localStorage.setItem('neuroflame.theme', 'dark'))
      await page.reload()
      const report = page.frameLocator('iframe')
      await expect(report.locator('html')).toHaveAttribute('data-theme', 'dark')
      await expect(report.locator('#themeBtn')).toBeHidden()
      assert.equal(await report.locator('body').evaluate(() => typeof window.ElectronAPI), 'undefined')
      await report.getByRole('textbox', { name: 'Report filter' }).fill('Keep my filter')
      await report.getByRole('link', { name: 'Details', exact: true }).click()
      await report.locator('body').evaluate(() => localStorage.setItem('theme', 'dark'))
      for (const mode of ['light', 'dark', 'light']) {
        await page.getByRole('button', { name: 'Switch app theme' }).click()
        await expect(report.locator('html')).toHaveAttribute('data-theme', mode === 'dark' ? 'dark' : '')
        await expect(report.locator('#themeBtn')).toBeHidden()
        await expect(report.getByRole('textbox', { name: 'Report filter' })).toHaveValue('Keep my filter')
        // Report preference remains independent when downloaded or opened outside the app.
        assert.equal(await report.locator('body').evaluate(() => localStorage.getItem('theme')), 'dark')
        if (process.env.THEME_SCREENSHOT_DIR) {
          await mkdir(process.env.THEME_SCREENSHOT_DIR, { recursive: true })
          await page.screenshot({ path: path.join(process.env.THEME_SCREENSHOT_DIR, `report-${mode}.png`) })
        }
      }
      const frame = page.frames().find((frame) => frame.url().startsWith(reportUrl))
      // Reinitializing report scripts or reloading cannot override the app mode.
      await frame.evaluate(() => document.documentElement.setAttribute('data-theme', 'dark'))
      await expect(report.locator('html')).toHaveAttribute('data-theme', '')
      await frame.goto(reportUrl)
      await expect(report.locator('html')).toHaveAttribute('data-theme', '')
      await expect(report.locator('#themeBtn')).toBeHidden()
      await frame.goto('https://coinstac.org/report.html')
      await expect(report.locator('body')).toHaveCSS('background-color', 'rgb(255, 255, 255)')
      for (const url of ['https://example.com/run-results/index.html', 'https://coinstac.org/run-results-other/index.html',
        'https://coinstac.org/run-results/../private.html', 'https://coinstac.org/run-results/data.csv']) {
        await assert.rejects(page.evaluate(
          (url) => window.ElectronAPI.setResultReportTheme({ url, mode: 'dark' }), url,
        ))
      }
      await assert.rejects(page.evaluate(
        (url) => window.ElectronAPI.setResultReportTheme({ url, mode: 'system' }), reportUrl,
      ))
      assert.deepEqual(errors, [])
    } finally {
      if (instance) await instance.close()
      await new Promise((resolve) => server.close(resolve))
      await rm(base, { recursive: true, force: true })
    }
  })
