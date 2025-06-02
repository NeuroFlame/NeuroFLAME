import path from 'path'
import fs from 'fs'
import { launchNode } from '../../../nodeManager/launchNode.js'
import { prepareHostingDirectory } from './prepareHostingDirectory.js'

interface provisionRunArgs {
  image_name: string
  userIds: string[]
  path_run: string
  computationParameters: string
  fed_learn_port: number
  admin_port: number
  FQDN: string
}

export async function provisionRun({
  image_name,
  userIds,
  computationParameters,
  path_run,
  fed_learn_port,
  admin_port,
  FQDN,
}: provisionRunArgs) {
  const path_hosting = path.join(path_run, 'hosting')

  await ensureDirectoryExists(path_run)
  await ensureDirectoryExists(path_hosting)

  // make the input
  const provision_input = {
    user_ids: userIds,
    computation_parameters: computationParameters,
    fed_learn_port,
    admin_port,
    host_identifier: FQDN,
  }

  // save the file
  const path_provision_input = path.join(path_run, 'provision_input.json')
  await fs.promises.writeFile(
    path_provision_input,
    JSON.stringify(provision_input, null, 2),
  )

  // launch the container and await its completion
  // throw errors appropriately here
  await new Promise((resolve, reject) => {
    launchNode({
      containerService: 'docker',
      imageName: image_name,
      directoriesToMount: [
        { hostDirectory: path_run, containerDirectory: '/provisioning/' },
      ],
      portBindings: [],
      commandsToRun: [`python`, `/workspace/system/entry_provision.py`],
      onContainerExitSuccess: async (containerId) => {
        return resolve(void 0)
      },
    })
  })

  const path_runKits = path.join(path_run, 'runKits')
  await prepareHostingDirectory({
    sourceDir: path_runKits,
    targetDir: path_hosting,
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
