import path from 'path'
import fs from 'fs'
import { provisionRun } from './provisionRun/provisionRun.js'
import { reservePort } from './portManagement.js'
import { launchNode } from '../../nodeManager/launchNode.js'
import uploadToFileServer from './uploadToFileServer.js'
import { uploadResultsToFileServer } from './uploadResultsToFileServer.js'
import reportRunError from '../../report/reportRunError.js'
import reportRunComplete from '../../report/reportRunComplete.js'
import { logger } from '../../../logger.js'
import { BASE_DIR, FQDN, HOSTING_PORT_END, HOSTING_PORT_START, FILE_SERVER_URL, ACCESS_TOKEN } from '../../../config.js'

export type MemberRole = 'contributor' | 'observer'
export type UserRolesMap = Record<string, MemberRole>

interface StartRunArgs {
  imageName: string
  userIds: string[]
  userRoles?: UserRolesMap
  consortiumId: string
  runId: string
  computationParameters: string
}

export default async function startRun({
  imageName,
  userIds,
  userRoles = {},
  consortiumId,
  runId,
  computationParameters,
}: StartRunArgs) {
  logger.info(`Starting run ${runId} for consortium ${consortiumId}`)

  const pathRun = path.join(BASE_DIR, 'runs', consortiumId, runId)
  const pathCentralNodeRunKit = path.join(pathRun, 'runKits', 'centralNode')
  const pathRunOutput = path.join(pathRun, 'output')
  const hostingPortRange = {
    start: HOSTING_PORT_START,
    end: HOSTING_PORT_END,
  }

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
      userRoles,
      pathRun,
      computationParameters,
      fedLearnPort,
      adminPort,
      FQDN,
    })

    // Ensure output directory exists (mounted into /workspace/output)
    await fs.promises.mkdir(pathRunOutput, { recursive: true })

    // Upload run data to the file server
    logger.info(`Uploading runKits for run ${runId}`)
    await uploadToFileServer({
      consortiumId,
      runId,
      pathBaseDirectory: BASE_DIR,
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
        {
          hostDirectory: pathRunOutput,
          containerDirectory: '/workspace/output',
        },
      ],
      portBindings: [
        { hostPort: fedLearnPort, containerPort: fedLearnPort },
        { hostPort: adminPort, containerPort: adminPort },
      ],
      commandsToRun: ['python', '/workspace/system/entry_central.py'],
      env: {
        NEUROFLAME_FILESERVER_URL: FILE_SERVER_URL,
        NEUROFLAME_CONSORTIUM_ID: consortiumId,
        NEUROFLAME_RUN_ID: runId,
        NEUROFLAME_ACCESS_TOKEN: ACCESS_TOKEN,
      },
      onContainerExitSuccess: async () => {
        try {
          await uploadResultsToFileServer({ consortiumId, runId, pathRunOutput })
        } catch (e) {
          logger.error('Failed to upload results to fileServer', { error: e, runId, consortiumId })
        }
        return reportRunComplete({ runId })
      },
      onContainerExitError: (_, error) =>
        reportRunError({ runId, errorMessage: error }),
    })
  } catch (error) {
    logger.error('Start Run Failed', { error })
    await reportRunError({ runId, errorMessage: (error as Error).message })
  }
}
