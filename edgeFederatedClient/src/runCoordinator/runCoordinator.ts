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
  // Create a new GraphQL WebSocket client
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

  subscribe(client, RUN_START_SUBSCRIPTION, runStartHandler)
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
