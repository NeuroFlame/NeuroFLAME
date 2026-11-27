import { CloseCode, createClient, type Client } from 'graphql-ws'
import { WebSocket } from 'ws'
import { logger } from '../logger.js'
import { onStaleSession } from '../auth/staleSessionHandler.js'
import {
  runStartHandler,
  RUN_START_SUBSCRIPTION,
} from './eventHandlers/runStart/runStart.js'

let client: Client | undefined

const isCloseEvent = (error: unknown): error is { code: number } =>
  typeof error === 'object' && error !== null && 'code' in error && typeof error.code === 'number'

const isSessionRejection = (error: unknown): boolean =>
  isCloseEvent(error) && (error.code === CloseCode.Forbidden || error.code === CloseCode.Unauthorized)

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
  const subscriptionClient = createClient({
    url: wsUrl,
    webSocketImpl: WebSocket,
    connectionParams: {
      accessToken,
    },
    // Retrying an authentication rejection would resend the same token.
    shouldRetry: (error) => isCloseEvent(error) && !isSessionRejection(error),
  })

  client = subscriptionClient
  subscriptionClient.subscribe({ query: RUN_START_SUBSCRIPTION }, {
    next: guardEventHandler(runStartHandler.next),
    error: (error) => {
      // A late close from a replaced subscription says nothing about the new login.
      if (client !== subscriptionClient) return
      if (isSessionRejection(error)) {
        onStaleSession('Central API rejected the run-start subscription session.')
        return
      }
      runStartHandler.error(error)
    },
    complete: runStartHandler.complete,
  })
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
