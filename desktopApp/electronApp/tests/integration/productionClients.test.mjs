import assert from 'node:assert/strict'
import { mkdtemp, readFile, rm, stat } from 'node:fs/promises'
import { createServer } from 'node:http'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import test from 'node:test'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import electronPath from 'electron'
import { _electron as electron } from '@playwright/test'

test('real Electron profiles isolate saved config and login storage across relaunch', { timeout: 60000 }, async () => {
  const base = await mkdtemp(path.join(os.tmpdir(), 'nf-production-clients-'))
  const server = createServer((_, response) => response.end('<title>Profile fixture</title>'))
  const apps = new Set()
  let url
  const launchArgs = (client) => [
    fileURLToPath(new URL('../fixtures/productionClient.mjs', import.meta.url)),
    `--production-client=${client}`, `--fixture-base=${base}`, `--fixture-url=${url}`,
  ]
  const launch = async (client) => {
    const instance = await electron.launch({
      args: launchArgs(client),
      env: { ...process.env, NODE_ENV: 'test' },
    })
    apps.add(instance)
    await instance.firstWindow()
    return instance
  }
  try {
    await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
    url = `http://127.0.0.1:${server.address().port}`
    const one = await launch(1)
    let two = await launch(2)
    const paths = await Promise.all([one, two].map((instance) => instance.evaluate(({ app }) => ({
      userData: app.getPath('userData'),
      sessionData: app.getPath('sessionData'),
      config: globalThis.fixtureConfig,
    }))))
    assert.notEqual(paths[0].userData, paths[1].userData)
    for (const [index, info] of paths.entries()) {
      assert.equal(info.userData, info.sessionData)
      assert.equal(info.config.edgeClientConfig.hostingPort, 3003 + index)
      for (const endpoint of [
        info.config.edgeClientQueryUrl, info.config.edgeClientSubscriptionUrl, info.config.edgeClientRunResultsUrl,
      ]) assert.equal(new URL(endpoint).port, String(3003 + index))
      assert.equal(info.config.centralServerQueryUrl, 'https://trendscenterdev.org/graphql')
      assert.equal(info.config.edgeClientConfig.httpUrl, info.config.centralServerQueryUrl)
      assert.equal(info.config.edgeClientConfig.wsUrl, info.config.centralServerSubscriptionUrl)
      assert.ok(info.config.edgeClientConfig.pathBaseDirectory.startsWith(info.userData + path.sep))
      assert.ok(info.config.logPath.startsWith(info.userData + path.sep))
      if (process.platform !== 'win32') assert.equal((await stat(info.userData)).mode & 0o777, 0o700)
    }
    const firstWindow = await one.firstWindow()
    let secondWindow = await two.firstWindow()
    await firstWindow.evaluate(() => globalThis.localStorage.setItem('username', 'synthetic-first-user'))
    assert.equal(await secondWindow.evaluate(() => globalThis.localStorage.getItem('username')), null)
    await secondWindow.evaluate(() => globalThis.localStorage.setItem('username', 'synthetic-second-user'))
    await two.evaluate(async () => {
      const config = { ...globalThis.fixtureConfig, startEdgeClientOnLaunch: false }
      await globalThis.fixtureSaveConfig(JSON.stringify(config))
    })
    await two.close()
    apps.delete(two)
    two = await launch(2)
    secondWindow = await two.firstWindow()
    assert.equal(
      await secondWindow.evaluate(() => globalThis.localStorage.getItem('username')), 'synthetic-second-user',
    )
    assert.equal(await firstWindow.evaluate(() => globalThis.localStorage.getItem('username')), 'synthetic-first-user')
    assert.equal(await two.evaluate(() => globalThis.fixtureConfig.startEdgeClientOnLaunch), false)
    const first = JSON.parse(await readFile(path.join(paths[0].userData, 'config.json'), 'utf8'))
    assert.equal(first.startEdgeClientOnLaunch, true)
    await promisify(execFile)(electronPath, launchArgs(1), { timeout: 10000 })
    assert.equal(await one.evaluate(({ app }) => app.hasSingleInstanceLock()), true)
  } finally {
    for (const instance of apps) await instance.close()
    await new Promise((resolve) => server.close(resolve))
    await rm(base, { recursive: true, force: true })
  }
})
