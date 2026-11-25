import reportRunError from '../../report/reportRunError.js'
import reportRunReady from '../../report/reportRunReady.js'
import startRun from './startRun.js'
import { stopDockerNode } from '../../nodeManager/launchNode.js'
import { logger } from '../../../logger.js'

export const RUN_START_SUBSCRIPTION = `
  subscription runStartSubscription {
    runStartCentral {
      consortiumId
      runId
      activeParticipants {
        participantId
        kind
        displayName
        userId
        vaultId
      }
      computationParameters
      requiredComputationApiVersion
      imageName
    }
  }
`

export const runStartHandler = {
  error: (err: any) => {
    logger.error('Run Start Central - Subscription error', { error: err })
  },
  complete: () => logger.info('Run Start Central - Subscription completed'),
  next: async ({ data }: { data: any }) => {
    const {
      consortiumId,
      runId,
      activeParticipants,
      computationParameters,
      requiredComputationApiVersion,
      imageName,
    } = data.runStartCentral

    let centralContainerId: string | undefined
    const stopCentralNode = async () => {
      if (!centralContainerId) return
      try {
        await stopDockerNode(centralContainerId)
      } catch (stopError) {
        logger.error('Failed to stop the central node of an abandoned run', {
          error: stopError,
          runId,
        })
      }
    }

    try {
      const started = await startRun({
        imageName,
        activeParticipants,
        consortiumId,
        runId,
        computationParameters,
        requiredComputationApiVersion,
      })
      centralContainerId = started.centralContainerId

      // wait a 1 second to report run ready
      await new Promise((resolve) => setTimeout(resolve, 1000))

      // report to the central api that the run is ready
      const accepted = await reportRunReady({ runId, resolvedImage: started.resolvedImage })
      if (!accepted) {
        // The run already finished (for example, the central node failed first).
        logger.warn('Central API did not accept run readiness; stopping the central node', { runId })
        await stopCentralNode()
      }
      return accepted
    } catch (error) {
      logger.error('Error in Run Start Central:', { error })
      // Sites were never told to start, so the central node would wait forever.
      await stopCentralNode()

      try {
        return await reportRunError({
          runId,
          errorMessage: (error as Error).message,
        })
      } catch (reportError) {
        logger.error('Failed to report the run start failure', { error: reportError, runId })
        return false
      }
    }
  },
}
