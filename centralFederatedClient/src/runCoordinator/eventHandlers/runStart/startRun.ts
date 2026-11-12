import path from 'path'
import { promises as fs } from 'fs'
import { provisionRun } from './provisionRun/provisionRun.js'
import { reservePort } from './portManagement.js'
import {
  launchNode,
  resolveDockerComputationImage,
} from '../../nodeManager/launchNode.js'
import uploadToFileServer from './uploadToFileServer.js'
import reportRunError from '../../report/reportRunError.js'
import reportRunComplete from '../../report/reportRunComplete.js'
import { logger } from '../../../logger.js'
import {
  BASE_DIR,
  COMPUTATION_IMAGE_MODE,
  FQDN,
  HOSTING_PORT_END,
  HOSTING_PORT_START,
} from '../../../config.js'
import { readTerminalError } from '../../terminalError.js'

interface ActiveParticipant {
  participantId: string
  kind: string
  displayName: string
  userId?: string | null
  vaultId?: string | null
}

interface StartRunArgs {
  imageName: string
  activeParticipants: ActiveParticipant[]
  consortiumId: string
  runId: string
  computationParameters: string
  requiredComputationApiVersion: string
}

export default async function startRun({
  imageName,
  activeParticipants,
  consortiumId,
  runId,
  computationParameters,
  requiredComputationApiVersion,
}: StartRunArgs) {
  logger.info(`Starting run ${runId} for consortium ${consortiumId}`)

  const pathRun = path.join(BASE_DIR, 'runs', consortiumId, runId)
  const pathCentralNodeRunKit = path.join(pathRun, 'runKits', 'centralNode')
  const pathCentralResults = path.join(pathRun, 'central-results')
  const hostingPortRange = {
    start: HOSTING_PORT_START,
    end: HOSTING_PORT_END,
  }
  let fedLearnReservation: Awaited<ReturnType<typeof reservePort>> | undefined

  try {
    const resolvedImage = await resolveDockerComputationImage(
      imageName,
      requiredComputationApiVersion,
      COMPUTATION_IMAGE_MODE,
    )
    await fs.mkdir(pathCentralResults, { recursive: true, mode: 0o700 })
    await fs.chmod(pathCentralResults, 0o700)

    // NVFlare 2.8 uses one externally routed server port for this computation API.
    fedLearnReservation = await reservePort({
      ...hostingPortRange,
      imageName: resolvedImage.reference,
    })
    const fedLearnPort = fedLearnReservation.port

    // Provision the run
    logger.info(`Provisioning run ${runId}`)
    await provisionRun({
      imageName: resolvedImage.reference,
      activeParticipants,
      pathRun,
      computationParameters,
      fedLearnPort,
      FQDN,
    })

    // Upload run data to the file server
    logger.info(`Uploading runKits for run ${runId}`)
    await uploadToFileServer({
      consortiumId,
      runId,
      pathBaseDirectory: BASE_DIR,
    })

    // Free the host port for Docker to bind; the in-process claim keeps other
    // runs from taking it until the central node is running (or has failed).
    await fedLearnReservation.releaseHold()

    // Launch the Docker node
    const centralContainerId = await launchNode({
      containerService: 'docker',
      imageName: resolvedImage.reference,
      directoriesToMount: [
        {
          hostDirectory: pathCentralNodeRunKit,
          containerDirectory: '/workspace/runKit/',
        },
        {
          hostDirectory: pathCentralResults,
          containerDirectory: '/workspace/output/',
        },
      ],
      portBindings: [{ hostPort: fedLearnPort, containerPort: fedLearnPort }],
      commandsToRun: ['python', '/workspace/system/entry_central.py'],
      failureLogPath: path.join(pathRun, 'central-failed-container.log'),
      onContainerExitSuccess: () => reportRunComplete({ runId }),
      onContainerExitError: async (_, error) => {
        let terminalError: Awaited<ReturnType<typeof readTerminalError>>
        try {
          terminalError = await readTerminalError(pathCentralResults)
        } catch (markerError) {
          logger.error('Failed to read the central terminal error marker', {
            error: markerError,
            runId,
          })
        }
        if (terminalError?.origin === 'site') {
          logger.info('Central container relayed a site failure; not recording it twice', {
            runId,
          })
          return
        }
        await reportRunError({
          runId,
          errorMessage:
            terminalError?.displayMessage ?? `Central runtime failure: ${error}`,
        })
      },
    })
    return { resolvedImage, centralContainerId }
  } finally {
    if (fedLearnReservation) {
      try {
        await fedLearnReservation.release()
      } catch (releaseError) {
        logger.error('Failed to release reserved federation port', {
          error: releaseError,
          runId,
        })
      }
    }
  }
}
