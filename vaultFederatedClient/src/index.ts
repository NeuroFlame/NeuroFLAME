import * as runCoordinator from './runCoordinator/runCoordinator.js'
import { VAULT_ACCESS_TOKEN, VAULT_LOG_PATH, VAULT_WS_URL } from './config.js'
import { logger, logToPath } from './logger.js'
import { startHeartbeat, stopHeartbeat } from './heartbeat.js'

interface FederatedClientLaunchConfiguration {
  wsUrl: string
  accessToken: string
}

// Track shutdown state
let shutdownRequestCount = 0

export async function start(
  config: FederatedClientLaunchConfiguration,
): Promise<void> {
  // Subscribe to events and attach handlers
  const { wsUrl, accessToken } = config

  await runCoordinator.subscribeToCentralApi({
    wsUrl,
    accessToken,
  })
}

/**
 * Handle shutdown signal
 * - First signal: warn if containers running, otherwise shutdown
 * - Second signal: force shutdown regardless of running containers
 * @param signal - The signal that triggered the shutdown
 */
async function gracefulShutdown(signal: string): Promise<void> {
  shutdownRequestCount++

  const runningCount = runCoordinator.getRunningContainerCount()
  const runningContainers = runCoordinator.getRunningContainers()

  // First signal with running containers - warn and refuse
  if (shutdownRequestCount === 1 && runningCount > 0) {
    const runIds = runningContainers.map((c) => c.runId).join(', ')
    logger.warn(`Received ${signal}, but ${runningCount} computation(s) still running`)
    logger.warn(`Running computations: ${runIds}`)
    logger.warn('Send signal again to force shutdown (containers will be orphaned)')
    logger.warn('Waiting for computations to complete...')
    return
  }

  // Second signal or no running containers - proceed with shutdown
  if (shutdownRequestCount > 1 && runningCount > 0) {
    logger.warn(`Force shutdown requested. ${runningCount} container(s) will be orphaned.`)
    const runIds = runningContainers.map((c) => c.runId).join(', ')
    logger.warn(`Orphaned runs: ${runIds}`)
  }

  logger.info(`${signal} received, shutting down...`)

  const shutdownTimeout = setTimeout(() => {
    logger.error('Graceful shutdown timed out after 30s, forcing exit')
    process.exit(1)
  }, 30000)

  try {
    // Stop heartbeat (sends final "offline" heartbeat)
    await stopHeartbeat()

    // Shutdown the WebSocket connection
    await runCoordinator.shutdown()

    logger.info('Graceful shutdown completed successfully')
    clearTimeout(shutdownTimeout)
    process.exit(0)
  } catch (error) {
    logger.error('Error during graceful shutdown', { error })
    clearTimeout(shutdownTimeout)
    process.exit(1)
  }
}

/**
 * Setup signal handlers for graceful shutdown
 */
function setupSignalHandlers(): void {
  // Handle SIGTERM (Docker stop, Kubernetes termination)
  process.on('SIGTERM', () => {
    gracefulShutdown('SIGTERM')
  })

  // Handle SIGINT (Ctrl+C)
  process.on('SIGINT', () => {
    gracefulShutdown('SIGINT')
  })

  // Handle uncaught exceptions
  process.on('uncaughtException', (error) => {
    logger.error('Uncaught exception', { error })
    gracefulShutdown('uncaughtException')
  })

  // Handle unhandled promise rejections
  process.on('unhandledRejection', (reason, promise) => {
    logger.error('Unhandled promise rejection', {
      context: { reason, promise: String(promise) },
    })
    gracefulShutdown('unhandledRejection')
  })

  logger.info('Signal handlers registered for graceful shutdown')
}

;(async () => {
  try {
    if (VAULT_LOG_PATH) {
      logToPath(VAULT_LOG_PATH)
    }

    // Setup signal handlers before starting
    setupSignalHandlers()

    logger.info('Starting Vault Federated Client...')

    // Connect to central API
    await start({
      wsUrl: VAULT_WS_URL,
      accessToken: VAULT_ACCESS_TOKEN,
    })

    // Start sending heartbeats to central API
    startHeartbeat()

    logger.info('Vault Federated Client started successfully')
  } catch (err) {
    logger.error('Failed to start:', { error: err })
    process.exit(1)
  }
})()
