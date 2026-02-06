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
  [portWithProtocol: string]: {}
}

interface PortBindings {
  [portWithProtocol: string]: Array<{ HostPort: string }>
}

/**
 * Removes invalid mounts like:
 *   - empty hostDirectory -> would become ':/container/path' (Docker error)
 *   - non-existent hostDirectory (optional; default is skip-with-warning)
 *
 * Set NEUROFLAME_STRICT_MOUNTS=true to fail instead of skipping.
 *
 * Debug:
 *   Set NEUROFLAME_DEBUG_MOUNTS=true to log mount resolution + existence checks.
 */
async function sanitizeMounts(
  directoriesToMount: LaunchNodeArgs['directoriesToMount'],
): Promise<LaunchNodeArgs['directoriesToMount']> {
  const strict = process.env.NEUROFLAME_STRICT_MOUNTS === 'true'
  const debug = process.env.NEUROFLAME_DEBUG_MOUNTS === 'true'

  const sanitized: LaunchNodeArgs['directoriesToMount'] = []

  if (debug) {
    logger.info('sanitizeMounts: input mounts', {
      strict,
      count: directoriesToMount?.length || 0,
      mounts: (directoriesToMount || []).map((m) => ({
        hostDirectory: m.hostDirectory,
        containerDirectory: m.containerDirectory,
        hostEmpty: !m.hostDirectory || (m.hostDirectory || '').trim().length === 0,
        containerEmpty:
          !m.containerDirectory || (m.containerDirectory || '').trim().length === 0,
      })),
    })
  }

  for (const mount of directoriesToMount || []) {
    const host = (mount.hostDirectory || '').trim()
    const container = (mount.containerDirectory || '').trim()

    if (!container) {
      const msg = `Invalid mount entry: missing containerDirectory (host="${mount.hostDirectory}")`
      if (strict) throw new Error(msg)
      logger.warn(msg + ' — skipping')
      continue
    }

    if (!host) {
      const msg = `Invalid mount entry: empty hostDirectory for containerDirectory="${container}"`
      if (strict) throw new Error(msg)
      logger.warn(msg + ' — skipping (if you expected a data mount here, upstream path resolution returned empty)')
      continue
    }

    try {
      await fs.access(host)

      if (debug) {
        logger.info('sanitizeMounts: host path exists', {
          host,
          resolvedHost: path.resolve(host),
          container,
        })
      }

      sanitized.push({ hostDirectory: host, containerDirectory: container })
    } catch {
      const msg = `Mount hostDirectory does not exist: "${host}" -> "${container}"`
      if (debug) {
        logger.warn('sanitizeMounts: host path missing', {
          host,
          resolvedHost: path.resolve(host),
          container,
        })
      }
      if (strict) throw new Error(msg)
      logger.warn(msg + ' — skipping')
    }
  }

  if (debug) {
    logger.info('sanitizeMounts: output mounts', {
      strict,
      requested: directoriesToMount?.length || 0,
      kept: sanitized.length,
      mounts: sanitized.map((m) => ({
        hostDirectory: m.hostDirectory,
        resolvedHost: path.resolve(m.hostDirectory),
        containerDirectory: m.containerDirectory,
      })),
    })
  }

  return sanitized
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
  logger.info(`Attempting to launch Docker container from imageName: ${imageName}`)

  // Helpful one-liner even when DEBUG_MOUNTS is off
  logger.info('Requested mounts', {
    count: directoriesToMount?.length || 0,
    mounts: (directoriesToMount || []).map((m) => ({
      hostDirectory: m.hostDirectory,
      containerDirectory: m.containerDirectory,
      hostEmpty: !m.hostDirectory || (m.hostDirectory || '').trim().length === 0,
    })),
  })

  // Sanitize mounts to prevent ':/workspace/data' and missing paths
  const safeMounts = await sanitizeMounts(directoriesToMount)

  const binds = safeMounts.map(
    (mount) => `${mount.hostDirectory}:${mount.containerDirectory}`,
  )

  if (binds.length !== (directoriesToMount?.length || 0)) {
    logger.info(
      `Mounts sanitized: requested=${directoriesToMount?.length || 0}, used=${binds.length}`,
    )
  }

  logger.info('Docker binds (final)', { binds })

  const exposedPorts: ExposedPorts = {}
  const portBindingsFormatted: PortBindings = {}

  portBindings.forEach((binding) => {
    const containerPort = `${binding.containerPort}/tcp`
    exposedPorts[containerPort] = {}
    portBindingsFormatted[containerPort] = [{ HostPort: `${binding.hostPort}` }]
  })

  try {
    await isDockerRunning()
    await doesImageExist(imageName)

    const container = await docker.createContainer({
      Image: imageName,
      Cmd: commandsToRun,
      ExposedPorts: exposedPorts,
      HostConfig: {
        Binds: binds,
        PortBindings: portBindingsFormatted,
        NetworkMode: process.env.CI === 'true' ? 'ci-network' : 'bridge',
        ExtraHosts:
          process.env.CI === 'true' ? ['host.docker.internal:host-gateway'] : [],
      },
    })

    await container.start()
    logger.info(`Container started successfully: ${container.id}`)

    attachDockerEventHandlers({
      containerId: container.id,
      onContainerExitSuccess,
      onContainerExitError,
    })

    return container.id
  } catch (error) {
    logger.error(`Failed to launch Docker container: ${(error as Error).message}`)
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
      logger.error(`Container ${containerId} exited with error code ${StatusCode}`)
      onContainerExitError?.(containerId, `Exit Code: ${StatusCode}`)
    } else {
      logger.info(`Container ${containerId} exited successfully.`)
      onContainerExitSuccess?.(containerId)
    }
  } catch (error) {
    logger.error(`Error waiting for container ${containerId}`, { error })
    onContainerExitError?.(containerId, (error as Error).message)
  }
}

