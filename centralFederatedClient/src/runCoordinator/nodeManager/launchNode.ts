import Docker from 'dockerode'
import { promises as fs } from 'fs'
import * as path from 'path'
import { logger } from '../../logger.js'
import { extractSharedError } from './sharedError.js'
const docker = new Docker()

const MAX_FAILURE_LOG_BYTES = 1024 * 1024
const SEMVER_PATTERN = /^\d+\.\d+\.\d+$/
const DIGEST_PATTERN = /^sha256:[0-9a-f]{64}$/

export interface ComputationImageMetadata {
  title: string
  computationVersion: string
  revision: string
  source: string
  computationApiVersion: string
  boilerplateVersion: string
  nvflareVersion: string
}

export interface ResolvedComputationImage {
  sourceImage: string
  reference: string
  digest: string
  metadata: ComputationImageMetadata
}

const REQUIRED_IMAGE_LABELS = {
  title: 'org.opencontainers.image.title',
  computationVersion: 'org.opencontainers.image.version',
  revision: 'org.opencontainers.image.revision',
  source: 'org.opencontainers.image.source',
  computationApiVersion: 'org.neuroflame.computation-api.version',
  boilerplateVersion: 'org.neuroflame.boilerplate.version',
  nvflareVersion: 'org.neuroflame.nvflare.version',
} as const

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
  // Central client only supports Docker
  if (containerService !== 'docker') {
    throw new Error(`Central client only supports Docker, not ${containerService}`)
  }

  await launchDockerNode({
    imageName,
    directoriesToMount,
    portBindings,
    commandsToRun,
    failureLogPath,
    onContainerExitSuccess,
    onContainerExitError,
  })
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
    const resolvedImageName = await ensureDockerImageReady(imageName)
    if (failureLogPath) {
      await fs.rm(failureLogPath, { force: true })
    }

    // Create the container
    const container = await docker.createContainer({
      Image: resolvedImageName,
      Cmd: commandsToRun,
      Labels: { 'org.neuroflame.computation': 'true' },
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
          'Central computation container could not be monitored',
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
        `Computation container exited with code ${statusCode}`,
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
    if (!failureLogPath) {
      return decodedLogs
    }
    const logBuffer = Buffer.from(decodedLogs, 'utf8')
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
    logger.info(`Saved failed-container logs to ${failureLogPath}`)
    return decodedLogs
  } catch (logError) {
    logger.warn(`Could not save failed-container logs for ${container.id}`, {
      error: logError,
    })
    return ''
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

const getLocalDockerImageId = async (
  imageName: string,
): Promise<string | undefined> => {
  try {
    const image = await docker.getImage(imageName).inspect()
    return image.Id
  } catch (error) {
    if ((error as { statusCode?: number }).statusCode === 404) {
      return undefined
    }

    throw error
  }
}

const validateImageCompatibility = async (imageName: string): Promise<void> => {
  const image = await docker.getImage(imageName).inspect()
  const labels = image.Config?.Labels ?? {}
  for (const [label, expected] of Object.entries(REQUIRED_IMAGE_LABELS)) {
    const actual = labels[label]
    if (actual !== expected) {
      throw new Error(
        `Image "${imageName}" is incompatible: label "${label}" must be "${expected}"`,
      )
    }
  }
}

const shouldPullBeforeRun = (imageName: string): boolean => {
  if (imageName.includes('@sha256:')) {
    return false
  }

  const imageWithoutRegistryPort = imageName.includes('/')
    ? imageName.substring(imageName.lastIndexOf('/') + 1)
    : imageName

  return !imageWithoutRegistryPort.includes(':') || imageName.endsWith(':latest')
}

const readComputationImageMetadata = (
  labels: Record<string, string> | undefined,
): ComputationImageMetadata => {
  const metadata = Object.fromEntries(
    Object.entries(REQUIRED_IMAGE_LABELS).map(([field, label]) => {
      const value = labels?.[label]?.trim()
      if (!value) {
        throw new Error(`Computation image is missing required label "${label}"`)
      }
      return [field, value]
    }),
  ) as unknown as ComputationImageMetadata

  for (const field of [
    'computationVersion',
    'computationApiVersion',
    'boilerplateVersion',
    'nvflareVersion',
  ] as const) {
    if (!SEMVER_PATTERN.test(metadata[field])) {
      throw new Error(`Computation image label ${field} is not semantic versioning`)
    }
  }
  if (!/^[0-9a-f]{7,64}$/.test(metadata.revision)) {
    throw new Error('Computation image revision label is not a Git revision')
  }
  return metadata
}

export const resolveDockerComputationImage = async (
  imageName: string,
  requiredComputationApiVersion: string,
  mode: 'local' | 'registry' = 'registry',
): Promise<ResolvedComputationImage> => {
  await isDockerRunning()
  if (mode === 'local') {
    const inspection = await docker.getImage(imageName).inspect()
    const metadata = readComputationImageMetadata(inspection.Config?.Labels)
    validateComputationImageMetadata(metadata, requiredComputationApiVersion)
    if (!DIGEST_PATTERN.test(inspection.Id)) {
      throw new Error(`Docker returned an invalid local image ID: ${inspection.Id}`)
    }
    logger.info(`Using local computation image ${imageName} as ${inspection.Id}`)
    return {
      sourceImage: imageName,
      reference: inspection.Id,
      digest: inspection.Id,
      metadata,
    }
  }

  if (imageName.includes('@sha256:')) {
    try {
      await pullDockerImage(imageName)
    } catch (error) {
      if (!await getLocalDockerImageId(imageName)) {
        throw error
      }
      logger.warn(`Registry unavailable; using cached immutable image ${imageName}`, {
        error,
      })
    }
  } else {
    await pullDockerImage(imageName)
  }

  const inspection = await docker.getImage(imageName).inspect()
  const metadata = readComputationImageMetadata(inspection.Config?.Labels)
  validateComputationImageMetadata(metadata, requiredComputationApiVersion)

  const suppliedDigest = imageName.match(/@(sha256:[0-9a-f]{64})$/)?.[1]
  const sourceRepository = imageName
    .replace(/@sha256:[0-9a-f]{64}$/, '')
    .replace(/:[^/:]+$/, '')
  const repositoryDigest = suppliedDigest
    ? imageName
    : inspection.RepoDigests?.find(
      (value) =>
        value.startsWith(`${sourceRepository}@`) && value.includes('@sha256:'),
    )
  if (!repositoryDigest) {
    throw new Error(`Unable to resolve a registry digest for image "${imageName}"`)
  }
  const digest = repositoryDigest.slice(repositoryDigest.lastIndexOf('@') + 1)
  if (!DIGEST_PATTERN.test(digest)) {
    throw new Error(`Docker returned an invalid image digest: ${digest}`)
  }

  return {
    sourceImage: imageName,
    reference: repositoryDigest,
    digest,
    metadata,
  }
}

const validateComputationImageMetadata = (
  metadata: ComputationImageMetadata,
  requiredComputationApiVersion: string,
): void => {
  if (metadata.computationApiVersion !== requiredComputationApiVersion) {
    throw new Error(
      `Computation API ${metadata.computationApiVersion} is incompatible with required version ${requiredComputationApiVersion}`,
    )
  }
  if (metadata.nvflareVersion !== '2.8.0') {
    throw new Error(
      `NVFlare ${metadata.nvflareVersion} is incompatible with required version 2.8.0`,
    )
  }
  if (metadata.boilerplateVersion !== '0.1.0') {
    throw new Error(
      `Boilerplate ${metadata.boilerplateVersion} is incompatible with required version 0.1.0`,
    )
  }
}

const pullDockerImage = async (imageName: string): Promise<void> => {
  logger.info(`Pulling Docker image before run: ${imageName}`)

  await new Promise<void>((resolve, reject) => {
    docker.pull(imageName, (error: Error | null, stream: NodeJS.ReadableStream | undefined) => {
      if (error) {
        reject(error)
        return
      }

      if (!stream) {
        reject(new Error(`Docker did not return a pull stream for ${imageName}`))
        return
      }

      docker.modem.followProgress(stream, (progressError) => {
        if (progressError) {
          reject(progressError)
          return
        }

        resolve()
      })
    })
  })

  logger.info(`Docker image pull completed: ${imageName}`)
}

export const ensureDockerImageReady = async (
  imageName: string,
): Promise<string> => {
  await isDockerRunning()

  if (shouldPullBeforeRun(imageName)) {
    await pullDockerImage(imageName)
  }

  const localImageId = await getLocalDockerImageId(imageName)
  if (!localImageId) {
    throw new Error(
      `Image "${imageName}" does not exist. Please pull the image or verify its name.`,
    )
  }

  return imageName
}
