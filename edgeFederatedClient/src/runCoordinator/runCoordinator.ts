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
  })

  subscribe(client, RUN_START_SUBSCRIPTION, runStartHandler)
}

// graphql-ws ignores the promise a handler returns; a rejection would be unhandled
// and would stop this service. Log handler failures instead.
export const guardEventHandler = (next: Function) => (data: unknown): void => {
  Promise.resolve()
    .then(() => next(data))
    .catch((handlerError: unknown) => {
      logger.error('Subscription event handler failed', { error: handlerError })
    })
}

function subscribe(
  client: any,
  subscriptionQuery: string,
  eventHandlers: EventHandlers,
): void {
  const { next, error, complete } = eventHandlers
  return client.subscribe(
    { query: subscriptionQuery },
    { next: guardEventHandler(next), error, complete },
  )
}
