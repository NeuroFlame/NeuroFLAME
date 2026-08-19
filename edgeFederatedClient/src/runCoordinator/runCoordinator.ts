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

export async function subscribeToCentralApi({
  wsUrl,
  accessToken,
}: SubscriptionParams): Promise<void> {
  if (client) {
    client.dispose()
  }

  logger.info('Subscribing to central API')
  client = createClient({
    url: wsUrl,
    webSocketImpl: WebSocket,
    connectionParams: {
      accessToken,
    },
    retryAttempts: Infinity,
    shouldRetry: (err) => {
      const code = (err as any)?.code
      // 4400-4499 are application-level auth rejections; retrying cannot fix them
      return typeof code !== 'number' || code < 4400 || code >= 4500
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
      if (typeof code !== 'number' || code < 4400 || code >= 4500) {
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
