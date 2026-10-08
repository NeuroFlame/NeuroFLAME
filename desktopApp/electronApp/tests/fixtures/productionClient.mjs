import { app, BrowserWindow } from 'electron'
import { configureProductionClient } from '../../build/productionClient.js'
import initializeConfig from '../../build/configManager.js'
import { saveConfig } from '../../build/config.js'

const base = process.argv.find((arg) => arg.startsWith('--fixture-base=')).slice('--fixture-base='.length)
app.setPath('userData', base)
app.setPath('sessionData', base)
configureProductionClient(app, process.argv.slice(1))
if (!app.requestSingleInstanceLock()) app.exit(0)
app.whenReady().then(async () => {
  globalThis.fixtureConfig = await initializeConfig()
  globalThis.fixtureSaveConfig = saveConfig
  const window = new BrowserWindow({ show: false })
  await window.loadURL(process.argv.find((arg) => arg.startsWith('--fixture-url=')).slice('--fixture-url='.length))
})
