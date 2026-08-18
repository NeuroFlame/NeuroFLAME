import { getConfig } from '../../../config/config.js'
import downloadFile from './downloadFile.js'
import { launchNode } from '../../nodeManager/launchNode.js'
import path from 'path'
import { unzipFile } from './unzipFile.js'
import fs from 'fs/promises'
import { logger } from '../../../logger.js'
import reportRunError from '../../report/reportRunError.js'
import { prepareComputationImage } from '../../computationImage.js'
import { ensureLocalRuntimeError } from '../../terminalError.js'

export const RUN_START_SUBSCRIPTION = `
  subscription runStartSubscription {
    runStartEdge {
      consortiumId
      runId
      participantId
      imageName
      resolvedImage {
        sourceImage
        reference
        digest
        metadata {
          title
          computationVersion
          revision
          source
          computationApiVersion
          boilerplateVersion
          nvflareVersion
        }
      }
      downloadUrl
      downloadToken
    }
  }
`

export const runStartHandler = {
  error: (err: any) =>
    logger.error('Run Start - Subscription error', { error: err }),
  complete: () => logger.info('Run Start - Subscription completed'),
  next: async ({ data }: { data: any }) => {
    logger.info('Run Start - Received data')
    let resultsPath: string | undefined
    try {
      const {
        consortiumId,
        runId,
        participantId,
        resolvedImage,
        downloadUrl,
        downloadToken,
      } = data.runStartEdge

      const config = await getConfig()
      const { pathBaseDirectory, containerService = 'docker' } = config

      const consortiumPath = path.join(pathBaseDirectory, consortiumId)
      const runPath = path.join(consortiumPath, runId, participantId)
      const runKitPath = path.join(runPath, 'runKit')
      const currentResultsPath = path.join(runPath, 'results')
      resultsPath = currentResultsPath

      // Keep run artifacts private to the federated-client service account.
      for (const directory of [
        consortiumPath,
        runPath,
        runKitPath,
        currentResultsPath,
      ]) {
        await fs.mkdir(directory, { recursive: true, mode: 0o700 })
        await fs.chmod(directory, 0o700)
      }

      const runtimeImage = await prepareComputationImage(
        resolvedImage,
        containerService,
        pathBaseDirectory,
      )

      const mountConfigPath = path.join(consortiumPath, 'mount_config.json')

      // Download the runkit to the appropriate directory
      await downloadFile({
        url: downloadUrl,
        accessToken: downloadToken,
        pathOutputDir: runKitPath,
        outputFilename: 'kit.zip',
      })

      // Unzip the file
      try {
        await unzipFile({ directory: runKitPath, fileName: 'kit.zip' })
      } catch (e) {
        throw new Error(
          `Error unzipping the file: ${
            (e as Error).message || (e as Error).toString()
          }`,
        )
      }

      // Prepare directories to mount
      const directoriesToMount = [
        {
          hostDirectory: runKitPath,
          containerDirectory: '/workspace/runKit',
          readOnly: false,
        },
        {
          hostDirectory: currentResultsPath,
          containerDirectory: '/workspace/output',
          readOnly: false,
        },
      ]

      // Load mount configuration and add data path
      try {
        const mountConfig = JSON.parse(
          await fs.readFile(mountConfigPath, 'utf-8'),
        )
        const dataPath = mountConfig.dataPath
        directoriesToMount.push({
          hostDirectory: dataPath,
          containerDirectory: '/workspace/data',
          readOnly: true,
        })
      } catch (e) {
        logger.error(`Failed to read or parse mount configuration: ${e}`)
        throw new Error('Failed to load mount configuration')
      }

      // Launch the node
      await launchNode({
        containerService,
        imageName: runtimeImage,
        directoriesToMount,
        portBindings: [],
        commandsToRun: ['python', '/workspace/system/entry_edge.py'],
        failureLogPath: path.join(currentResultsPath, 'failed-container.log'),
        onContainerExitError: async (containerId, error) => {
          logger.error(`[runStart] onContainerExitError called for container: ${containerId}`, { error })
          logger.info(`[runStart] runId: ${runId}`)
          logger.info('[runStart] Reporting a site computation failure')
          try {
            await ensureLocalRuntimeError(
              currentResultsPath,
              'container_runtime',
              error,
            )
            const result = await reportRunError({
              runId,
              errorMessage:
                'Site computation failed. Detailed error is available in the participant\'s local run results.',
            })
            logger.info(`[runStart] reportRunError completed successfully, result: ${result}`)
          } catch (err) {
            logger.error(`[runStart] Error calling reportRunError: ${err}`)
            logger.error(`[runStart] Error stack: ${err instanceof Error ? err.stack : 'No stack trace'}`)
            throw err
          }
        },
        onContainerExitSuccess(containerId) {
          logger.info(`Container exited successfully: ${containerId}`)
        },
      })
    } catch (error) {
      logger.error('Error in runStartHandler', { error })

      if (resultsPath) {
        try {
          await ensureLocalRuntimeError(
            resultsPath,
            'run_startup',
            (error as Error).message,
          )
        } catch (markerError) {
          logger.error('Failed to record the local run error', {
            error: markerError,
          })
        }
      }

      await reportRunError({
        runId: data.runStartEdge.runId,
        errorMessage: `Error starting run: ${(error as Error).message}`,
      })
    }
  },
}
