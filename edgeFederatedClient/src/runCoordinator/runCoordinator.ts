import { createHash, timingSafeEqual } from 'crypto'
import { createClient } from 'graphql-ws'
import { WebSocket } from 'ws'
import { logger } from '../logger.js'
import {
  runStartHandler,
  RUN_START_SUBSCRIPTION,
} from './eventHandlers/runStart/runStart.js'
import {
  createResultRelayHandler,
  MCP_RESULT_REQUEST_SUBSCRIPTION,
} from './resultRelay.js'
import { validateToken } from '../auth/validateToken.js'

// Interface for subscription event handlers
interface EventHandlers {
  next: Function
  error: Function
  complete: Function
}

let client: any
let activeAccessTokenHash = ''
let activeAbortController: AbortController | undefined
let transition: Promise<void> = Promise.resolve()

const hashToken = (token: string): string =>
  createHash('sha256').update(token).digest('hex')

const sameToken = (token: string, expectedHash: string): boolean => {
  const supplied = Buffer.from(hashToken(token), 'hex')
  const expected = Buffer.from(expectedHash, 'hex')
  return supplied.length === expected.length && timingSafeEqual(supplied, expected)
}

const enqueueTransition = (operation: () => Promise<void>): Promise<void> => {
  const next = transition.then(operation, operation)
  transition = next.catch(() => undefined)
  return next
}

const disposeActiveClient = async (): Promise<void> => {
  const previous = client
  client = undefined
  activeAccessTokenHash = ''
  activeAbortController?.abort()
  activeAbortController = undefined
  if (previous) await previous.dispose()
}

// Interface for subscription parameters
interface SubscriptionParams {
  wsUrl: string
  accessToken: string
}

export async function subscribeToCentralApi({
  wsUrl,
  accessToken,
}: SubscriptionParams): Promise<void> {
  await enqueueTransition(async () => {
    if (client && sameToken(accessToken, activeAccessTokenHash)) return
    // Account changes fail closed: the prior user's handlers are gone before
    // any upstream validation or connection attempt for the new account.
    await disposeActiveClient()
    const payload = await validateToken(accessToken)
    if (!payload.userId) throw new Error('Cannot subscribe without an authenticated user')

    logger.info('Subscribing to central API')
    const nextClient = createClient({
      url: wsUrl,
      webSocketImpl: WebSocket,
      connectionParams: { accessToken },
    })
    client = nextClient
    activeAccessTokenHash = hashToken(accessToken)
    activeAbortController = new AbortController()
    subscribe(nextClient, RUN_START_SUBSCRIPTION, runStartHandler)
    subscribe(nextClient, MCP_RESULT_REQUEST_SUBSCRIPTION, createResultRelayHandler({
      userId: payload.userId,
      accessToken,
      isActive: () => client === nextClient && sameToken(accessToken, activeAccessTokenHash),
      signal: activeAbortController.signal,
    }))
  })
}

export async function disconnectFromCentralApi(expectedAccessToken?: string): Promise<boolean> {
  let disconnected = false
  await enqueueTransition(async () => {
    if (
      expectedAccessToken &&
      activeAccessTokenHash &&
      !sameToken(expectedAccessToken, activeAccessTokenHash)
    ) throw new Error('The local session token does not match the active user')
    await disposeActiveClient()
    disconnected = true
  })
  return disconnected
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
