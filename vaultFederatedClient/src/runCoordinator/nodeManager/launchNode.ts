import Docker from 'dockerode'
import { spawn, spawnSync } from 'child_process'
import { promises as fs } from 'fs'
import * as path from 'path'
import { logger } from '../../logger.js'
import { VAULT_BASE_DIR } from '../../config.js'
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
  runtime: 'docker' | 'singularity'
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
    await launchSingularityNode({
      imageName,
      runId,
      consortiumId,
      directoriesToMount,
      portBindings,
      commandsToRun,
      onContainerExitSuccess,
      onContainerExitError,
    })
  } else {
    throw new Error(
      `Unsupported container service "${containerService}". Expected "docker" or "singularity".`,
    )
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
      runtime: 'docker',
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

const launchSingularityNode = async ({
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
    `Attempting to launch Singularity container from imageName: ${imageName}`,
  )

  try {
    const singularityBinary = detectSingularityOrApptainer()
    const imagePath = await findSingularityImage(imageName)

    const bindMounts: string[] = directoriesToMount.map(
      (mount) => `${mount.hostDirectory}:${mount.containerDirectory}:rw`,
    )

    const envVars: string[] = []
    if (process.env.CI === 'true') {
      envVars.push('CI=true')
    }

    const singularityArgs: string[] = [
      'run',
      '--containall',
      '--writable-tmpfs',
      '-e',
    ]

    if (envVars.length > 0) {
      singularityArgs.push('--env', envVars.join(','))
    }

    if (bindMounts.length > 0) {
      singularityArgs.push('-B', bindMounts.join(','))
    }

    singularityArgs.push(imagePath)

    if (commandsToRun.length > 0) {
      singularityArgs.push(...commandsToRun)
    }

    if (portBindings.length > 0) {
      logger.warn(
        'Port bindings are ignored for singularity/apptainer because host networking is used by default.',
      )
    }

    logger.info(
      `Running Singularity command: ${singularityBinary} ${singularityArgs.join(' ')}`,
    )

    const instanceProcess = spawn(singularityBinary, singularityArgs, {
      stdio: ['ignore', 'pipe', 'pipe'],
    })

    const containerId = instanceProcess.pid
      ? `singularity-${instanceProcess.pid}`
      : `singularity-${Date.now()}`

    logger.info(`Singularity container started successfully: ${containerId}`)

    runningContainers.set(containerId, {
      containerId,
      runId,
      consortiumId,
      startedAt: new Date(),
      runtime: 'singularity',
    })
    logger.info(
      `Tracking singularity process ${containerId} for run ${runId} in consortium ${consortiumId}`,
    )

    instanceProcess.stdout?.on('data', (data: Buffer) => {
      const output = data.toString()
      logger.info(`Singularity Container [${containerId}] stdout: ${output.trim()}`)
    })

    instanceProcess.stderr?.on('data', (data: Buffer) => {
      const output = data.toString()
      logger.info(`Singularity Container [${containerId}] stderr: ${output.trim()}`)
    })

    attachSingularityEventHandlers({
      instanceProcess,
      containerId,
      onContainerExitSuccess,
      onContainerExitError,
    })

    return containerId
  } catch (error) {
    logger.error(
      `Failed to launch Singularity container: ${(error as Error).message}`,
    )
    throw error
  }
}

const attachSingularityEventHandlers = ({
  instanceProcess,
  containerId,
  onContainerExitSuccess,
  onContainerExitError,
}: {
  instanceProcess: ReturnType<typeof spawn>
  containerId: string
  onContainerExitSuccess?: (containerId: string) => void
  onContainerExitError?: (containerId: string, error: string) => void
}) => {
  let capturedStdout = ''
  let capturedStderr = ''

  instanceProcess.stdout?.on('data', (data: Buffer) => {
    capturedStdout += data.toString()
  })

  instanceProcess.stderr?.on('data', (data: Buffer) => {
    capturedStderr += data.toString()
  })

  instanceProcess.on('close', (code: number | null) => {
    runningContainers.delete(containerId)
    logger.info(`Container ${containerId} removed from tracking`)

    if (code === null) {
      logger.error(`Container ${containerId} exited with null code`)
      onContainerExitError &&
        onContainerExitError(containerId, 'Process exited with null code')
      return
    }

    if (code !== 0) {
      const errorMessage = capturedStderr || capturedStdout || `Exit Code: ${code}`
      logger.error(
        `Container ${containerId} exited with error code ${code}`,
      )
      logger.error(`Error output: ${errorMessage}`)
      onContainerExitError &&
        onContainerExitError(containerId, errorMessage)
    } else {
      logger.info(`Container ${containerId} exited successfully.`)
      onContainerExitSuccess && onContainerExitSuccess(containerId)
    }
  })

  instanceProcess.on('error', (error: Error) => {
    runningContainers.delete(containerId)
    logger.error(
      `Failed to start Singularity container: ${error.message}`,
    )
    onContainerExitError &&
      onContainerExitError(containerId, error.message)
  })
}

const detectSingularityOrApptainer = (): string => {
  const singularityCheck = spawnSync('which', ['singularity'])
  if (singularityCheck.status === 0) {
    return 'singularity'
  }

  const apptainerCheck = spawnSync('which', ['apptainer'])
  if (apptainerCheck.status === 0) {
    return 'apptainer'
  }

  throw new Error(
    'Neither Singularity nor Apptainer is installed. Please install one of them.',
  )
}

const findSingularityImage = async (imageName: string): Promise<string> => {
  const singularityImagesDir = path.join(
    VAULT_BASE_DIR,
    'singularityImages',
  )

  if (path.isAbsolute(imageName) && imageName.endsWith('.sif')) {
    try {
      await fs.access(imageName)
      return imageName
    } catch {
      throw new Error(`Singularity image not found at path: ${imageName}`)
    }
  }

  if (imageName.endsWith('.sif')) {
    try {
      await fs.access(imageName)
      return path.resolve(imageName)
    } catch {
      // continue to pattern search
    }
  }

  const localImagePattern = imageName
    .replace(/:latest$/, '')
    .replace(/[:@]/g, '_')
    .replace(/\//g, '_')
    .toLowerCase()

  const searchPaths = [
    singularityImagesDir,
    process.cwd(),
    path.join(process.cwd(), 'images'),
    '/tmp',
  ]

  for (const searchPath of searchPaths) {
    try {
      const files = await fs.readdir(searchPath)
      const matchingFile = files.find(
        (file) =>
          file.endsWith('.sif') && file.includes(localImagePattern),
      )
      if (matchingFile) {
        const imagePath = path.join(searchPath, matchingFile)
        logger.info(`Found Singularity image at: ${imagePath}`)
        return imagePath
      }
    } catch {
      continue
    }
  }

  throw new Error(
    `No Singularity image found matching "${imageName}". Searched for pattern "${localImagePattern}.sif" in: ${searchPaths.join(', ')}`,
  )
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
  const containerInfo = runningContainers.get(containerId)

  logger.info(
    `Stopping container ${containerId}${containerInfo ? ` (run: ${containerInfo.runId}, runtime: ${containerInfo.runtime})` : ''}`,
  )

  if (containerInfo?.runtime === 'singularity') {
    const pidMatch = /^singularity-(\d+)$/.exec(containerId)
    if (!pidMatch) {
      runningContainers.delete(containerId)
      logger.warn(
        `Cannot parse singularity process id from "${containerId}". Removed from tracking only.`,
      )
      return
    }
    const pid = Number(pidMatch[1])
    try {
      process.kill(pid, 'SIGTERM')
      logger.info(`Signaled singularity process ${pid} for stop`)
    } catch (error: unknown) {
      const err = error as NodeJS.ErrnoException
      if (err.code === 'ESRCH') {
        logger.info(`Singularity process ${pid} was already stopped`)
      } else {
        logger.error(`Error stopping singularity process ${pid}`, { error })
        throw error
      }
    } finally {
      runningContainers.delete(containerId)
    }
    return
  }

  const container = docker.getContainer(containerId)
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
