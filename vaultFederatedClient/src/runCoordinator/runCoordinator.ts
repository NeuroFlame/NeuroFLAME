import { createClient, Client } from 'graphql-ws'
import { WebSocket } from 'ws'
import { logger } from '../logger.js'
import {
  runStartHandler,
  RUN_START_SUBSCRIPTION,
} from './eventHandlers/runStart/runStart.js'
import {
  stopAllContainers,
  getRunningContainerCount,
  getRunningContainers,
} from './nodeManager/launchNode.js'

// Re-export container management functions
export { stopAllContainers, getRunningContainerCount, getRunningContainers }

// Interface for subscription event handlers
interface EventHandlers {
  next: Function
  error: Function
  complete: Function
}

let client: Client | null = null

// Interface for subscription parameters
interface SubscriptionParams {
  wsUrl: string
  accessToken: string
}

// Reconnection configuration
const RECONNECT_CONFIG = {
  // Retry forever - vault should always try to reconnect
  maxRetryAttempts: Infinity,
  // Base delay between retries (ms)
  baseRetryDelay: 1000,
  // Maximum delay between retries (ms) - caps exponential backoff
  maxRetryDelay: 30000,
  // Multiplier for exponential backoff
  backoffMultiplier: 1.5,
  // Keep-alive ping interval (ms) - detects dead connections
  keepAliveInterval: 30000,
}

/**
 * Calculate retry delay with exponential backoff and jitter
 * @param retryCount - Current retry attempt number
 * @returns Delay in milliseconds before next retry
 */
function calculateRetryDelay(retryCount: number): number {
  const exponentialDelay =
    RECONNECT_CONFIG.baseRetryDelay *
    Math.pow(RECONNECT_CONFIG.backoffMultiplier, retryCount)
  const cappedDelay = Math.min(exponentialDelay, RECONNECT_CONFIG.maxRetryDelay)
  // Add jitter (±20%) to prevent thundering herd
  const jitter = cappedDelay * 0.2 * (Math.random() * 2 - 1)
  return Math.floor(cappedDelay + jitter)
}

export async function subscribeToCentralApi({
  wsUrl,
  accessToken,
}: SubscriptionParams): Promise<void> {
  if (client) {
    logger.info('Disposing existing client before creating new connection')
    client.dispose()
  }

  logger.info('Subscribing to central API')
  logger.info(`WebSocket URL: ${wsUrl}`)

  let retryCount = 0

  // Create a new GraphQL WebSocket client with reconnection support
  client = createClient({
    url: wsUrl,
    webSocketImpl: WebSocket,
    connectionParams: {
      accessToken,
    },
    // Retry configuration
    retryAttempts: RECONNECT_CONFIG.maxRetryAttempts,
    retryWait: async (retryAttempt) => {
      retryCount = retryAttempt
      const delay = calculateRetryDelay(retryAttempt)
      logger.warn(
        `Connection lost. Retry attempt ${retryAttempt} in ${delay}ms`,
      )
      await new Promise((resolve) => setTimeout(resolve, delay))
    },
    shouldRetry: (errOrCloseEvent) => {
      // Always retry for vault - it should maintain connection
      logger.warn('Connection error or close event, will retry', {
        error: errOrCloseEvent,
      })
      return true
    },
    // Keep-alive to detect dead connections
    keepAlive: RECONNECT_CONFIG.keepAliveInterval,
    // Connection lifecycle handlers
    on: {
      connecting: () => {
        logger.info('WebSocket connecting...')
      },
      opened: (socket) => {
        logger.info('WebSocket connection opened')
        if (retryCount > 0) {
          logger.info(
            `Successfully reconnected after ${retryCount} retry attempts`,
          )
          retryCount = 0
        }
      },
      connected: (socket) => {
        logger.info('WebSocket connected and ready')
      },
      ping: (received) => {
        logger.debug(`WebSocket ping ${received ? 'received' : 'sent'}`)
      },
      pong: (received) => {
        logger.debug(`WebSocket pong ${received ? 'received' : 'sent'}`)
      },
      message: (message) => {
        logger.debug('WebSocket message received')
      },
      closed: (event: unknown) => {
        const closeEvent = event as { code?: number; reason?: string }
        logger.warn('WebSocket connection closed', {
          context: { code: closeEvent.code, reason: closeEvent.reason },
        })
      },
      error: (error) => {
        logger.error('WebSocket error', { error })
      },
    },
  })

  subscribe(client, RUN_START_SUBSCRIPTION, runStartHandler)
}

function subscribe(
  client: Client,
  subscriptionQuery: string,
  eventHandlers: EventHandlers,
): void {
  const { next, error, complete } = eventHandlers

  // Wrap handlers to add logging and handle subscription-level reconnection
  const wrappedHandlers = {
    next: (data: unknown) => {
      logger.debug('Subscription received data')
      next(data)
    },
    error: (err: unknown) => {
      logger.error('Subscription error', { error: err })
      error(err)
    },
    complete: () => {
      logger.info('Subscription completed')
      complete()
    },
  }

  client.subscribe({ query: subscriptionQuery }, wrappedHandlers)
}

/**
 * Gracefully shutdown the WebSocket connection
 * @returns Promise that resolves when shutdown is complete
 */
export async function shutdown(): Promise<void> {
  if (client) {
    logger.info('Shutting down WebSocket connection...')
    try {
      client.dispose()
      client = null
      logger.info('WebSocket connection closed successfully')
    } catch (error) {
      logger.error('Error during WebSocket shutdown', { error })
      throw error
    }
  } else {
    logger.info('No active WebSocket connection to shutdown')
  }
}

/**
 * Check if the client is currently connected
 * @returns true if client exists
 */
export function isConnected(): boolean {
  return client !== null
}
