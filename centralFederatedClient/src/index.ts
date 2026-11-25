import * as runCoordinator from './runCoordinator/runCoordinator.js'
import { ACCESS_TOKEN, LOG_PATH, WS_URL } from './config.js'
import { logger, logToPath } from './logger.js'
import { removeStaleReservations } from './runCoordinator/eventHandlers/runStart/portManagement.js'

interface FederatedClientLaunchConfiguration {
  wsUrl: string
  accessToken: string
}

export async function start(
  config: FederatedClientLaunchConfiguration,
): Promise<void> {
  // Subscribe to events and attach handlers
  const { wsUrl, accessToken } = config

  try {
    const removed = await removeStaleReservations()
    if (removed > 0) logger.info(`Removed ${removed} stale federation port reservations`)
  } catch (error) {
    logger.warn('Could not remove stale federation port reservations', { error })
  }

  await runCoordinator.subscribeToCentralApi({
    wsUrl,
    accessToken,
  })
}

;(async () => {
  try {
    if (LOG_PATH) {
      logToPath(LOG_PATH)
    }
    await start({
      wsUrl: WS_URL,
      accessToken: ACCESS_TOKEN,
    })
  } catch (err) {
    logger.error('Failed to start:', { error: err })
  }
})()
