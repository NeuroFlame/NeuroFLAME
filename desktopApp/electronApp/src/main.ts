// main.ts
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
import { spawn, ChildProcessWithoutNullStreams } from 'child_process'
import os from 'os'

let mainWindow: BrowserWindow | null = null
let terminalProcess: TerminalProcess | null = null

// ---- Helpers: shell + env normalization ------------------------------------

function resolveShellAndArgs(): { shell: string; args: string[] } {
  const platform = process.platform
  if (platform === 'win32') {
    // Prefer PowerShell for a nicer interactive experience; keep the session open
    return {
      shell: 'powershell.exe',
      args: ['-NoLogo', '-NoProfile', '-ExecutionPolicy', 'Bypass', '-NoExit'],
    }
    // If you prefer classic cmd:
    // return { shell: 'cmd.exe', args: ['/K'] }
  }
  if (platform === 'darwin') {
    // Use login shell so PATH/profile gets loaded when launched from Finder
    return { shell: '/bin/zsh', args: ['-l'] }
  }
  // Linux
  return { shell: process.env.SHELL || '/bin/bash', args: ['-l'] }
}

function mergedPath(): string {
  const platform = process.platform
  const current = process.env.PATH || ''
  if (platform === 'win32') {
    const extras = [
      'C:\\Windows\\System32',
      'C:\\Windows',
      'C:\\Windows\\System32\\WindowsPowerShell\\v1.0',
      'C:\\Program Files\\Git\\bin', // optional
    ]
    return Array.from(new Set((current ? current.split(';') : []).concat(extras))).join(';')
  }
  if (platform === 'darwin') {
    const extras = ['/usr/local/bin', '/opt/homebrew/bin', '/usr/bin', '/bin', '/usr/sbin', '/sbin']
    return Array.from(new Set(extras.concat(current.split(':').filter(Boolean)))).join(':')
  }
  // linux
  const extras = ['/usr/local/sbin', '/usr/local/bin', '/usr/sbin', '/usr/bin', '/sbin', '/bin']
  return Array.from(new Set(extras.concat(current.split(':').filter(Boolean)))).join(':')
}

function baseEnv(): { env: NodeJS.ProcessEnv; home: string } {
  const home = app.getPath('home') || os.homedir() || (process.platform === 'win32' ? 'C:\\' : '/')
  const env: NodeJS.ProcessEnv = {
    ...process.env,
    HOME: home,
    USERPROFILE: home,
    PATH: mergedPath(),
  }
  if (process.platform !== 'win32') {
    env.LANG = env.LANG || 'en_US.UTF-8'
    env.LC_ALL = env.LC_ALL || 'en_US.UTF-8'
    env.TERM = env.TERM || 'xterm-256color'
  }
  return { env, home }
}

// ---- Minimal, robust spawn-based terminal -----------------------------------

class TerminalProcess {
  public process: ChildProcessWithoutNullStreams

  constructor(shell: string, args: string[], cwd: string, env: NodeJS.ProcessEnv) {
    this.process = spawn(shell, args, {
      cwd,
      env,
      stdio: ['pipe', 'pipe', 'pipe'],
      windowsHide: process.platform === 'win32',
      // Note: not using detached/unref so the child dies with the app.
    })
  }

  send(input: string) {
    if (this.process.stdin.writable) this.process.stdin.write(input)
  }

  isRunning() {
    return this.process.exitCode === null && !this.process.killed
  }

  kill(signal: NodeJS.Signals = 'SIGTERM') {
    try {
      this.process.kill(signal)
    } catch {
      /* noop */
    }
  }
}

// ---- App bootstrap ----------------------------------------------------------

async function appOnReady(): Promise<void> {
  try {
    const config = await initializeConfig()
    logToPath(config.logPath as string)
    if (config.startEdgeClientOnLaunch) {
      startEdgeFederatedClient(config.edgeClientConfig)
    }
  } catch (error) {
    showInitializationError(error as Error)
  }

  mainWindow = await createMainWindow()

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    const parsedUrl = new URL(url)
    const openInSelf = parsedUrl.searchParams.get('window') === 'self'
    if (openInSelf) {
      mainWindow?.loadURL(url)
      return { action: 'deny' }
    }
    return { action: 'allow' }
  })

  // ---- Terminal IPC (drop-in replacement) ----------------------------------

  ipcMain.handle('spawnTerminal', () => {
    // Clean up any previous instance
    if (terminalProcess && terminalProcess.isRunning()) {
      terminalProcess.kill()
    }

    const { shell, args } = resolveShellAndArgs()
    const { env, home } = baseEnv()

    terminalProcess = new TerminalProcess(shell, args, home, env)

    // Wire process events once (don’t add listeners on every keystroke)
    terminalProcess.process.stdout.on('data', (chunk: Buffer) => {
      mainWindow?.webContents.send('terminalOutput', chunk.toString())
    })

    terminalProcess.process.stderr.on('data', (chunk: Buffer) => {
      mainWindow?.webContents.send('terminalOutput', chunk.toString())
    })

    terminalProcess.process.on('error', (err: Error) => {
      mainWindow?.webContents.send('terminalOutput', `Spawn error: ${err.message}`)
    })

    terminalProcess.process.on('exit', (code: number | null, signal: NodeJS.Signals | null) => {
      mainWindow?.webContents.send(
        'terminalOutput',
        `\n[terminal exited: code=${code ?? 'null'} signal=${signal ?? 'null'}]`
      )
    })

    return { status: 'terminalStarted', pid: terminalProcess.process.pid }
  })

  ipcMain.on('terminalInput', (_event, input: string) => {
    if (!terminalProcess || !terminalProcess.isRunning()) return
    // Append newline unless you intend to send raw control sequences
    terminalProcess.send(input.endsWith('\n') ? input : input + '\n')
  })

  mainWindow.on('closed', () => {
    logger.info('Main window closed')
    mainWindow = null
  })
}

app.on('ready', appOnReady)
app.on('before-quit', () => {
  if (terminalProcess && terminalProcess.isRunning()) terminalProcess.kill()
})
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
app.on('activate', () => {
  if (!mainWindow) appOnReady().catch((err) => showInitializationError(err))
})

// ---- Misc IPC ---------------------------------------------------------------

ipcMain.handle('getConfigPath', () => getConfigPath())
ipcMain.handle('getConfig', getConfig)
ipcMain.handle('openConfig', openConfig)
ipcMain.handle('saveConfig', async (_e, configString) => await saveConfig(configString))
ipcMain.handle('applyDefaultConfig', applyDefaultConfig)

ipcMain.handle('useDirectoryDialog', (_e, pathString) => {
  if (mainWindow) return useDirectoryDialog({ mainWindow, pathString })
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

// ---- Error dialog -----------------------------------------------------------

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