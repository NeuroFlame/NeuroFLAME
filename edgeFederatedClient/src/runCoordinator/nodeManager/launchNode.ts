import Docker from 'dockerode'
import { spawn, spawnSync } from 'child_process'
import { promises as fs } from 'fs'
import * as path from 'path'
import { logger } from '../../logger.js'
import { getConfig } from '../../config/config.js'
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
    await launchSingularityNode({
      imageName,
      directoriesToMount,
      portBindings,
      commandsToRun,
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
      `Failed to check existence of image "${imageName}": ${(error as Error).message
      }`,
    )
  }
}

const launchSingularityNode = async ({
  imageName,
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
    const singularityBinary = await detectSingularityOrApptainer()
    const imagePath = await findSingularityImage(imageName)

    // Build mount bindings for Singularity (-B flag)
    const bindMounts: string[] = directoriesToMount.map(
      (mount) => `${mount.hostDirectory}:${mount.containerDirectory}:rw`,
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

    // Handle stdout and stderr
    let stdout = ''
    let stderr = ''

    instanceProcess.stdout?.on('data', (data: Buffer) => {
      const output = data.toString()
      stdout += output
      logger.info(`Singularity Container [${containerId}] stdout: ${output.trim()}`)
    })

    instanceProcess.stderr?.on('data', (data: Buffer) => {
      const output = data.toString()
      stderr += output
      // Singularity often outputs info to stderr, so log as info unless it's an error
      logger.info(`Singularity Container [${containerId}] stderr: ${output.trim()}`)
    })

    // Process error handling is now in the exitPromise

    // Create a promise that resolves when the process exits
    // This mimics Docker's container.wait() behavior
    const exitPromise = new Promise<void>((resolve) => {
      instanceProcess.on('close', async (code: number | null) => {
        if (code === null) {
          logger.error(`Singularity container ${containerId} exited with null code`)
          if (onContainerExitError) {
            try {
              await onContainerExitError(containerId, 'Process exited with null code')
            } catch (err) {
              logger.error(`Error in onContainerExitError callback: ${err}`)
            }
          }
          resolve()
          return
        }

        if (code !== 0) {
          const errorMessage = stderr || stdout || `Exit Code: ${code}`
          logger.error(
            `Singularity container ${containerId} exited with error code ${code}`,
          )
          logger.error(`Error output: ${errorMessage}`)
          if (onContainerExitError) {
            try {
              await onContainerExitError(containerId, errorMessage)
            } catch (err) {
              logger.error(`Error in onContainerExitError callback: ${err}`)
            }
          }
        } else {
          logger.info(`Singularity container ${containerId} exited successfully.`)
          if (onContainerExitSuccess) {
            try {
              await onContainerExitSuccess(containerId)
            } catch (err) {
              logger.error(`Error in onContainerExitSuccess callback: ${err}`)
            }
          }
        }
        resolve()
      })

      // Also handle process errors
      instanceProcess.on('error', async (error: Error) => {
        logger.error(
          `Failed to start Singularity container: ${error.message}`,
        )
        if (onContainerExitError) {
          try {
            await onContainerExitError(containerId, error.message)
          } catch (err) {
            logger.error(`Error in onContainerExitError callback: ${err}`)
          }
        }
        resolve()
      })
    })

    // Wait for process to exit (similar to Docker's container.wait())
    await exitPromise

    return containerId
  } catch (error) {
    logger.error(
      `Failed to launch Singularity container: ${(error as Error).message}`,
    )
    throw error
  }
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
