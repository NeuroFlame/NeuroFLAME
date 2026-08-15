import {
  VAULT_BASE_DIR,
  VAULT_CONTAINER_SERVICE,
  VAULT_ERROR_DISCLOSURE,
} from '../../../config.js'
import {
  prepareResolvedComputationImage,
  registerTrackedImage,
} from '../../../imageManager.js'
import { resolveDatasetPathForVault } from '../../../vaultConfigManager.js'
import downloadFile from './downloadFile.js'
import { launchNode } from '../../nodeManager/launchNode.js'
import path from 'path'
import { unzipFile } from './unzipFile.js'
import { promises as fs } from 'fs'
import { logger } from '../../../logger.js'
import reportRunError from '../../report/reportRunError.js'
import { resolveContainerFailureReport } from '../../terminalError.js'

export const RUN_START_SUBSCRIPTION = `
  subscription runStartSubscription {
    runStartEdge {
      consortiumId
      runId
      participantId
      vaultId
      computationId
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
    try {
      const {
        consortiumId,
        runId,
        participantId,
        vaultId,
        computationId,
        resolvedImage,
        downloadUrl,
        downloadToken,
      } = data.runStartEdge

      if (resolvedImage.reference !== resolvedImage.digest) {
        await registerTrackedImage(resolvedImage.reference)
      }
      const runtimeImage = await prepareResolvedComputationImage(
        resolvedImage,
        VAULT_CONTAINER_SERVICE,
      )

      const consortiumPath = path.join(VAULT_BASE_DIR, consortiumId)
      const runPath = path.join(consortiumPath, runId, participantId)
      const runKitPath = path.join(runPath, 'runKit')
      const resultsPath = path.join(runPath, 'results')

      // Keep run artifacts private to the federated-client service account.
      for (const directory of [
        consortiumPath,
        runPath,
        runKitPath,
        resultsPath,
      ]) {
        await fs.mkdir(directory, { recursive: true, mode: 0o700 })
        await fs.chmod(directory, 0o700)
      }

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
          hostDirectory: resultsPath,
          containerDirectory: '/workspace/output',
          readOnly: false,
        },
      ]

      if (!vaultId) {
        throw new Error('No hosted vault id was provided for this vault run')
      }

      const datasetPath = await resolveDatasetPathForVault(vaultId, computationId)
      directoriesToMount.push({
        hostDirectory: datasetPath,
        containerDirectory: '/workspace/data',
        readOnly: true,
      })

      // Launch the node
      await launchNode({
        containerService: VAULT_CONTAINER_SERVICE,
        imageName: runtimeImage,
        runId,
        consortiumId,
        directoriesToMount,
        portBindings: [],
        commandsToRun: ['python', '/workspace/system/entry_edge.py'],
        failureLogPath: path.join(resultsPath, 'failed-container.log'),
        onContainerExitError: async (containerId, error) => {
          logger.error(`Error in container: ${containerId}`, { error })
          const genericError = `Error in container: ${containerId}`
          const failureReport = await resolveContainerFailureReport({
            outputDirectory: resultsPath,
            disclosure: VAULT_ERROR_DISCLOSURE,
            genericError,
          })
          await reportRunError({
            runId,
            vaultId,
            ...failureReport,
          })
        },
        onContainerExitSuccess(containerId) {
          logger.info(`Container exited successfully: ${containerId}`)
        },
      })
    } catch (error) {
      logger.error('Error in runStartHandler', { error })

      await reportRunError({
        runId: data.runStartEdge.runId,
        vaultId: data.runStartEdge.vaultId,
        errorMessage: `Error starting run: ${(error as Error).message}`,
      })
    }
  },
}
