import { logToPath, logger } from './logger.js'
import { setConfig, edgeClientLaunchConfiguration } from './config/config.js'
import { start as startApiServer } from './api/index.js'
import { assertLocalApiKey } from './api/localApiAccess.js'

export function start(config: edgeClientLaunchConfiguration): void {
  logger.info('Starting edge federated client')
  // Refuse to expose the local API without the host-issued key.
  const localApiKey = assertLocalApiKey(config.localApiKey)
  setConfig(config)
  if (config.logPath) {
    logToPath(config.logPath)
  }
  // launch the api server
  startApiServer({ port: config.hostingPort, localApiKey }).catch((error) => {
    logger.error('Failed to start the edge client local API', { error })
  })
}
