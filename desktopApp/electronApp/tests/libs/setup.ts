import {
  _electron as electron,
  ElectronApplication,
  Page,
} from '@playwright/test'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const appPath = path.resolve(__dirname, '../..')
const appPackage = JSON.parse(
  fs.readFileSync(path.join(appPath, 'package.json'), 'utf8'),
) as { version: string }

let instances: Array<{ app: ElectronApplication, appPage: Page }> = []

const configPathFor = (configName: string) =>
  path.resolve(__dirname, '../../../../configs', `${configName}.json`)

async function createInstance(appId: string | number, configName = 'electronApp1') {
  const instanceId = `test-${appId}`

  const configPath = configPathFor(configName)

  const app = await electron.launch({
    args: [
      appPath,
      `--config=${configPath}`,
      '--enable-logging',
      '--log-level=0',
    ],
    env: Object.assign({}, process.env, {
      TEST_INSTANCE: instanceId,
      NODE_ENV: 'test',
    }) as { [key: string]: string },
  })
  const appVersion = await app.evaluate(({ app }) => app.getVersion())
  if (appVersion !== appPackage.version) {
    await app.close()
    throw new Error(
      `Electron loaded version ${appVersion}; expected ${appPackage.version}`,
    )
  }
  const appPage = await app.firstWindow()

  appPage.on('console', (msg) => {
    if (msg.type() === 'error') {
      console.error(`INSTANCE ${appId} -> ${msg.text()}`)
    }
  })
  appPage.on('pageerror', (err) => {
    console.log(`******** Window Error Instance ${appId}: ${err.message}`)
  })

  return { app, appPage }
}

async function setup(instanceCount = 1, configName?: string) {
  const promises = Array(instanceCount).fill(0).map(() => {
    const appId = instances.length + 1
    return createInstance(appId, configName)
  })

  instances = await Promise.all(promises)

  if (instanceCount === 1) {
    return instances[0].appPage
  }

  return instances.map((instance) => instance.appPage)
}

async function destroyAllInstances() {
  const currentInstances = instances
  instances = []
  await Promise.all(currentInstances.map((instance) => instance.app.close()))
}

export { configPathFor, createInstance, destroyAllInstances, setup }
