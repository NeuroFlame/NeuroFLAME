import { BrowserWindow, session, app } from 'electron'
import path from 'path'
import url from 'url'

export async function createMainWindow(): Promise<BrowserWindow> {
  const __dirname = path.dirname(url.fileURLToPath(import.meta.url))

  // Window configuration
  const mainWindow = new BrowserWindow({
    width: 800,
    height: 600,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      session: session.fromPartition(Date.now().toString()),
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

  await mainWindow.loadURL(startUrl)
  return mainWindow
}
