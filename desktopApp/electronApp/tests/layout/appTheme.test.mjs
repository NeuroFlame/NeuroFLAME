/* global getComputedStyle, localStorage, window */
import assert from 'node:assert/strict'
import { createServer } from 'node:http'
import { mkdtemp, rm, mkdir } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'
import { chromium, expect } from '@playwright/test'
import { build } from 'esbuild'

const rendererRoot = fileURLToPath(new URL('../../../reactApp', import.meta.url))

// Real shell, providers, navigation, login, lists, editor, errors and viewers.
// Only API responses and the route composition use synthetic fixture data.
async function fixture() {
  const bundle = await build({
    stdin: {
      contents: `
        import React from 'react';
        import '@fontsource/lato/400.css';
        import '@fontsource/lato/700.css';
        import '@fontsource/inter/400.css';
        import '@fontsource/inter/700.css';
        import { createRoot } from 'react-dom/client';
        import { HashRouter } from 'react-router-dom';
        import App from './src/App';
        import { UserStateProvider } from './src/contexts/UserStateContext';
        createRoot(document.getElementById('root')).render(
          <UserStateProvider><HashRouter><App /></HashRouter></UserStateProvider>
        );`,
      loader: 'tsx',
      resolveDir: rendererRoot,
    },
    bundle: true,
    write: false,
    outfile: 'theme.js',
    jsx: 'automatic',
    loader: { '.png': 'dataurl', '.svg': 'dataurl', '.woff': 'dataurl', '.woff2': 'dataurl' },
    define: { 'process.env.NODE_ENV': '"production"' },
    plugins: [{
      name: 'synthetic-theme-data',
      setup(builder) {
        builder.onResolve({ filter: /\/AppRoutes$|\/centralApi\/centralApi$|\/edgeApi\/edgeApi$/ },
          ({ path: importPath }) => ({ path: importPath, namespace: 'fixture' }))
        builder.onLoad({ filter: /.*/, namespace: 'fixture' }, ({ path: importPath }) => ({
          loader: 'tsx',
          resolveDir: rendererRoot,
          contents: importPath.endsWith('/AppRoutes') ? `
            import { useState } from 'react';
            import { Routes, Route, useNavigate } from 'react-router-dom';
            import ConsortiumDetails from './src/pages/ConsortiumDetails/ConsortiumDetailsPage';
            import { useUserState } from './src/contexts/UserStateContext';
            import { Box, Button, Dialog, DialogTitle, DialogContent, TextField, Select, MenuItem } from '@mui/material';
            import LoginPage from './src/pages/LoginPage/LoginPage';
            import ComputationListItem from './src/pages/ComputationList/ComputationListItem';
            import ConsortiumListItem from './src/pages/ConsortiumList/ConsortiumListItem';
            import { RunListItem } from './src/pages/RunList/RunListItem';
            import Notes from './src/pages/ConsortiumDetails/ConsortiumLeaderNotes/ConsortiumLeaderNotesEdit';
            import StatusTable from './src/pages/HealthPage/StatusTable';
            import { RunErrorCard } from './src/pages/RunDetails/RunErrorCard';
            import CSVViewer from './src/pages/RunResults/CSVViewer';
            import TextViewer from './src/pages/RunResults/TextViewer';
            import NiiVueViewer from './src/pages/RunResults/NiiVueViewer';
            import FileTree from './src/pages/RunResults/FileTree';
            export default function Pages() {
              const { username, setUserData } = useUserState();
              const navigate = useNavigate();
              const [screen, setScreen] = useState('lists');
              const [dialog, setDialog] = useState(false);
              if (!username) return <LoginPage />;
              return <main style={{padding: 24}}>
                <nav>{['lists', 'editor', 'health', 'results', 'volume', 'public-study'].map(name =>
                  <Button key={name} onClick={() => {
                    setScreen(name);
                    setUserData({accessToken:'synthetic',userId:'demo',username:'researcher',roles:[name==='public-study'?'user':'admin']});
                    if(name==='public-study') navigate('/consortium/details/public');
                  }}>{name}</Button>)}</nav>
                <h1>{screen === 'lists' ? 'Research workspace' : screen}</h1>
                {screen === 'lists' && <>
                  <ComputationListItem computation={{id:'demo', title:'Federated neuroimaging'}} />
                  <ConsortiumListItem consortium={{id:'demo',title:'Synthetic consortium',description:'Distributed research study',leader:{id:'demo',username:'researcher'},members:[{id:'demo'}]}} onReload={() => {}} />
                  <RunListItem run={{runId:'demo',consortiumTitle:'Synthetic run',status:'completed',createdAt:'1700000000000'}} isStarred={false} onToggleStar={() => {}} />
                  <Button onClick={() => setDialog(true)}>Open settings dialog</Button>
                  <Dialog open={dialog} onClose={() => setDialog(false)}>
                    <DialogTitle>Study settings</DialogTitle><DialogContent>
                      <TextField label='Study title' defaultValue='Synthetic study' margin='normal' />
                      <Select aria-label='Processing mode' value='standard'><MenuItem value='standard'>Standard</MenuItem></Select>
                      <Button onClick={() => setDialog(false)}>Close dialog</Button>
                    </DialogContent>
                  </Dialog>
                </>}
                {screen === 'public-study' && <Routes>
                  <Route path='/consortium/details/:consortiumId' element={<ConsortiumDetails />} />
                </Routes>}
                {screen === 'editor' && <Box sx={{bgcolor:'background.paper',p:2}}>
                  <Notes consortiumLeaderNotes={'# Study notes\\n\\nReadable **research** notes.\\n\\n- First step\\n- Second step'} onSave={() => {}} onCancel={() => {}} />
                </Box>}
                {screen === 'health' && <>
                  <StatusTable dockerStatus={{cli:{state:'ok',target:'Synthetic CLI',details:'Available'},daemon:{state:'checking',target:'Synthetic socket'}}} results={[{kind:'http',name:'Central API',target:'Synthetic endpoint',ok:false,details:'Offline'}]} />
                  <RunErrorCard source='Synthetic site' message={'Computation failed.\\nLocal synthetic diagnostic'} />
                </>}
                {screen === 'volume' && <NiiVueViewer fileUrl='' />}
                {screen === 'results' && <>
                  <FileTree fileList={[{name:'summary.csv',url:'summary.csv',displayUrl:'summary.csv',size:20,lastModified:'2026-01-01',isDirectory:false}]} setFrameSrc={() => {}} setCurrentFile={() => {}} edgeClientRunResultsUrl='' />
                  <TextViewer fileUrl='/sample.txt' />
                  <div data-testid='csv' style={{maxHeight:200,overflow:'auto'}}><CSVViewer fileUrl='/sample.csv' /></div>
                  <iframe title='Independent report' src='/report.html' style={{background:'white',colorScheme:'normal'}} />
                </>}
              </main>;
            }` : importPath.endsWith('/centralApi') ? `
            export const useCentralApi = () => ({
              login: async () => ({accessToken:'synthetic',userId:'demo',username:'researcher',roles:['admin']}),
              consortiumJoin: async () => {}, consortiumLeave: async () => {},
              subscriptions: {consortiumDetailsChanged: () => ({subscribe: () => ({unsubscribe() {}})})},
              getConsortiumDetails: async () => ({id:'public',title:'Public study overview',description:'Public study description',
                leader:{id:'public-leader',username:'Consortium leader'},isPrivate:false,
                members:[],activeMembers:[],readyMembers:[],vaultMembers:[],activeVaultMembers:[],readyVaultMembers:[],
                studyConfiguration:{consortiumLeaderNotes:null,computationParameters:'',computation:null}})
            });` : 'export const useEdgeApi = () => ({connectAsUser: async () => {}});',
        }))
      },
    }],
  })
  const server = createServer((request, response) => {
    if (request.url === '/theme.js' || request.url === '/theme.css') {
      const ext = path.extname(request.url)
      response.setHeader('Content-Type', ext === '.js' ? 'text/javascript' : 'text/css')
      response.end(bundle.outputFiles.find(({ path: filename }) => filename.endsWith(ext)).text)
    } else if (request.url === '/sample.csv') {
      response.end('Measure,Value\nSynthetic result,42\n')
    } else if (request.url === '/sample.txt') {
      response.end('Synthetic text result: readable in both modes.')
    } else if (request.url === '/report.html') {
      response.setHeader('Content-Type', 'text/html')
      response.end(
        '<body style="background:white;color:black"><button onclick="document.body.style.background=\'navy\';' +
        'document.body.style.color=\'white\'">Report theme</button>Independent computation report</body>',
      )
    } else {
      response.setHeader('Content-Type', 'text/html')
      response.end(
        '<!doctype html><html><link rel="stylesheet" href="/theme.css"><div id="root"></div>' +
        '<script>window.ElectronAPI={}</script><script src="/theme.js"></script></html>',
      )
    }
  })
  await new Promise((resolve, reject) => {
    server.once('error', reject)
    server.listen(0, '127.0.0.1', resolve)
  })
  return { server, url: `http://127.0.0.1:${server.address().port}` }
}

