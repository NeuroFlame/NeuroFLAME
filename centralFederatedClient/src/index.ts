import * as runCoordinator from './runCoordinator/runCoordinator.js'
import { ACCESS_TOKEN, LOG_PATH, WS_URL } from './config.js'
import { logger, logToPath } from './logger.js'

interface FederatedClientLaunchConfiguration {
  wsUrl: string
  accessToken: string
}

export async function start(
  config: FederatedClientLaunchConfiguration,
): Promise<void> {
  // Subscribe to events and attach handlers
  const { wsUrl, accessToken } = config

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
