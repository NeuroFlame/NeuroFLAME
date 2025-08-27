import path from 'path'
import fs from 'fs'
import { launchNode } from '../../../nodeManager/launchNode.js'
import { prepareHostingDirectory } from './prepareHostingDirectory.js'

interface provisionRunArgs {
  imageName: string
  userIds: string[]
  pathRun: string
  computationParameters: string
  fedLearnPort: number
  adminPort: number
  FQDN: string
}

export async function provisionRun({
  imageName,
  userIds,
  computationParameters,
  pathRun,
  fedLearnPort,
  adminPort,
  FQDN,
}: provisionRunArgs) {
  const pathHosting = path.join(pathRun, 'hosting')

  await ensureDirectoryExists(pathRun)
  await ensureDirectoryExists(pathHosting)

  // make the input
  const provisionInput = {
    user_ids: userIds,
    computation_parameters: computationParameters,
    fed_learn_port: fedLearnPort,
    admin_port: adminPort,
    host_identifier: FQDN,
  }

  // save the file
  const pathProvisionInput = path.join(pathRun, 'provision_input.json')
  await fs.promises.writeFile(
    pathProvisionInput,
    JSON.stringify(provisionInput, null, 2),
  )

  // set proper permissions
  await fs.promises.chmod(pathProvisionInput, 0o644)

  // wait for the file to be created
  await new Promise((r) => setTimeout(r, 1000))

  // launch the container and await its completion
  // throw errors appropriately here
  await new Promise((resolve, reject) => {
    launchNode({
      containerService: 'docker',
      imageName,
      directoriesToMount: [
        { hostDirectory: pathRun, containerDirectory: '/provisioning/' },
      ],
      portBindings: [],
      commandsToRun: ['python', '/workspace/system/entry_provision.py'],
      onContainerExitSuccess: async (containerId) => resolve(void 0),
    })
  })

  const pathRunKits = path.join(pathRun, 'runKits')
  await prepareHostingDirectory({
    sourceDir: pathRunKits,
    targetDir: pathHosting,
    exclude: ['centralNode'],
  })
}

async function ensureDirectoryExists(directoryPath: string): Promise<void> {
  try {
    await fs.promises.mkdir(directoryPath, { recursive: true })
    // logger.info(`Directory ensured: ${directoryPath}`)
  } catch (error) {
    if ((error as { code?: string }).code === 'EEXIST') {
      return
    }
    throw error
  }
}
