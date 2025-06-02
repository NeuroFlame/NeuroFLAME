import Docker from 'dockerode'
import { logger } from '../../logger.js'
const docker = new Docker()

interface LaunchNodeArgs {
  containerService: string
  imageName: string
  directoriesToMount: Array<{
    hostDirectory: string
    containerDirectory: string
  }>
  portBindings: Array<{
    hostPort: number
    containerPort: number
  }>
  commandsToRun: string[]
  onContainerExitSuccess?: (containerId: string) => void
  onContainerExitError?: (containerId: string, error: string) => void
}

interface ExposedPorts {
  [portWithProtocol: string]: {} // Correctly defined for exposing ports
}

interface PortBindings {
  [portWithProtocol: string]: Array<{ HostPort: string }> // Define port bindings with HostPort as string
}

export async function launchNode({
  containerService,
  imageName,
  directoriesToMount,
  portBindings,
  commandsToRun,
  onContainerExitSuccess,
  onContainerExitError,
}: LaunchNodeArgs) {
  if (containerService === 'docker') {
    await launchDockerNode({
      imageName,
      directoriesToMount,
      portBindings,
      commandsToRun,
      onContainerExitSuccess,
      onContainerExitError,
    })
  } else if (containerService === 'singularity') {
    // Placeholder for singularity command handling
    logger.info('Singularity handling not implemented.')
  }
}

const launchDockerNode = async ({
  imageName,
  directoriesToMount,
  portBindings,
  commandsToRun,
  onContainerExitSuccess,
  onContainerExitError,
}: Omit<LaunchNodeArgs, 'containerService'>) => {
  logger.info(
    `Attempting to launch Docker container from imageName: ${imageName}`,
  )

  const binds = directoriesToMount.map(
    (mount) => `${mount.hostDirectory}:${mount.containerDirectory}`,
  )
  const exposedPorts: ExposedPorts = {}
  const portBindingsFormatted: PortBindings = {}

  portBindings.forEach((binding) => {
    const containerPort = `${binding.containerPort}/tcp`
    exposedPorts[containerPort] = {} // Just expose the port
    portBindingsFormatted[containerPort] = [{ HostPort: `${binding.hostPort}` }] // Correctly format as string
  })

  try {

    await isDockerRunning()
    await doesImageExist(imageName)

    // Create the container
    const container = await docker.createContainer({
      Image: imageName,
      Cmd: commandsToRun,
      ExposedPorts: exposedPorts,
      HostConfig: {
        Binds: binds,
        PortBindings: portBindingsFormatted,
      },
    })

    // Start the container
    await container.start()
    logger.info(`Container started successfully: ${container.id}`)

    // Add event handlers for the container
    attachDockerEventHandlers({
      containerId: container.id,
      onContainerExitSuccess,
      onContainerExitError,
    })

    // Return the container ID
    return container.id
  } catch (error) {
    logger.error(
      `Failed to launch Docker container: ${(error as Error).message}`,
    )
    throw error
  }
}

const attachDockerEventHandlers = async ({
  containerId,
  onContainerExitSuccess,
  onContainerExitError,
}: {
  containerId: string
  onContainerExitSuccess?: (containerId: string) => void
  onContainerExitError?: (containerId: string, error: string) => void
}) => {
  const container = docker.getContainer(containerId)

  try {
    const { StatusCode } = await container.wait()
    if (StatusCode !== 0) {
      logger.error(
        `Container ${containerId} exited with error code ${StatusCode}`,
      )
      onContainerExitError &&
        onContainerExitError(containerId, `Exit Code: ${StatusCode}`)
    } else {
      logger.info(`Container ${containerId} exited successfully.`)
      onContainerExitSuccess && onContainerExitSuccess(containerId)
    }
  } catch (error) {
    logger.error(`Error waiting for container ${containerId}`, { error })
    onContainerExitError &&
      onContainerExitError(containerId, (error as Error).message)
  }
}

const isDockerRunning = async () => {
  try {
    await docker.ping()
  } catch (error) {
    throw new Error(
      'Docker is not running. Please ensure the Docker daemon is active.',
    )
  }
}

const doesImageExist = async (imageName: string) => {
  try {
    const images = await docker.listImages({
      filters: { reference: [imageName] },
    })
    if (images.length === 0) {
      throw new Error(
        `Image "${imageName}" does not exist. Please pull the image or verify its name.`,
      )
    }
  } catch (error) {
    throw new Error(
      `Failed to check existence of image "${imageName}": ${
        (error as Error).message
      }`,
    )
  }
}
