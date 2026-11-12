import { createApp } from './app.js'
import { BASE_DIR, LOG_PATH, PORT, RUN_KIT_RETENTION_HOURS } from './config.js'
import { logger, logToPath } from './logger.js'
import { scheduleRunKitRetention } from './runKitRetention.js'

const init = async () => {
  if (LOG_PATH) {
    logToPath(LOG_PATH)
  }

  scheduleRunKitRetention(BASE_DIR, RUN_KIT_RETENTION_HOURS * 60 * 60 * 1000)

  const app = createApp()
  app.listen(PORT, () => logger.info(`Server is running on port ${PORT}`))
}

init().catch((error: any) => {
  logger.error('Failed to initialize server:', error)
  process.exitCode = 1
})
