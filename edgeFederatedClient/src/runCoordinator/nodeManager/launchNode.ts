import Docker from 'dockerode'
import { spawn, spawnSync } from 'child_process'
import { promises as fs } from 'fs'
import * as path from 'path'
import { logger } from '../../logger.js'
import { getConfig } from '../../config/config.js'
import { extractSharedError } from './sharedError.js'
import { dockerContainerUser } from './dockerContainerUser.js'
const docker = new Docker()

const MAX_FAILURE_LOG_BYTES = 1024 * 1024

interface LaunchNodeArgs {
  containerService: string
  imageName: string
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
  failureLogPath,
  onContainerExitSuccess,
  onContainerExitError,
}: LaunchNodeArgs) {
  if (containerService === 'docker') {
    await launchDockerNode({
      imageName,
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
      directoriesToMount,
      portBindings,
      commandsToRun,
      failureLogPath,
      onContainerExitSuccess,
      onContainerExitError,
    })
  }
}

const launchDockerNode = async ({
  imageName,
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
      await fs.rm(failureLogPath, { force: true })
    }

    // Create the container
    const container = await docker.createContainer({
      Image: imageName,
      Cmd: commandsToRun,
      // Match the owner of private run-kit/result mounts without restoring capabilities.
      User: dockerContainerUser(
        process.platform,
        typeof process.getuid === 'function' ? process.getuid() : undefined,
        typeof process.getgid === 'function' ? process.getgid() : undefined,
      ),
      ExposedPorts: exposedPorts,
      HostConfig: {
        Binds: binds,
        CapDrop: ['ALL'],
        SecurityOpt: ['no-new-privileges:true'],
        PortBindings: portBindingsFormatted,
        NetworkMode: process.env.CI === 'true' ? 'ci-network' : 'bridge',
        ExtraHosts: process.env.CI === 'true'
          ? ['host.docker.internal:host-gateway']
          : [],
      },
    })

    // Start the container
    await container.start()
    logger.info(`Container started successfully: ${container.id}`)

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
      logger.error(`Error waiting for container ${containerId}`, {
        error: waitError,
      })
      await captureFailedContainerLogs(container, failureLogPath)
      if (onContainerExitError) {
        await onContainerExitError(
          containerId,
          'Participant computation container could not be monitored',
        )
      }
      return
    }

    if (statusCode !== 0) {
      logger.error(
        `Container ${containerId} exited with error code ${statusCode}`,
      )
      const localLogs = await captureFailedContainerLogs(container, failureLogPath)
      const sharedError = extractSharedError(
        localLogs,
        `Participant computation container exited with code ${statusCode}`,
      )
      if (onContainerExitError) {
        await onContainerExitError(containerId, sharedError)
      }
    } else {
      logger.info(`Container ${containerId} exited successfully.`)
      if (onContainerExitSuccess) {
        await onContainerExitSuccess(containerId)
      }
    }
  } catch (handlerError) {
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
): Promise<string> => {
  try {
    const rawLogs = await container.logs({
      stdout: true,
      stderr: true,
      timestamps: true,
      tail: 10000,
    })
    const decodedLogs = decodeDockerLogs(rawLogs)
    if (failureLogPath) {
      await writeFailureLog(failureLogPath, decodedLogs)
      logger.info(`Saved failed-container logs to ${failureLogPath}`)
    }
    return decodedLogs
  } catch (logError) {
    logger.warn(`Could not save failed-container logs for ${container.id}`, {
      error: logError,
    })
    return ''
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
    const singularityBinary = await detectSingularityOrApptainer()
    const imagePath = await findSingularityImage(imageName)
    if (failureLogPath) {
      await fs.rm(failureLogPath, { force: true })
    }

    // Build mount bindings for Singularity (-B flag)
    const bindMounts: string[] = directoriesToMount.map(
      (mount) =>
        `${mount.hostDirectory}:${mount.containerDirectory}:${mount.readOnly ? 'ro' : 'rw'}`,
    )

    // Add /tmp mount for compatibility
    // bindMounts.push('/tmp:/tmp:rw')

    // Build environment variables
    const envVars: string[] = []
    // Note: Singularity uses host networking by default, so ports are directly accessible.
    // Port information is communicated to the computation via provision_input.json file,
    // not through environment variables.

    // Pass through CI environment variable if set
    if (process.env.CI === 'true') {
      envVars.push('CI=true')
    }

    // Build singularity run command
    const singularityArgs: string[] = [
      'run',
      '--containall',
      '--writable-tmpfs',
      '-e', // Clean environment
    ]

    // Add environment variables
    if (envVars.length > 0) {
      singularityArgs.push('--env', envVars.join(','))
    }

    // Add bind mounts
    if (bindMounts.length > 0) {
      singularityArgs.push('-B', bindMounts.join(','))
    }

    // Add image path
    singularityArgs.push(imagePath)

    // Add command to run inside container
    if (commandsToRun.length > 0) {
      singularityArgs.push(...commandsToRun)
    }

    logger.info(
      `Running Singularity command: ${singularityBinary} ${singularityArgs.join(' ')}`,
    )

    // Spawn the singularity process
    const instanceProcess = spawn(singularityBinary, singularityArgs, {
      stdio: ['ignore', 'pipe', 'pipe'],
    })

    // Use process PID as container identifier
    const containerId = instanceProcess.pid
      ? `singularity-${instanceProcess.pid}`
      : `singularity-${Date.now()}`

    logger.info(`Singularity container started successfully: ${containerId}`)

    // Process error handling is now in the exitPromise

    // Set up exit handlers (similar to Docker's attachDockerEventHandlers)
    // Don't await - let it run in the background like Docker does
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
  // Track output as it comes in (similar to how Docker captures logs)
  let capturedStdout = ''
  let capturedStderr = ''

  instanceProcess.stdout?.on('data', (data: Buffer) => {
    capturedStdout += data.toString()
  })

  instanceProcess.stderr?.on('data', (data: Buffer) => {
    capturedStderr += data.toString()
  })

  const handleClose = async (code: number | null): Promise<void> => {
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
      const localError = capturedStderr || capturedStdout || `Exit Code: ${code}`
      const errorMessage = extractSharedError(
        `${capturedStdout}\n${capturedStderr}`,
        `Participant computation process exited with code ${code}`,
      )
      logger.error(
        `Container ${containerId} exited with error code ${code}`,
      )
      await captureFailedProcessLogs(failureLogPath, localError)
      if (onContainerExitError) {
        await onContainerExitError(containerId, errorMessage)
      }
    } else {
      logger.info(`Container ${containerId} exited successfully.`)
      if (onContainerExitSuccess) {
        await onContainerExitSuccess(containerId)
      }
    }
  }

  const handleError = async (error: Error): Promise<void> => {
    logger.error(
      `Failed to start Singularity container: ${error.message}`,
    )
    await captureFailedProcessLogs(
      failureLogPath,
      error.stack || error.message,
    )
    if (onContainerExitError) {
      await onContainerExitError(
        containerId,
        'Participant computation process could not be started',
      )
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

const detectSingularityOrApptainer = async (): Promise<string> => {
  // Check for singularity
  const singularityCheck = spawnSync('which', ['singularity'])
  if (singularityCheck.status === 0) {
    return 'singularity'
  }

  // Check for apptainer (Singularity's successor)
  const apptainerCheck = spawnSync('which', ['apptainer'])
  if (apptainerCheck.status === 0) {
    return 'apptainer'
  }

  throw new Error(
    'Neither Singularity nor Apptainer is installed. Please install one of them.',
  )
}

const findSingularityImage = async (imageName: string): Promise<string> => {
  const config = getConfig()
  const singularityImagesDir = path.join(
    config.pathBaseDirectory,
    'singularityImages',
  )

  // If imageName is already a full path to a .sif file, use it directly
  if (path.isAbsolute(imageName) && imageName.endsWith('.sif')) {
    try {
      await fs.access(imageName)
      return imageName
    } catch {
      throw new Error(`Singularity image not found at path: ${imageName}`)
    }
  }

  // If it's a relative path ending with .sif, check it
  if (imageName.endsWith('.sif')) {
    try {
      await fs.access(imageName)
      return path.resolve(imageName)
    } catch {
      // Continue to search
    }
  }

  // Otherwise, convert Docker image name format to Singularity pattern
  // e.g., "user/repo:tag" -> "user_repo"
  const localImagePattern = imageName
    .replace(/:latest$/, '')
    .replace(/[:@]/g, '_') // Replace : and @ with _
    .replace(/\//g, '_') // Replace / with _
    .toLowerCase()

  // Search for images in singularityImages directory first, then fallback locations
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
      // Directory doesn't exist or can't be read, continue
      continue
    }
  }

  throw new Error(
    `No Singularity image found matching "${imageName}". Searched for pattern "${localImagePattern}.sif" in: ${searchPaths.join(', ')}`,
  )
}