async function login(page) {
  await page.getByPlaceholder('Username or Email').fill('researcher')
  await page.getByPlaceholder('Password', { exact: true }).fill('synthetic-password')
  await page.getByRole('button', { name: 'Log In', exact: true }).click()
  await expect(page.getByTestId('menu-icon')).toBeVisible()
}

const mode = (page, value) => expect(page.locator('html')).toHaveCSS('color-scheme', value)

// Browser integration verifies rendered colors instead of snapshotting implementation.
async function readable(locator, backgroundLocator = locator) {
  const foreground = await locator.evaluate((el) => getComputedStyle(el).color)
  const background = await backgroundLocator.evaluate((el) => getComputedStyle(el).backgroundColor)
  const luminance = (rgb) => {
    const values = rgb.match(/[\d.]+/g).slice(0, 3).map(Number).map((v) => {
      v /= 255
      return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4
    })
    return values[0] * 0.2126 + values[1] * 0.7152 + values[2] * 0.0722
  }
  assert.ok(!background.includes('rgba'), `Expected opaque background, got ${background}`)
  const a = luminance(foreground)
  const b = luminance(background)
  const ratio = (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05)
  assert.ok(ratio >= 4.5, `${foreground} on ${background} has contrast ${ratio.toFixed(2)}`)
}

