import { _electron as electron, ElectronApplication, Page } from "@playwright/test"

let instances: Array<{app: ElectronApplication, appPage: Page}> = []

async function createInstance(appId: string | number) {
  const instanceId = `test-${appId}`
  const app = await electron.launch({
    args: ["build/main.js", instanceId],
    env: Object.assign({}, process.env, {
      TEST_INSTANCE: instanceId,
      NODE_ENV: 'test',
    }) as { [key: string]: string }
  })
  const appPage = await app.firstWindow()

  appPage.on('console', msg => console.log(`INSTANCE ${appId} -> ${msg.text()}`))
  appPage.on('pageerror', (err) => {
    console.log(`******** Window Error Instance ${appId}: ${err.message}`)
  })

  return { app, appPage }
}

async function setup(instanceCount = 1) {
  const promises = Array(instanceCount).fill(0).map(() => {
    const appId = instances.length + 1
    return createInstance(appId)
  })

  instances = await Promise.all(promises)

  if (instanceCount === 1) {
    return instances[0].appPage
  }

  return instances.map(instance => instance.appPage)
}

async function destroyAllInstances() {
  await Promise.all(instances.map(instance => instance.app.close()))
}

export { createInstance, destroyAllInstances, setup }
