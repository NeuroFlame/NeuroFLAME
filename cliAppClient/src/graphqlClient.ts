// Deliberately thin: a raw fetch()-based GraphQL client for queries/mutations,
// plus a graphql-ws subscription helper. No Apollo — the CLI only ever needs
// a handful of operations, and this mirrors the pattern edgeFederatedClient
// and vaultFederatedClient already use to talk to centralApi.

import { createClient } from 'graphql-ws'
import { WebSocket } from 'ws'
import { logger } from './logger.js'

interface GraphQLError {
  message: string
  [key: string]: unknown
}

interface GraphQLResponse<T> {
  data?: T
  errors?: GraphQLError[]
}

// Node's fetch (undici) throws a generic `TypeError: fetch failed` for
// every connection-level failure, with the actually-useful detail buried in
// `.cause`. When a host resolves to multiple addresses (e.g. localhost ->
// ::1 and 127.0.0.1), `.cause` is itself an AggregateError whose own
// `.message` is blank — the real message (e.g. "connect ECONNREFUSED
// 127.0.0.1:4001") is one level deeper, in `.cause.errors[0]`.
export function describeNetworkError(error: unknown): string {
  if (!(error instanceof Error)) return String(error)

  const cause = (error as { cause?: unknown }).cause
  if (cause instanceof Error) {
    const nestedErrors = (cause as { errors?: unknown }).errors
    if (Array.isArray(nestedErrors) && nestedErrors[0] instanceof Error) {
      return nestedErrors[0].message
    }
    if (cause.message) return cause.message
    const code = (cause as { code?: unknown }).code
    if (typeof code === 'string') return code
  }

  return error.message
}

export async function gqlRequest<T>(
  httpUrl: string,
  query: string,
  variables: Record<string, unknown> = {},
  accessToken?: string,
): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  }
  if (accessToken) {
    headers['x-access-token'] = accessToken
  }

  logger.debug(`POST ${httpUrl}`, { variables })

  let response: Response
  try {
    response = await fetch(httpUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify({ query, variables }),
    })
  } catch (error) {
    throw new Error(
      `Could not reach ${httpUrl} (${describeNetworkError(error)}). ` +
        'Is the server running there, and pointed at correctly ' +
        '(NEUROFLAME_HTTP_URL/NEUROFLAME_WS_URL, or NEUROFLAME_EDGE_URL for `edge` commands)?',
    )
  }

  if (!response.ok) {
    const text = await response.text()
    throw new Error(`HTTP ${response.status} ${response.statusText}: ${text}`)
  }

  const body = (await response.json()) as GraphQLResponse<T>

  if (body.errors && body.errors.length > 0) {
    throw new Error(body.errors.map((e) => e.message).join('; '))
  }
  if (!body.data) {
    throw new Error('GraphQL response contained no data.')
  }

  return body.data
}

/**
 * Subscribes to a single-field GraphQL subscription and invokes onNext with
 * that field's payload for every event. Returns an unsubscribe function.
 */
export function subscribeToCentral<T>(
  wsUrl: string,
  accessToken: string,
  query: string,
  onNext: (payload: T) => void,
  onError: (error: unknown) => void,
  variables: Record<string, unknown> = {},
): () => void {
  const client = createClient({
    url: wsUrl,
    webSocketImpl: WebSocket as unknown as typeof globalThis.WebSocket,
    connectionParams: { accessToken },
  })

  const unsubscribe = client.subscribe<Record<string, T>>(
    { query, variables },
    {
      next: (result) => {
        if (result.errors && result.errors.length > 0) {
          onError(new Error(result.errors.map((e) => e.message).join('; ')))
          return
        }
        const [payload] = Object.values(result.data ?? {})
        if (payload !== undefined) {
          onNext(payload)
        }
      },
      error: onError,
      complete: () => {
        logger.debug('Subscription completed', { query })
      },
    },
  )

  return () => {
    unsubscribe()
    client.dispose()
  }
}
