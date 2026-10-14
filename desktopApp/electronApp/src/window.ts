import { BrowserWindow, session, app } from 'electron'
import path from 'path'
import url from 'url'
import { installLandingPageTheme } from './landingPageTheme.js'
import { installResultReportTheme } from './resultReportTheme.js'
import { getConfig } from './config.js'
import { logger } from './logger.js'

export async function createMainWindow(): Promise<BrowserWindow> {
  const __dirname = path.dirname(url.fileURLToPath(import.meta.url))
  const persistentSession = session.fromPartition('persist:neuroflame-main')

  // Window configuration
  const mainWindow = new BrowserWindow({
    width: 800,
    height: 600,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      session: persistentSession,
    },
  })

  // Define URLs for production and development
  const appPath = app.getAppPath()
  const productionPath = path.join(appPath, '../app/build/index.html')
  const productionUrl = url.format({
    pathname: productionPath,
    protocol: 'file:',
    slashes: true,
  })
  const developmentUrl =
    process.env.NODE_ENV === 'test' && process.env.CI === 'true'
      ? 'http://react:3000'
      : 'http://localhost:3000'

  // Choose the appropriate start URL
  const startUrl = app.isPackaged ? productionUrl : developmentUrl

  installLandingPageTheme(mainWindow.webContents, startUrl, () => {
    logger.warn('Unable to apply the home iframe theme.')
  })
  installResultReportTheme(
    mainWindow.webContents, startUrl, async () => (await getConfig()).edgeClientRunResultsUrl,
    () => { logger.warn('Unable to synchronize the result report theme.') },
  )
  await mainWindow.loadURL(startUrl)
  return mainWindow
}
