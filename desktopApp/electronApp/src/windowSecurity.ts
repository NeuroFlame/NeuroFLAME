import { BrowserWindow, shell, type WebContents } from 'electron'
import { logger } from './logger.js'
import { decideWindowOpen, isAllowedNavigation } from './windowPolicy.js'

export interface WindowSecurityOptions {
  /** The app renderer URL, the only page allowed the preload bridge. */
  appUrl: string
  /** Whether this window shows the app (true) or results opened from it (false). */
  isAppWindow: boolean
  edgeResultsUrl: string
  onViewNifti: (url: string) => void
  openExternal?: (url: string) => Promise<void>
}

const openExternalWebUrl = (url: string) => shell.openExternal(url)

/** Results open in a separate window without the app preload, in the same session. */
function openResultsWindow(opener: WebContents, url: string, options: WindowSecurityOptions): void {
  const window = new BrowserWindow({
    width: 1000,
    height: 800,
    webPreferences: {
      session: opener.session,
      sandbox: true,
      contextIsolation: true,
      nodeIntegration: false,
    },
  })
  installWindowSecurity(window.webContents, { ...options, isAppWindow: false })
  window.loadURL(url).catch((error) => {
    logger.warn('Unable to open a results window', { error })
  })
}

export function installWindowSecurity(contents: WebContents, options: WindowSecurityOptions): void {
  const openExternal = options.openExternal ?? openExternalWebUrl

  const route = (url: string): void => {
    const decision = decideWindowOpen(url, options.edgeResultsUrl, options.appUrl)
    switch (decision.action) {
      case 'view-nifti':
        options.onViewNifti(decision.url)
        break
      case 'download':
        contents.downloadURL(decision.url)
        break
      case 'results-window':
        openResultsWindow(contents, decision.url, options)
        break
      case 'external':
        openExternal(decision.url).catch((error) => {
          logger.warn('Unable to open an external link', { error })
        })
        break
      default:
        logger.warn('Blocked a window or navigation request')
    }
  }

  contents.setWindowOpenHandler(({ url }) => {
    route(url)
    return { action: 'deny' }
  })

  contents.on('will-navigate', (event) => {
    if (isAllowedNavigation(event.url, {
      trustedUrl: options.isAppWindow ? options.appUrl : undefined,
      edgeResultsUrl: options.edgeResultsUrl,
    })) return
    event.preventDefault()
    route(event.url)
  })
}
