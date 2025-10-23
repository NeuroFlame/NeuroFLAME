// startRun.ts — launches the container and starts the local nvflare_report.py watcher (no --timeout)

import path from 'path'
import { provisionRun } from './provisionRun/provisionRun.js'
import { reservePort } from './portManagement.js'
import { launchNode } from '../../nodeManager/launchNode.js'
import uploadToFileServer from './uploadToFileServer.js'
import getConfig from '../../../config/getConfig.js'
import reportRunError from '../../report/reportRunError.js'
import reportRunComplete from '../../report/reportRunComplete.js'
import { logger } from '../../../logger.js'
import { scheduleNvflareWatcher, defaultCentralRootFromEnvOrGuess } from './runWatcher.js'

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
  const pathBaseDir = (config as any).baseDir ?? defaultCentralRootFromEnvOrGuess()
  const pathRun = path.join(pathBaseDir, 'runs', consortiumId, runId)
  const pathCentralNodeRunKit = path.join(pathRun, 'runKits', 'centralNode')
  const { FQDN, hostingPortRange } = config as any

  try {
    const { port: reservedFedLearnPort, server: fedLearnServer } = await reservePort(hostingPortRange)
    const { port: reservedAdminPort, server: adminServer } = await reservePort(hostingPortRange)
    const fedLearnPort = reservedFedLearnPort
    const adminPort = reservedAdminPort

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

    logger.info(`Uploading runKits for run ${runId}`)
    await uploadToFileServer({
      consortiumId,
      runId,
      pathBaseDirectory: pathBaseDir,
    })

    // Close the reserved listeners before launching the container
    fedLearnServer.close()
    adminServer.close()

    const runScopedStartup = path.join(
      pathBaseDir,
      'runs', consortiumId, runId,
      'runKits', 'centralNode', 'admin', 'startup'
    );

    void scheduleNvflareWatcher({
      tag: 'RUN',
      root: pathBaseDir,
      consortiumId,
      runId,
      logger,
      pollSec: 2,
      drainWindowSec: 180,
      unreachExit: 0,
      pretty: true,
      showClients: true,
      resilient: true,
      startDelaySec: 20,

      // 1) use the run-scoped startup we just built
      startupOverride: runScopedStartup,

      // 2) let the Python script auto-fallback if this one is unsigned
      extraArgs: [
        '--use-internal-admin',
        // we only need these for preflight/probing; harmless to keep
        '--force-host', 'host.docker.internal',
        '--force-admin-port', '3011',
        // pass IDs so Python can prioritize same-consortium fallbacks
        '--consortium', consortiumId,
        '--run', runId,
        '--insecure'
      ],

      env: {
        ...process.env,
        NVF_ADMIN_USER: process.env.NVF_ADMIN_USER || 'admin@admin.com',
        NVF_ADMIN_PWD:  process.env.NVF_ADMIN_PWD  || 'admin',
      },
    });

    logger.info(`Launching Docker node for run ${runId}`)
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
      onContainerExitError: (_code, error) =>
        reportRunError({ runId, errorMessage: error }),
    })
  } catch (error) {
    logger.error('Start Run Failed', { error })
    await reportRunError({ runId, errorMessage: (error as Error).message })
  }
}
