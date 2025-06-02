import reportRunError from '../../report/reportRunError.js'
import reportRunReady from '../../report/reportRunReady.js'
import startRun from './startRun.js'
import { logger } from '../../../logger.js'

export const RUN_START_SUBSCRIPTION = `
subscription runStartSubscription {
    runStartCentral {
        consortiumId
        runId
        userIds
        computationParameters
        imageName
    }
}`

export const runStartHandler = {
  error: (err: any) =>{
    logger.error(`Run Start Central - Subscription error`, { error: err })
  },
  complete: () => logger.info('Run Start Central - Subscription completed'),
  next: async ({ data }: { data: any }) => {
    const {
      consortiumId,
      runId,
      userIds,
      computationParameters,
      imageName,
    } = data.runStartCentral

    try {
      await startRun({
        imageName,
        userIds,
        consortiumId,
        runId,
        computationParameters,
      })

      // wait a 1 second to report run ready
      await new Promise((resolve) => setTimeout(resolve, 1000))

      // report to the central api that the run is ready
      return await reportRunReady({ runId })
    } catch (error) {
      logger.error(`Error in Run Start Central:`, { error })

      return await reportRunError({
        runId,
        errorMessage: (error as Error).message,
      })
    }
  },
}
