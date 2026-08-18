import { constants, promises as fs } from 'fs'
import path from 'path'
import { app, BrowserWindow, dialog } from 'electron'
import electronUpdater from 'electron-updater'
import { logger } from './logger.js'
import { autoUpdateEligibility } from './autoUpdatePolicy.js'

const { autoUpdater } = electronUpdater
const UPDATE_CHECK_INTERVAL_MS = 6 * 60 * 60 * 1000

let initializationPromise: Promise<void> | null = null
let installPromptShown = false

function logUpdateError(error: unknown): void {
  const message = error instanceof Error ? error.message : String(error)
  logger.error(`Automatic update error: ${message}`)
}

async function promptToInstall(
  parentWindow: BrowserWindow | null,
  version: string,
): Promise<void> {
  if (installPromptShown) return
  installPromptShown = true

  const options = {
    type: 'info' as const,
    title: 'NeuroFLAME update ready',
    message: `NeuroFLAME ${version} has been downloaded.`,
    detail: 'Restart NeuroFLAME now to install the update, or install it automatically when you next quit.',
    buttons: ['Restart now', 'Later'],
    defaultId: 0,
    cancelId: 1,
    noLink: true,
  }
  const result = parentWindow
    ? await dialog.showMessageBox(parentWindow, options)
    : await dialog.showMessageBox(options)

  if (result.response === 0) {
    autoUpdater.quitAndInstall()
  }
}

function registerUpdaterEvents(parentWindow: BrowserWindow | null): void {
  autoUpdater.on('checking-for-update', () => {
    logger.info('Checking for a NeuroFLAME update')
  })
  autoUpdater.on('update-available', (info) => {
    logger.info(`NeuroFLAME update ${info.version} is available`)
  })
  autoUpdater.on('update-not-available', () => {
    logger.info('NeuroFLAME is up to date')
  })
  autoUpdater.on('download-progress', (progress) => {
    logger.info(
      `Downloading NeuroFLAME update: ${progress.percent.toFixed(1)}%`,
    )
  })
  autoUpdater.on('update-downloaded', (info) => {
    logger.info(`NeuroFLAME update ${info.version} is ready to install`)
    promptToInstall(parentWindow, info.version).catch(logUpdateError)
  })
  autoUpdater.on('error', logUpdateError)
}

async function appImageIsWritable(appImagePath: string): Promise<boolean> {
  try {
    await Promise.all([
      fs.access(appImagePath, constants.W_OK),
      fs.access(path.dirname(appImagePath), constants.W_OK),
    ])
    return true
  } catch {
    logger.warn(
      `Automatic updates are disabled because the AppImage or its directory is not writable: ${appImagePath}`,
    )
    return false
  }
}

async function checkForUpdates(): Promise<void> {
  try {
    await autoUpdater.checkForUpdates()
  } catch (error) {
    logUpdateError(error)
  }
}

export function initializeAutoUpdates(
  parentWindow: BrowserWindow | null,
): Promise<void> {
  if (!initializationPromise) {
    initializationPromise = (async () => {
      const appImagePath = process.env.APPIMAGE
      const eligibility = autoUpdateEligibility(
        app.isPackaged,
        process.platform,
        appImagePath,
      )
      if (!eligibility.enabled) {
        logger.info(
          `Automatic updates are disabled for this launch: ${eligibility.reason}`,
        )
        return
      }

      if (
        process.platform === 'linux' &&
        appImagePath &&
        !(await appImageIsWritable(appImagePath))
      ) {
        return
      }

      autoUpdater.autoDownload = true
      autoUpdater.autoInstallOnAppQuit = true
      registerUpdaterEvents(parentWindow)

      checkForUpdates().catch(logUpdateError)
      const timer = setInterval(
        () => {
          checkForUpdates().catch(logUpdateError)
        },
        UPDATE_CHECK_INTERVAL_MS,
      )
      timer.unref()
    })()
  }

  return initializationPromise
}
