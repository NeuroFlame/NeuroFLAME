import * as runCoordinator from './runCoordinator/runCoordinator.js'
import getConfig from './config/getConfig.js'
import { logger, logToPath } from './logger.js'

interface FederatedClientLaunchConfiguration {
  httpUrl: string
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
    const config = await getConfig()
    if (config.logPath) {
      logToPath(config.logPath)
    }
    await start(config)
  } catch (err) {
    logger.error('Failed to start:', { error: err })
  }
})()
