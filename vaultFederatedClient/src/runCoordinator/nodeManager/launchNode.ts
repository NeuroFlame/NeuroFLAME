import Docker from 'dockerode'
import { logger } from '../../logger.js'
const docker = new Docker()

interface LaunchNodeArgs {
  containerService: string
  imageName: string
  runId: string
  consortiumId: string
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

// Track running containers for graceful shutdown and heartbeat reporting
export interface RunningContainer {
  containerId: string
  runId: string
  consortiumId: string
  startedAt: Date
}

const runningContainers = new Map<string, RunningContainer>()

interface ExposedPorts {
  [portWithProtocol: string]: {} // Correctly defined for exposing ports
}

interface PortBindings {
  [portWithProtocol: string]: Array<{ HostPort: string }> // Define port bindings with HostPort as string
}

export async function launchNode({
  containerService,
  imageName,
  runId,
  consortiumId,
  directoriesToMount,
  portBindings,
  commandsToRun,
  onContainerExitSuccess,
  onContainerExitError,
}: LaunchNodeArgs) {
  if (containerService === 'docker') {
    await launchDockerNode({
      imageName,
      runId,
      consortiumId,
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
  runId,
  consortiumId,
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

    // Track the running container
    runningContainers.set(container.id, {
      containerId: container.id,
      runId,
      consortiumId,
      startedAt: new Date(),
    })
    logger.info(`Tracking container ${container.id} for run ${runId} in consortium ${consortiumId}`)

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

    // Remove from tracking
    runningContainers.delete(containerId)
    logger.info(`Container ${containerId} removed from tracking`)

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
    // Remove from tracking on error too
    runningContainers.delete(containerId)
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

/**
 * Get list of currently running containers
 */
export function getRunningContainers(): RunningContainer[] {
  return Array.from(runningContainers.values())
}

/**
 * Get count of running containers
 */
export function getRunningContainerCount(): number {
  return runningContainers.size
}

/**
 * Stop a specific container gracefully
 * @param containerId - The container ID to stop
 * @param timeoutSeconds - Seconds to wait before force killing (default: 10)
 */
export async function stopContainer(
  containerId: string,
  timeoutSeconds: number = 10,
): Promise<void> {
  const container = docker.getContainer(containerId)
  const containerInfo = runningContainers.get(containerId)

  logger.info(
    `Stopping container ${containerId}${containerInfo ? ` (run: ${containerInfo.runId})` : ''}`,
  )

  try {
    // Stop with timeout - sends SIGTERM, then SIGKILL after timeout
    await container.stop({ t: timeoutSeconds })
    logger.info(`Container ${containerId} stopped successfully`)
  } catch (error: unknown) {
    const err = error as { statusCode?: number; message?: string }
    // Container may have already stopped
    if (err.statusCode === 304) {
      logger.info(`Container ${containerId} was already stopped`)
    } else {
      logger.error(`Error stopping container ${containerId}`, { error })
      throw error
    }
  } finally {
    runningContainers.delete(containerId)
  }
}

/**
 * Stop all running containers gracefully
 * @param timeoutSeconds - Seconds to wait per container before force killing
 * @returns Object with counts of stopped and failed containers
 */
export async function stopAllContainers(
  timeoutSeconds: number = 10,
): Promise<{ stopped: number; failed: number; runIds: string[] }> {
  const containers = getRunningContainers()
  const runIds: string[] = []
  let stopped = 0
  let failed = 0

  if (containers.length === 0) {
    logger.info('No running containers to stop')
    return { stopped, failed, runIds }
  }

  logger.info(`Stopping ${containers.length} running container(s)...`)

  for (const { containerId, runId } of containers) {
    try {
      await stopContainer(containerId, timeoutSeconds)
      stopped++
      runIds.push(runId)
    } catch (error) {
      failed++
      logger.error(`Failed to stop container ${containerId}`, { error })
    }
  }

  logger.info(`Container cleanup complete: ${stopped} stopped, ${failed} failed`)
  return { stopped, failed, runIds }
}
