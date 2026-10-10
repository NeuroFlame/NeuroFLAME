import { createClient } from 'graphql-ws'
import { WebSocket } from 'ws'
import { logger } from '../logger.js'
import {
  runStartHandler,
  RUN_START_SUBSCRIPTION,
} from './eventHandlers/runStart/runStart.js'

// Interface for subscription event handlers
interface EventHandlers {
  next: Function
  error: Function
  complete: Function
}

let client: any

// Interface for subscription parameters
interface SubscriptionParams {
  wsUrl: string
  accessToken: string
}

// 4401 Unauthorized / 4403 Forbidden are application-level auth rejections;
// retrying cannot fix them. Other codes in the 4400-4499 range (e.g. 4408
// connection init timeout, 4429 too many init requests) are transient.
const NON_RETRYABLE_CLOSE_CODES = new Set([4401, 4403])

// Reconnection configuration (styled after vaultFederatedClient)
const RECONNECT_CONFIG = {
  // Retry forever - EFC should always try to reconnect
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
    client.dispose()
  }

  let retryCount = 0

  logger.info('Subscribing to central API')
  client = createClient({
    url: wsUrl,
    webSocketImpl: WebSocket,
    connectionParams: {
      accessToken,
    },
    retryAttempts: RECONNECT_CONFIG.maxRetryAttempts,
    retryWait: async (retryAttempt) => {
      retryCount = retryAttempt
      const delay = calculateRetryDelay(retryAttempt)
      logger.warn(`Connection lost. Retry attempt ${retryAttempt} in ${delay}ms`)
      await new Promise((resolve) => setTimeout(resolve, delay))
    },
    shouldRetry: (err) => {
      const code = (err as any)?.code
      return typeof code !== 'number' || !NON_RETRYABLE_CLOSE_CODES.has(code)
    },
    // Keep-alive to detect dead connections
    keepAlive: RECONNECT_CONFIG.keepAliveInterval,
    on: {
      opened: () => {
        if (retryCount > 0) {
          logger.info(`Successfully reconnected after ${retryCount} retry attempts`)
          retryCount = 0
        }
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

  // graphql-ws treats close code 1006 (ECONNREFUSED / abnormal closure) as fatal
  // and won't invoke shouldRetry for it. Reconnect manually on retriable errors so
  // that transient network failures (centralApi not yet ready, restart) don't kill EFC.
  const handler = {
    ...runStartHandler,
    error: (err: any) => {
      runStartHandler.error(err)
      const code = (err as any)?.code
      if (typeof code !== 'number' || !NON_RETRYABLE_CLOSE_CODES.has(code)) {
        logger.info('Reconnecting to central API in 3s...')
        setTimeout(() => subscribeToCentralApi({ wsUrl, accessToken }), 3000)
      }
    },
  }

  subscribe(client, RUN_START_SUBSCRIPTION, handler)
}

function subscribe(
  client: any,
  subscriptionQuery: string,
  eventHandlers: EventHandlers,
): void {
  const { next, error, complete } = eventHandlers
  return client.subscribe(
    { query: subscriptionQuery },
    { next, error, complete },
  )
}
