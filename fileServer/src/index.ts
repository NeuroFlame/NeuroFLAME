import express from 'express'
import downloadRoute from './routes/downloadRoute.js'
import uploadRoute from './routes/uploadRoute.js'
import downloadResultsRoute from './routes/downloadResultsRoute.js'
import uploadResultsRoute from './routes/uploadResultsRoute.js'
import { LOG_PATH, PORT } from './config.js'
import { logger, logToPath } from './logger.js'

const init = async () => {
  const app = express()
  if (LOG_PATH) {
    logToPath(LOG_PATH)
  }

  app.use(express.json())

  app.use('/', downloadRoute)
  app.use('/', uploadRoute)
  app.use('/', downloadResultsRoute)
  app.use('/', uploadResultsRoute)

  app.listen(PORT, () => logger.info(`Server is running on port ${PORT}`))
}

init().catch((error: any) => {
  logger.error('Failed to initialize server:', error)
  process.exitCode = 1
})