test('app theme integrates with system settings, persistence, controls and representative UI', async () => {
  const { server, url } = await fixture()
  const profile = await mkdtemp(path.join(tmpdir(), 'neuroflame-theme-'))
  const screenshots = process.env.THEME_SCREENSHOT_DIR
  if (screenshots) await mkdir(screenshots, { recursive: true })
  let context
  const launch = () => chromium.launchPersistentContext(profile, {
    channel: process.env.WIZARD_TEST_BROWSER || 'chromium', colorScheme: 'dark', viewport: { width: 1280, height: 900 },
  })
  try {
    context = await launch()
    context.setDefaultTimeout(10000)
    let page = context.pages()[0]
    const pageErrors = []
    page.on('pageerror', (error) => pageErrors.push(error.message))
    await page.goto(url)
    assert.deepEqual(pageErrors, [], 'Application bootstrap errors')
    // First launch stays light even when the operating system is dark.
    await mode(page, 'light')
    await expect(page.getByRole('button', { name: 'Use system theme' })).toHaveAttribute('aria-pressed', 'false')
    await page.reload()
    await mode(page, 'light')
    await page.getByRole('button', { name: 'Use system theme' }).click()
    await mode(page, 'dark')
    await expect(page.getByRole('button', { name: 'Use system theme' })).toHaveAttribute('aria-pressed', 'true')
    await page.emulateMedia({ colorScheme: 'light' })
    await mode(page, 'light')
    if (screenshots) await page.screenshot({ animations: 'disabled', path: path.join(screenshots, 'login-light.png') })
    await page.emulateMedia({ colorScheme: 'dark' })
    await mode(page, 'dark')
    if (screenshots) await page.screenshot({ animations: 'disabled', path: path.join(screenshots, 'login-dark.png') })
    await login(page)

    for (const palette of ['light', 'dark']) {
      const toggle = page.getByRole('button', { name: 'Dark mode', exact: true })
      await toggle.focus()
      await page.keyboard.press('Enter')
      await mode(page, palette)
      await readable(page.locator('body'))
      await readable(page.getByTestId('run-list-item'))
      await page.getByTestId('menu-icon').click()
      await expect(page.getByTestId('admin-menu-item')).toBeVisible()
      await readable(page.getByText('Consortia', { exact: true }), page.locator('.MuiDrawer-paper'))
      if (screenshots) await page.screenshot({ animations: 'disabled', path: path.join(screenshots, `navigation-${palette}.png`) })
      await page.keyboard.press('Escape')
      await page.getByRole('button', { name: 'Open settings dialog' }).click()
      await expect(page.getByRole('dialog')).toBeVisible()
      await readable(page.getByRole('dialog'))
      if (screenshots) await page.screenshot({ animations: 'disabled', path: path.join(screenshots, `dialog-${palette}.png`) })
      await page.getByLabel('Study title').fill('Edited synthetic title')
      await page.getByRole('button', { name: 'Close dialog' }).click()
      for (const screen of ['editor', 'health', 'results', 'volume']) {
        await page.getByRole('button', { name: screen, exact: true }).click()
        if (screen === 'editor') {
          await expect(page.locator('.mdxeditor [contenteditable=true]')).toBeVisible()
          await readable(page.locator('.mdxeditor'))
          await page.locator('.mdxeditor [contenteditable=true]').press('End')
          await page.keyboard.type(' Additional note.')
          await page.getByRole('radio', { name: 'Source mode', exact: true }).click()
          await expect(page.locator('.cm-editor')).toBeVisible()
          await readable(page.locator('.cm-editor'))
          await readable(page.locator('.cm-line span').first(), page.locator('.cm-activeLine'))
          if (screenshots) {
            await page.screenshot({ animations: 'disabled', path: path.join(screenshots, `source-${palette}.png`) })
          }
          await page.getByRole('radio', { name: 'Rich text', exact: true }).click()
        }
        if (screen === 'results') {
          await expect(page.getByRole('cell', { name: 'Synthetic result', exact: true })).toBeVisible()
          await readable(page.locator('th').first())
          await readable(page.locator('pre').first())
          const report = page.frameLocator('iframe')
          await expect(report.locator('body')).toHaveCSS('background-color', 'rgb(255, 255, 255)')
          await report.getByRole('button', { name: 'Report theme' }).click()
          await page.getByRole('button', { name: 'Dark mode', exact: true }).click()
          await expect(report.locator('body')).toHaveCSS('background-color', 'rgb(0, 0, 128)')
          await page.getByRole('button', { name: 'Dark mode', exact: true }).click()
        }
        await page.evaluate(() => window.scrollTo(0, 0))
        if (screenshots) {
          await page.screenshot({
            animations: 'disabled', path: path.join(screenshots, `${screen}-${palette}.png`), fullPage: true,
          })
        }
      }
      await page.getByRole('button', { name: 'public-study', exact: true }).click()
      await expect(page.getByText('Public study overview', { exact: true })).toBeVisible()
      await expect(page.getByText('Public study description', { exact: true })).toBeVisible()
      await expect(page.getByRole('button', { name: 'Browse consortia', exact: true })).toBeVisible()
      await expect(page.getByRole('button', { name: 'Setup Wizard', exact: true })).toHaveCount(0)
      await expect(page.getByText('Consortium leader', { exact: true })).toHaveCount(0)
      if (screenshots) await page.screenshot({ path: path.join(screenshots, `public-study-${palette}.png`) })
      await page.getByRole('button', { name: 'lists', exact: true }).click()
      await page.setViewportSize({ width: 390, height: 844 })
      const header = page.locator('header')
      assert.ok(await header.evaluate((el) => el.scrollWidth <= el.clientWidth))
      await expect(page.getByRole('button', { name: 'Dark mode', exact: true })).toBeInViewport()
      if (screenshots) {
        await page.screenshot({ animations: 'disabled', path: path.join(screenshots, `mobile-${palette}.png`) })
      }
      await page.setViewportSize({ width: 1280, height: 900 })
      // An explicit preference remains authoritative after system changes and reload.
      await page.emulateMedia({ colorScheme: palette === 'dark' ? 'light' : 'dark' })
      await mode(page, palette)
      await page.reload()
      await mode(page, palette)
    }
    const secondWindow = await context.newPage()
    await secondWindow.goto(url)
    await mode(secondWindow, 'dark')
    await page.getByRole('button', { name: 'Dark mode', exact: true }).click()
    await mode(secondWindow, 'light')
    await page.getByRole('button', { name: 'Dark mode', exact: true }).click()
    await mode(secondWindow, 'dark')
    await secondWindow.close()
    await context.close()
    context = await launch()
    context.setDefaultTimeout(10000)
    page = context.pages()[0]
    await page.goto(url)
    await page.emulateMedia({ colorScheme: 'light' })
    await mode(page, 'dark') // Explicit dark survives an actual browser restart.
    await page.getByRole('button', { name: 'Use system theme' }).click()
    await mode(page, 'light')
    await page.emulateMedia({ colorScheme: 'dark' })
    await mode(page, 'dark')
    await page.reload()
    await mode(page, 'dark')
    assert.deepEqual(pageErrors, [])
    // Invalid or cleared preferences safely fall back to light mode.
    await page.evaluate(() => localStorage.setItem('neuroflame.theme', 'invalid'))
    await page.reload()
    await mode(page, 'light')
    await page.evaluate(() => localStorage.removeItem('neuroflame.theme'))
    await page.reload()
    await mode(page, 'light')
  } finally {
    if (context) await context.close()
    await new Promise((resolve) => server.close(resolve))
    await rm(profile, { recursive: true, force: true })
  }
})
