import assert from 'node:assert/strict'
import { createServer } from 'node:http'
import test from 'node:test'
import { fileURLToPath } from 'node:url'
import { chromium, expect } from '@playwright/test'
import { build } from 'esbuild'

const rendererRoot = fileURLToPath(new URL('../../../reactApp', import.meta.url))

test('the app header and user roles survive refreshes without persisting a session login', async () => {
  // The real App, Header, drawer and user-state provider run on a fresh test
  // origin. Only page content/login responses are synthetic; no user profile,
  // API, local datasets or real credentials are read.
  const bundle = await build({
    stdin: {
      contents: `
        import React from 'react';
        import { createRoot } from 'react-dom/client';
        import { HashRouter } from 'react-router-dom';
        import App from './src/App';
        import { UserStateProvider } from './src/contexts/UserStateContext';
        createRoot(document.getElementById('root')).render(
          <UserStateProvider><HashRouter><App /></HashRouter></UserStateProvider>
        );
      `,
      loader: 'tsx',
      resolveDir: rendererRoot,
    },
    bundle: true,
    write: false,
    outfile: 'session-fixture.js',
    jsx: 'automatic',
    loader: { '.png': 'dataurl' },
    define: { 'process.env.NODE_ENV': '"production"' },
    plugins: [{
      name: 'synthetic-login-page',
      setup(builder) {
        builder.onResolve({ filter: /\/AppRoutes$/ }, () => ({ path: 'pages', namespace: 'fixture' }))
        builder.onLoad({ filter: /.*/, namespace: 'fixture' }, () => ({
          contents: `
            import { useUserState } from './src/contexts/UserStateContext';
            export default function Pages() {
              const { userId, roles, isInitialized, setUserData } = useUserState();
              const login = (keepLoggedIn) => setUserData({
                accessToken: 'synthetic-token', userId: 'synthetic-user', username: 'researcher', roles: ['admin']
              }, { keepLoggedIn });
              return <main>
                <button onClick={() => login(false)}>Synthetic session login</button>
                <button onClick={() => login(true)}>Synthetic remembered login</button>
                <span data-testid='identity'>{isInitialized ? userId + ':' + roles.join(',') : 'initializing'}</span>
              </main>;
            }
          `,
          loader: 'tsx',
          resolveDir: rendererRoot,
        }))
      },
    }],
  })
  const script = bundle.outputFiles.find(({ path }) => path.endsWith('.js')).text
  const css = bundle.outputFiles.find(({ path }) => path.endsWith('.css')).text
  const server = createServer((request, response) => {
    if (request.url === '/fixture.js') {
      response.setHeader('Content-Type', 'text/javascript')
      response.end(script)
    } else if (request.url === '/fixture.css') {
      response.setHeader('Content-Type', 'text/css')
      response.end(css)
    } else {
      response.setHeader('Content-Type', 'text/html')
      response.end(
        '<link rel="stylesheet" href="/fixture.css"><div id="root"></div>' +
        '<script src="/fixture.js"></script>',
      )
    }
  })
  let browser
  try {
    await new Promise((resolve, reject) => {
      server.once('error', reject)
      server.listen(0, '127.0.0.1', resolve)
    })
    const url = `http://127.0.0.1:${server.address().port}/#/consortium/list`
    browser = await chromium.launch({ channel: process.env.WIZARD_TEST_BROWSER || 'chromium' })
    const context = await browser.newContext()
    let page = await context.newPage()
    await page.goto(url)
    await expect(page.getByTestId('identity')).toHaveText(':')
    await expect(page.getByTestId('menu-icon')).toHaveCount(0)
    await page.getByRole('button', { name: 'Synthetic session login', exact: true }).click()
    for (let reload = 0; reload < 3; reload++) {
      await expect(page.getByTestId('menu-icon')).toBeVisible()
      await expect(page.getByTestId('identity')).toHaveText('synthetic-user:admin')
      await page.reload()
    }
    await expect(page.getByTestId('menu-icon')).toBeVisible()
    await page.getByTestId('menu-icon').click()
    await expect(page.getByTestId('admin-menu-item')).toBeVisible()
    await page.getByText('Logout', { exact: true }).click()
    await page.reload()
    await expect(page.getByTestId('menu-icon')).toHaveCount(0)

    // Closing a tab ends its session; remembered login survives a new tab.
    await page.getByRole('button', { name: 'Synthetic session login', exact: true }).click()
    await expect(page.getByTestId('menu-icon')).toBeVisible()
    await page.close()
    page = await context.newPage()
    await page.goto(url)
    await expect(page.getByTestId('identity')).toHaveText(':')
    await expect(page.getByTestId('menu-icon')).toHaveCount(0)
    await page.getByRole('button', { name: 'Synthetic remembered login', exact: true }).click()
    await expect(page.getByTestId('menu-icon')).toBeVisible()
    await page.close()
    page = await context.newPage()
    await page.goto(url)
    await expect(page.getByTestId('menu-icon')).toBeVisible()
    await expect(page.getByTestId('identity')).toHaveText('synthetic-user:admin')
    await page.getByTestId('menu-icon').click()
    await page.getByText('Logout', { exact: true }).click()
    await page.close()
    page = await context.newPage()
    await page.goto(url)
    await expect(page.getByTestId('identity')).toHaveText(':')
    assert.equal(await page.getByTestId('menu-icon').count(), 0)
  } finally {
    if (browser) await browser.close()
    await new Promise((resolve) => server.close(resolve))
  }
})
