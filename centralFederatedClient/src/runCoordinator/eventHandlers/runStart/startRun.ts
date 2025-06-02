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
  const path_baseDir = config.baseDir
  const path_run = path.join(path_baseDir, 'runs', consortiumId, runId)
  const path_centralNodeRunKit = path.join(path_run, 'runKits', 'centralNode')
  const { FQDN, hostingPortRange } = config

  try {
    // Reserve ports for federated learning and admin servers
    const {
      port: reserved_fed_learn_port,
      server: fed_learn_server,
    } = await reservePort(hostingPortRange)
    const {
      port: reserved_admin_port,
      server: admin_server,
    } = await reservePort(hostingPortRange)
    const fed_learn_port = reserved_fed_learn_port
    const admin_port = reserved_admin_port

    // Provision the run
    logger.info(`Provisioning run ${runId}`)
    await provisionRun({
      image_name: imageName,
      userIds,
      path_run,
      computationParameters,
      fed_learn_port,
      admin_port,
      FQDN,
    })

    // Upload run data to the file server
    logger.info(`Uploading runKits for run ${runId}`)
    await uploadToFileServer({
      consortiumId,
      runId,
      path_baseDirectory: path_baseDir,
    })

    // Close the reserved servers before launching the Docker container
    fed_learn_server.close()
    admin_server.close()

    // Launch the Docker node
    await launchNode({
      containerService: 'docker',
      imageName,
      directoriesToMount: [
        {
          hostDirectory: path_centralNodeRunKit,
          containerDirectory: '/workspace/runKit/',
        },
      ],
      portBindings: [
        { hostPort: fed_learn_port, containerPort: fed_learn_port },
        { hostPort: admin_port, containerPort: admin_port },
      ],
      commandsToRun: ['python', '/workspace/system/entry_central.py'],
      onContainerExitSuccess: () => reportRunComplete({ runId }),
      onContainerExitError: (_, error) =>
        reportRunError({ runId, errorMessage: error }),
    })
  } catch (error) {
    logger.error(`Start Run Failed`, { error: error })
    await reportRunError({ runId, errorMessage: (error as Error).message })
  }
}
