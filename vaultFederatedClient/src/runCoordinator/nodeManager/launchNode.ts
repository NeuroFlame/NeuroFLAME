import Docker from 'dockerode'
import { spawn, spawnSync } from 'child_process'
import { promises as fs } from 'fs'
import * as path from 'path'
import { logger } from '../../logger.js'
import { VAULT_BASE_DIR } from '../../config.js'
const docker = new Docker()

const MAX_FAILURE_LOG_BYTES = 1024 * 1024

interface LaunchNodeArgs {
  containerService: string
  imageName: string
  runId: string
  consortiumId: string
  directoriesToMount: Array<{
    hostDirectory: string
    containerDirectory: string
    readOnly?: boolean
  }>
  portBindings: Array<{
    hostPort: number
    containerPort: number
  }>
  commandsToRun: string[]
  failureLogPath?: string
  onContainerExitSuccess?: (containerId: string) => void | Promise<unknown>
  onContainerExitError?: (containerId: string, error: string) => void | Promise<unknown>
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
  failureLogPath,
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
      failureLogPath,
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
      failureLogPath,
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
  failureLogPath,
  onContainerExitSuccess,
  onContainerExitError,
}: Omit<LaunchNodeArgs, 'containerService'>) => {
  logger.info(
    `Attempting to launch Docker container from imageName: ${imageName}`,
  )

  const binds = directoriesToMount.map(
    (mount) =>
      `${mount.hostDirectory}:${mount.containerDirectory}:${mount.readOnly ? 'ro' : 'rw'}`,
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
    if (failureLogPath) {
      await removePreviousFailureLog(failureLogPath)
    }

    // Create the container
    const container = await docker.createContainer({
      Image: imageName,
      Cmd: commandsToRun,
      ExposedPorts: exposedPorts,
      HostConfig: {
        Binds: binds,
        CapDrop: ['ALL'],
        SecurityOpt: ['no-new-privileges:true'],
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
      failureLogPath,
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
  failureLogPath,
  onContainerExitSuccess,
  onContainerExitError,
}: {
  containerId: string
  failureLogPath?: string
  onContainerExitSuccess?: (containerId: string) => void | Promise<unknown>
  onContainerExitError?: (containerId: string, error: string) => void | Promise<unknown>
}) => {
  const container = docker.getContainer(containerId)

  try {
    let statusCode: number
    try {
      const waitResult = await container.wait()
      statusCode = waitResult.StatusCode
    } catch (waitError) {
      runningContainers.delete(containerId)
      logger.error(`Error waiting for container ${containerId}`, {
        error: waitError,
      })
      await captureFailedContainerLogs(container, failureLogPath)
      if (onContainerExitError) {
        await onContainerExitError(containerId, (waitError as Error).message)
      }
      return
    }

    // Remove from tracking
    runningContainers.delete(containerId)
    logger.info(`Container ${containerId} removed from tracking`)

    if (statusCode !== 0) {
      logger.error(
        `Container ${containerId} exited with error code ${statusCode}`,
      )
      await captureFailedContainerLogs(container, failureLogPath)
      if (onContainerExitError) {
        await onContainerExitError(containerId, `Exit Code: ${statusCode}`)
      }
    } else {
      logger.info(`Container ${containerId} exited successfully.`)
      if (onContainerExitSuccess) {
        await onContainerExitSuccess(containerId)
      }
    }
  } catch (handlerError) {
    // Remove from tracking on error too
    runningContainers.delete(containerId)
    logger.error(`Failed to handle exit for container ${containerId}`, {
      error: handlerError,
    })
  } finally {
    try {
      await container.remove()
      logger.info(`Removed completed container ${containerId}`)
    } catch (removeError) {
      logger.warn(`Failed to remove completed container ${containerId}`, {
        error: removeError,
      })
    }
  }
}

const captureFailedContainerLogs = async (
  container: ReturnType<typeof docker.getContainer>,
  failureLogPath?: string,
): Promise<void> => {
  if (!failureLogPath) {
    return
  }

  try {
    const rawLogs = await container.logs({
      stdout: true,
      stderr: true,
      timestamps: true,
      tail: 10000,
    })
    await writeFailureLog(failureLogPath, decodeDockerLogs(rawLogs))
    logger.info(`Saved failed-container logs to ${failureLogPath}`)
  } catch (logError) {
    logger.warn(`Could not save failed-container logs for ${container.id}`, {
      error: logError,
    })
  }
}

const removePreviousFailureLog = async (
  failureLogPath: string,
): Promise<void> => {
  try {
    await fs.unlink(failureLogPath)
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
      throw error
    }
  }
}

const writeFailureLog = async (
  failureLogPath: string,
  logContent: string,
): Promise<void> => {
  const logBuffer = Buffer.from(logContent, 'utf8')
  const wasTruncated = logBuffer.length > MAX_FAILURE_LOG_BYTES
  const retainedLogs = wasTruncated
    ? logBuffer.subarray(logBuffer.length - MAX_FAILURE_LOG_BYTES)
    : logBuffer
  const prefix = wasTruncated
    ? `[truncated to last ${MAX_FAILURE_LOG_BYTES} bytes]\n`
    : ''

  await fs.mkdir(path.dirname(failureLogPath), {
    recursive: true,
    mode: 0o700,
  })
  await fs.writeFile(
    failureLogPath,
    Buffer.concat([Buffer.from(prefix, 'utf8'), retainedLogs]),
    { mode: 0o600 },
  )
  await fs.chmod(failureLogPath, 0o600)
}

const captureFailedProcessLogs = async (
  failureLogPath: string | undefined,
  logContent: string,
): Promise<void> => {
  if (!failureLogPath) {
    return
  }
  try {
    await writeFailureLog(failureLogPath, logContent)
    logger.info(`Saved failed-container logs to ${failureLogPath}`)
  } catch (logError) {
    logger.warn(`Could not save failed-container logs to ${failureLogPath}`, {
      error: logError,
    })
  }
}

const decodeDockerLogs = (rawLogs: Buffer): string => {
  const chunks: Buffer[] = []
  let offset = 0

  while (offset + 8 <= rawLogs.length) {
    const streamType = rawLogs[offset]
    const payloadLength = rawLogs.readUInt32BE(offset + 4)
    const payloadStart = offset + 8
    const payloadEnd = payloadStart + payloadLength
    if (![0, 1, 2].includes(streamType) || payloadEnd > rawLogs.length) {
      return rawLogs.toString('utf8')
    }
    chunks.push(rawLogs.subarray(payloadStart, payloadEnd))
    offset = payloadEnd
  }

  return offset === rawLogs.length && chunks.length > 0
    ? Buffer.concat(chunks).toString('utf8')
    : rawLogs.toString('utf8')
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
    await docker.getImage(imageName).inspect()
  } catch (error) {
    const detail = (error as { statusCode?: number }).statusCode === 404
      ? `Image "${imageName}" does not exist. Please pull the image or verify its name.`
      : (error as Error).message
    throw new Error(
      `Failed to check existence of image "${imageName}": ${detail}`,
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
  failureLogPath,
  onContainerExitSuccess,
  onContainerExitError,
}: Omit<LaunchNodeArgs, 'containerService'>) => {
  logger.info(
    `Attempting to launch Singularity container from imageName: ${imageName}`,
  )

  try {
    const singularityBinary = detectSingularityOrApptainer()
    const imagePath = await findSingularityImage(imageName)
    if (failureLogPath) {
      await removePreviousFailureLog(failureLogPath)
    }

    const bindMounts: string[] = directoriesToMount.map(
      (mount) =>
        `${mount.hostDirectory}:${mount.containerDirectory}:${mount.readOnly ? 'ro' : 'rw'}`,
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

    attachSingularityEventHandlers({
      instanceProcess,
      containerId,
      failureLogPath,
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
  failureLogPath,
  onContainerExitSuccess,
  onContainerExitError,
}: {
  instanceProcess: ReturnType<typeof spawn>
  containerId: string
  failureLogPath?: string
  onContainerExitSuccess?: (containerId: string) => void | Promise<unknown>
  onContainerExitError?: (containerId: string, error: string) => void | Promise<unknown>
}) => {
  let capturedStdout = ''
  let capturedStderr = ''

  instanceProcess.stdout?.on('data', (data: Buffer) => {
    capturedStdout += data.toString()
  })

  instanceProcess.stderr?.on('data', (data: Buffer) => {
    capturedStderr += data.toString()
  })

  const handleClose = async (code: number | null): Promise<void> => {
    runningContainers.delete(containerId)
    logger.info(`Container ${containerId} removed from tracking`)

    if (code === null) {
      logger.error(`Container ${containerId} exited with null code`)
      await captureFailedProcessLogs(
        failureLogPath,
        capturedStderr || capturedStdout || 'Process exited with null code',
      )
      if (onContainerExitError) {
        await onContainerExitError(containerId, 'Process exited with null code')
      }
      return
    }

    if (code !== 0) {
      const errorMessage = capturedStderr || capturedStdout || `Exit Code: ${code}`
      logger.error(
        `Container ${containerId} exited with error code ${code}`,
      )
      await captureFailedProcessLogs(failureLogPath, errorMessage)
      if (onContainerExitError) {
        await onContainerExitError(containerId, `Exit Code: ${code}`)
      }
    } else {
      logger.info(`Container ${containerId} exited successfully.`)
      if (onContainerExitSuccess) {
        await onContainerExitSuccess(containerId)
      }
    }
  }

  const handleError = async (error: Error): Promise<void> => {
    runningContainers.delete(containerId)
    logger.error(
      `Failed to start Singularity container: ${error.message}`,
    )
    await captureFailedProcessLogs(
      failureLogPath,
      error.stack || error.message,
    )
    if (onContainerExitError) {
      await onContainerExitError(containerId, error.message)
    }
  }

  instanceProcess.on('close', (code: number | null) => {
    handleClose(code).catch((handlerError) => {
      logger.error(`Failed to handle exit for container ${containerId}`, {
        error: handlerError,
      })
    })
  })

  instanceProcess.on('error', (error: Error) => {
    handleError(error).catch((handlerError) => {
      logger.error(`Failed to handle process error for container ${containerId}`, {
        error: handlerError,
      })
    })
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
