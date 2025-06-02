import { getConfig } from '../../../config/config.js'
import downloadFile from './downloadFile.js'
import { launchNode } from '../../nodeManager/launchNode.js'
import path from 'path'
import { unzipFile } from './unzipFile.js'
import fs from 'fs/promises'
import { logger } from '../../../logger.js'
import reportRunError from '../../report/reportRunError.js'

export const RUN_START_SUBSCRIPTION = `
subscription runStartSubscription {
    runStartEdge {
        consortiumId
        runId
        imageName
        downloadUrl
        downloadToken
    }
}`

export const runStartHandler = {
  error: (err: any) =>
    logger.error(`Run Start - Subscription error`, { error: err }),
  complete: () => logger.info('Run Start - Subscription completed'),
  next: async ({ data }: { data: any }) => {
    logger.info('Run Start - Received data')
    try {
      const {
        consortiumId,
        runId,
        imageName,
        downloadUrl,
        downloadToken,
      } = data.runStartEdge

      const { path_base_directory } = await getConfig()

      const consortiumPath = path.join(path_base_directory, consortiumId)
      const runPath = path.join(consortiumPath, runId)
      const runKitPath = path.join(runPath, 'runKit')
      const resultsPath = path.join(runPath, 'results')

      // Ensure all paths exist and are writable and executable
      await fs.mkdir(consortiumPath, { recursive: true, mode: 0o777 })
      await fs.mkdir(runPath, { recursive: true, mode: 0o777 })
      await fs.mkdir(runKitPath, { recursive: true, mode: 0o777 })
      await fs.mkdir(resultsPath, { recursive: true, mode: 0o777 })

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
        },
        {
          hostDirectory: resultsPath,
          containerDirectory: '/workspace/output',
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
        })
      } catch (e) {
        logger.error(`Failed to read or parse mount configuration: ${e}`)
        throw new Error('Failed to load mount configuration')
      }

      // Launch the node
      await launchNode({
        containerService: 'docker',
        imageName,
        directoriesToMount,
        portBindings: [],
        commandsToRun: ['python', '/workspace/system/entry_edge.py'],
        onContainerExitError: async (containerId, error) => {
          logger.error(`Error in container: ${containerId}`, { error: error })
          reportRunError({
            runId,
            errorMessage: `Error in container: ${containerId}`,
          })
        },
        onContainerExitSuccess(containerId) {
          logger.info(`Container exited successfully: ${containerId}`)
        },
      })
    } catch (error) {
      logger.error('Error in runStartHandler', { error: error })

      await reportRunError({
        runId: data.runStartEdge.runId,
        errorMessage: `Error starting run: ${(error as Error).message}`,
      })
    }
  },
}
