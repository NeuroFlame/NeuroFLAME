import * as runCoordinator from './runCoordinator/runCoordinator.js'
import { VAULT_ACCESS_TOKEN, VAULT_LOG_PATH, VAULT_WS_URL } from './config.js'
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
    if (VAULT_LOG_PATH) {
      logToPath(VAULT_LOG_PATH)
    }
    await start({
      wsUrl: VAULT_WS_URL,
      accessToken: VAULT_ACCESS_TOKEN,
    })
  } catch (err) {
    logger.error('Failed to start:', { error: err })
  }
})()
