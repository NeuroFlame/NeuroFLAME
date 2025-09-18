import path from 'path'
import { provisionRun } from './provisionRun/provisionRun.js'
import { reservePort } from './portManagement.js'
import { launchNode } from '../../nodeManager/launchNode.js'
import uploadToFileServer from './uploadToFileServer.js'
import getConfig from '../../../config/getConfig.js'
import reportRunError from '../../report/reportRunError.js'
import reportRunComplete from '../../report/reportRunComplete.js'
import { logger } from '../../../logger.js'

interface StartRunArgs {
  imageName: string
  userIds: string[]
  consortiumId: string
  runId: string
  computationParameters: string
}

export default async function startRun({
  imageName,
  userIds,
  consortiumId,
  runId,
  computationParameters,
}: StartRunArgs) {
  logger.info(`Starting run ${runId} for consortium ${consortiumId}`)

  const config = await getConfig()
  const pathBaseDir = config.baseDir
  const pathRun = path.join(pathBaseDir, 'runs', consortiumId, runId)
  const pathCentralNodeRunKit = path.join(pathRun, 'runKits', 'centralNode')
  const { FQDN, hostingPortRange } = config

  try {
    // Reserve ports for federated learning and admin servers
    const {
      port: reservedFedLearnPort,
      server: fedLearnServer,
    } = await reservePort(hostingPortRange)
    const {
      port: reservedAdminPort,
      server: adminServer,
    } = await reservePort(hostingPortRange)
    const fedLearnPort = reservedFedLearnPort
    const adminPort = reservedAdminPort

    // Provision the run
    logger.info(`Provisioning run ${runId}`)
    await provisionRun({
      imageName,
      userIds,
      pathRun,
      computationParameters,
      fedLearnPort,
      adminPort,
      FQDN,
    })

    // Upload run data to the file server
    logger.info(`Uploading runKits for run ${runId}`)
    await uploadToFileServer({
      consortiumId,
      runId,
      pathBaseDirectory: pathBaseDir,
    })

    // Close the reserved servers before launching the Docker container
    fedLearnServer.close()
    adminServer.close()

    // Launch the Docker node
    await launchNode({
      containerService: 'docker',
      imageName,
      directoriesToMount: [
        {
          hostDirectory: pathCentralNodeRunKit,
          containerDirectory: '/workspace/runKit/',
        },
      ],
      portBindings: [
        { hostPort: fedLearnPort, containerPort: fedLearnPort },
        { hostPort: adminPort, containerPort: adminPort },
      ],
      commandsToRun: ['python', '/workspace/system/entry_central.py'],
      onContainerExitSuccess: () => reportRunComplete({ runId }),
      onContainerExitError: (_, error) =>
        reportRunError({ runId, errorMessage: error }),
    })
  } catch (error) {
    logger.error('Start Run Failed', { error })
    await reportRunError({ runId, errorMessage: (error as Error).message })
  }
}
