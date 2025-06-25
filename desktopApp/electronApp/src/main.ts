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
import { spawn, ChildProcess } from 'child_process'
import { EventEmitter } from 'events'

let mainWindow: BrowserWindow | null = null
let terminalProcess: TerminalProcess | null = null

class TerminalProcess extends EventEmitter {
  process: ChildProcess;

  constructor(shell: string, options: { cwd: string, env: NodeJS.ProcessEnv }) {
    super();

    // Spawn the child process, with 'detached: true' to allow it to run independently
    this.process = spawn(shell, [], {
      cwd: options.cwd,
      env: options.env,
      detached: true,
      stdio: ['pipe', 'pipe', 'pipe'] // to allow interaction with stdin, stdout, stderr
    });

    this.process.unref(); // Unreference the child process so the parent can exit independently

    // Event listeners for process exit
    this.process.on('exit', (code: number, signal: string) => {
      console.log(`Child process exited with code ${code} and signal ${signal}`);
      this.emit('exit', code, signal);
    });

    // Capture stdout and stderr data, and emit custom events
    this.process.stdout?.on('data', (data: Buffer) => {
      this.emit('stdout', data.toString());
    });

    this.process.stderr?.on('data', (data: Buffer) => {
      this.emit('stderr', data.toString());
    });

    // Capture error events
    this.process.on('error', (err) => {
      console.error('Failed to start shell process:', err);
      this.emit('error', err);
    });

    // Capture stdin for logging (optional)
    if (this.process.stdin) {
      this.process.stdin.on('data', (data: Buffer) => {
        console.log('stdin data:', data.toString());
      });
    } else {
      console.error('stdin is not available.');
    }
  }

  // Method to send input to the child process
  sendInput(input: string) {
    if (this.process.stdin) {
      this.process.stdin.write(input);
    } else {
      console.error('stdin stream is not available.');
    }
  }

  // Method to check if the process is still running
  isRunning(): boolean {
    return this.process.connected;  // Will return true if the process is still running
  }

  // Method to kill the process (if desired)
  kill(signal: NodeJS.Signals | string = 'SIGTERM') {
    if (this.process && signal) {
      this.process.kill(signal as NodeJS.Signals);
      console.log(`Child process killed with signal: ${signal}`);
    }
  }
}

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

  // Handle terminal creation request from renderer process (React)
  ipcMain.handle('spawnTerminal', (): string => {
    const shell: string = process.platform === 'win32' ? 'cmd.exe' : '/bin/bash';

    if (!shell) {
      console.error('Shell executable is missing or invalid');
    }

    terminalProcess = new TerminalProcess(shell, {
      cwd: process.env.HOME || process.env.USERPROFILE || '/default/path', // Ensure cwd is a valid string
      env: process.env,
    });

    // Listen to terminal output and send it to renderer
    terminalProcess.process.stdout?.on('data', (output: Buffer) => {
      if (mainWindow) {
        mainWindow.webContents.send('terminalOutput', output.toString()); // Send output back to renderer
      }
    });

    terminalProcess.process.stdout?.on('error', (error: Buffer) => {
      if (mainWindow) {
        mainWindow.webContents.send('terminalOutput', error.toString()); // Send error back to renderer
      }
    });

    console.log('terminalStarted');
    return 'terminalStarted'; // Return a string identifier instead of the TerminalProcess object
  });

  ipcMain.on('terminalInput', (event, input: string): void => {
    if (terminalProcess) {

      terminalProcess.sendInput(input + '\n');

      console.log("Writing input to stdin:", input);
      // Capture the terminal's output through stdout
      terminalProcess.process.stdout?.on('data', (output: Buffer) => {
        console.log(output.toString());
        if (mainWindow) {
          mainWindow.webContents.send('terminalOutput', output.toString());
        }
      });

      // Capture the terminal's error output through stderr
      terminalProcess.process.stderr?.on('error', (error: Buffer) => {
        console.error("Terminal stderr:", error.toString());
        if (mainWindow) {
          mainWindow.webContents.send('terminalOutput', error.toString());
        }
      });
  
    }

  });


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
