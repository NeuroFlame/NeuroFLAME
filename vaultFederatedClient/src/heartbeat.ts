import { VAULT_HTTP_URL, VAULT_ACCESS_TOKEN } from './config.js'
import { logger } from './logger.js'
import {
  isConnected,
  getRunningContainers,
} from './runCoordinator/runCoordinator.js'

// Heartbeat configuration
const HEARTBEAT_INTERVAL_MS = 30_000 // 30 seconds

// Track heartbeat state
let heartbeatTimer: NodeJS.Timeout | null = null
const startTime = Date.now()

// Version info (could be loaded from package.json in production)
const VAULT_VERSION = '1.0.0'

interface HeartbeatPayload {
  status: 'online' | 'degraded'
  version: string
  uptime: number
  websocketConnected: boolean
  runningComputations: Array<{
    runId: string
    consortiumId: string
    startedAt: string
  }>
}

const HEARTBEAT_MUTATION = `
  mutation vaultHeartbeat($heartbeat: VaultHeartbeatInput!) {
    vaultHeartbeat(heartbeat: $heartbeat)
  }
`

/**
 * Build the heartbeat payload with current status
 */
function buildHeartbeatPayload(): HeartbeatPayload {
  const wsConnected = isConnected()
  const runningContainers = getRunningContainers()

  return {
    status: wsConnected ? 'online' : 'degraded',
    version: VAULT_VERSION,
    uptime: Math.floor((Date.now() - startTime) / 1000),
    websocketConnected: wsConnected,
    runningComputations: runningContainers.map((c) => ({
      runId: c.runId,
      consortiumId: c.consortiumId,
      startedAt: c.startedAt.toISOString(),
    })),
  }
}

/**
 * Send a heartbeat to the central API
 */
async function sendHeartbeat(): Promise<void> {
  const payload = buildHeartbeatPayload()

  try {
    const response = await fetch(VAULT_HTTP_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-access-token': VAULT_ACCESS_TOKEN,
      },
      body: JSON.stringify({
        query: HEARTBEAT_MUTATION,
        variables: { heartbeat: payload },
      }),
    })

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`)
    }

    const result = (await response.json()) as {
      data?: { vaultHeartbeat: boolean }
      errors?: Array<{ message: string }>
    }

    if (result.errors && result.errors.length > 0) {
      throw new Error(result.errors.map((e) => e.message).join(', '))
    }

    logger.debug('Heartbeat sent successfully', {
      context: {
        status: payload.status,
        runningComputations: payload.runningComputations.length,
      },
    })
  } catch (error) {
    // Log but don't throw - heartbeat failures shouldn't crash the service
    logger.warn('Failed to send heartbeat', { error })
  }
}

/**
 * Start the heartbeat sender
 * Sends an immediate heartbeat, then continues at the configured interval
 */
export function startHeartbeat(): void {
  if (heartbeatTimer) {
    logger.warn('Heartbeat already running')
    return
  }

  logger.info(
    `Starting heartbeat sender (interval: ${HEARTBEAT_INTERVAL_MS / 1000}s)`,
  )

  // Send initial heartbeat immediately
  sendHeartbeat()

  // Schedule recurring heartbeats
  heartbeatTimer = setInterval(() => {
    sendHeartbeat()
  }, HEARTBEAT_INTERVAL_MS)
}

/**
 * Stop the heartbeat sender
 * Sends a final "offline" heartbeat before stopping
 */
export async function stopHeartbeat(): Promise<void> {
  if (!heartbeatTimer) {
    return
  }

  logger.info('Stopping heartbeat sender')
  clearInterval(heartbeatTimer)
  heartbeatTimer = null

  // Send final offline heartbeat
  try {
    const payload = buildHeartbeatPayload()
    // Override status to indicate we're going offline
    payload.status = 'degraded'

    await fetch(VAULT_HTTP_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-access-token': VAULT_ACCESS_TOKEN,
      },
      body: JSON.stringify({
        query: HEARTBEAT_MUTATION,
        variables: { heartbeat: payload },
      }),
    })

    logger.info('Final heartbeat sent')
  } catch (error) {
    logger.warn('Failed to send final heartbeat', { error })
  }
}
