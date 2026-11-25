import { BrowserWindow, session, app } from 'electron'
import path from 'path'
import url from 'url'
import { installLandingPageTheme } from './landingPageTheme.js'
import { installResultReportTheme } from './resultReportTheme.js'
import { getConfig } from './config.js'
import { logger } from './logger.js'
import { installWindowSecurity } from './windowSecurity.js'

export const MAIN_SESSION_PARTITION = 'persist:neuroflame-main'

/** The only page allowed to use the preload bridge. */
export function appStartUrl(): string {
  const productionPath = path.join(app.getAppPath(), '../app/build/index.html')
  const productionUrl = url.format({
    pathname: productionPath,
    protocol: 'file:',
    slashes: true,
  })
  const developmentUrl =
    process.env.NODE_ENV === 'test' && process.env.CI === 'true'
      ? 'http://react:3000'
      : 'http://localhost:3000'
  return app.isPackaged ? productionUrl : developmentUrl
}

export async function createMainWindow(): Promise<BrowserWindow> {
  const __dirname = path.dirname(url.fileURLToPath(import.meta.url))
  const persistentSession = session.fromPartition(MAIN_SESSION_PARTITION)

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

  const startUrl = appStartUrl()
  const { edgeClientRunResultsUrl } = await getConfig()
  installWindowSecurity(mainWindow.webContents, {
    appUrl: startUrl,
    isAppWindow: true,
    edgeResultsUrl: edgeClientRunResultsUrl,
    onViewNifti: (niftiUrl) => {
      if (mainWindow.isDestroyed()) return
      mainWindow.webContents.executeJavaScript(
        `window.dispatchEvent(new MessageEvent('message', { data: { type: 'view-nifti', url: ${JSON.stringify(niftiUrl)} } }))`,
      ).catch(() => {
        logger.warn('Unable to open the NIfTI viewer.')
      })
    },
  })

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
