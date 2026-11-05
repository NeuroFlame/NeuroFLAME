import { logToPath, logger } from './logger.js'
import { setConfig, edgeClientLaunchConfiguration } from './config/config.js'
import { start as startApiServer } from './api/index.js'
import { setStaleSessionHandler, StaleSessionHandler } from './auth/staleSessionHandler.js'

export interface StartOptions {
  /**
   * Called instead of the default (exiting the process) when this client
   * detects its own held session has gone stale — see
   * auth/staleSessionHandler.ts. Leave unset for a standalone
   * `neuroflame-edge` process; exiting is the correct, intended behavior
   * there (a systemd unit or a re-run `edge start` picks a fresh session
   * back up). Only override this if you're embedding this package
   * in-process alongside other long-lived work, where the default would
   * take the whole embedding process down with it — the desktop app's
   * Electron main process genuinely IS this process, not a spawned
   * child, so this isn't a hypothetical case.
   */
  onStaleSession?: StaleSessionHandler
}

export function start(
  config: edgeClientLaunchConfiguration,
  options?: StartOptions,
): void {
  logger.info('Starting edge federated client')
  setConfig(config)
  if (config.logPath) {
    logToPath(config.logPath)
  }
  if (options?.onStaleSession) {
    setStaleSessionHandler(options.onStaleSession)
  }
  // launch the api server
  startApiServer({ port: config.hostingPort })
}
