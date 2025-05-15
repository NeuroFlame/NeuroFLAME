import { app, BrowserWindow, ipcMain, dialog } from 'electron'
import { start as startEdgeFederatedClient } from 'edge-federated-client'
import { logger, logToPath } from './logger.js'
import { createMainWindow } from './window.js'
import {
  getConfigPath,
  getConfig,
  applyDefaultConfig,
  openConfig,
  saveConfig,
} from './config.js'
import { useDirectoryDialog } from './dialogs.js'
import initializeConfig from './configManager.js'

let mainWindow: BrowserWindow | null = null

async function appOnReady(): Promise<void> {
  try {
    const config = await initializeConfig()
    logToPath(config.logPath as string)

    if (config.startEdgeClientOnLaunch) {
      startEdgeFederatedClient(config.edgeClientConfig)
    }
  } catch (error) {
    // Show non-blocking error to inform user but do not halt app
    showInitializationError(error as Error)
  }

  mainWindow = await createMainWindow()

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    const parsedUrl = new URL(url)
    const openInSelf = parsedUrl.searchParams.get('window') === 'self'

    if (openInSelf) {
      mainWindow?.loadURL(url) // load in current window
      return { action: 'deny' }
    }

    // Default: allow opening new window if you want
    return { action: 'allow' }
  })

  mainWindow.on('closed', () => {
    logger.info('Main window closed')
    mainWindow = null
  })
}

app.on('ready', appOnReady)
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
app.on('activate', () => {
  if (!mainWindow) appOnReady().catch((err) => showInitializationError(err))
})

// IPC handlers
ipcMain.handle('getConfigPath', () => getConfigPath())
ipcMain.handle('getConfig', getConfig)
ipcMain.handle('openConfig', openConfig)
ipcMain.handle(
  'saveConfig',
  async (_, configString) => await saveConfig(configString),
)
ipcMain.handle('applyDefaultConfig', applyDefaultConfig)

ipcMain.handle('useDirectoryDialog', (_, pathString) => {
  if (mainWindow) {
    return useDirectoryDialog({ mainWindow, pathString })
  }
  return {
    directoryPath: undefined,
    canceled: true,
    error: 'Main window is not available',
  }
})

ipcMain.handle('restartApp', () => {
  app.relaunch()
  app.exit(0)
})

function showInitializationError(error: Error) {
  const errorMessage = `
    The application encountered an error during startup and may not function as expected.
    
    Details:
    ${error.message}
    
    Technical Information for Troubleshooting:
    ${error.stack || 'No stack trace available'}
    
    Please contact support if the issue persists.
  `

  dialog.showErrorBox('Application Initialization Error', errorMessage.trim())
}