const isDockerRunning = async () => {
  try {
    await docker.ping()
  } catch {
    throw new Error('Docker is not running. Please ensure the Docker daemon is active.')
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
      `Failed to check existence of image "${imageName}": ${(error as Error).message}`,
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
  logger.info(`Attempting to launch Singularity container from imageName: ${imageName}`)

  try {
    const singularityBinary = await detectSingularityOrApptainer()
    const imagePath = await findSingularityImage(imageName)

    // Sanitize mounts (same behavior as Docker)
    const safeMounts = await sanitizeMounts(directoriesToMount)

    const bindMounts: string[] = safeMounts.map(
      (mount) => `${mount.hostDirectory}:${mount.containerDirectory}:rw`,
    )

    const envVars: string[] = []
    if (process.env.CI === 'true') envVars.push('CI=true')

    const singularityArgs: string[] = ['run', '--containall', '--writable-tmpfs', '-e']

    if (envVars.length > 0) singularityArgs.push('--env', envVars.join(','))
    if (bindMounts.length > 0) singularityArgs.push('-B', bindMounts.join(','))

    singularityArgs.push(imagePath)

    if (commandsToRun.length > 0) singularityArgs.push(...commandsToRun)

    logger.info(`Running Singularity command: ${singularityBinary} ${singularityArgs.join(' ')}`)

    const instanceProcess = spawn(singularityBinary, singularityArgs, {
      stdio: ['ignore', 'pipe', 'pipe'],
    })

    const containerId = instanceProcess.pid
      ? `singularity-${instanceProcess.pid}`
      : `singularity-${Date.now()}`

    logger.info(`Singularity container started successfully: ${containerId}`)

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
      logger.info(`Singularity Container [${containerId}] stderr: ${output.trim()}`)
    })

    instanceProcess.on('close', (code) => {
      if (code === 0) {
        onContainerExitSuccess?.(containerId)
      } else {
        onContainerExitError?.(
          containerId,
          `Exit Code: ${code}\nstdout:\n${stdout}\nstderr:\n${stderr}`,
        )
      }
    })

    instanceProcess.on('error', (err) => {
      onContainerExitError?.(containerId, err.message)
    })

    return containerId
  } catch (error) {
    logger.error(`Failed to launch Singularity container: ${(error as Error).message}`)
    throw error
  }
}

// --- existing helpers below (unchanged) ---

async function detectSingularityOrApptainer(): Promise<string> {
  const candidates = ['apptainer', 'singularity']
  for (const bin of candidates) {
    const res = spawnSync(bin, ['--version'], { stdio: 'ignore' })
    if (res.status === 0) return bin
  }
  throw new Error('Neither apptainer nor singularity was found on PATH.')
}

async function findSingularityImage(imageName: string): Promise<string> {
  const cfg = getConfig()
  // This follows whatever your existing convention is for local .sif storage.
  // Keeping as-is: locate by imageName-derived filename within cfg.path_base_directory if present.
  const safeName = imageName.replace(/[/:]/g, '_')
  const candidates = [
    path.join((cfg as any).pathBaseDirectory || '', `${safeName}.sif`),
    path.join(process.cwd(), `${safeName}.sif`),
  ]

  for (const p of candidates) {
    try {
      await fs.access(p)
      return p
    } catch {
      // continue
    }
  }

  throw new Error(
    `Could not find Singularity image for "${imageName}". Looked in:\n- ${candidates.join('\n- ')}`,
  )
}
