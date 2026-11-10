import Docker from 'dockerode'
import { logger } from '../../../logger.js'

const docker = new Docker()
const RESERVATION_LABEL = 'org.neuroflame.port-reservation'

interface ReservePortOptions {
  start: number
  end: number
  imageName: string
}

interface ReservePortResult {
  port: number
  /** Free the Docker host port so the node can bind it; the port stays claimed in this process. */
  releaseHold: () => Promise<void>
  /** Free the host port (if still held) and the in-process claim. */
  release: () => Promise<void>
}

// Ports handed to a run in this process. Docker cannot see a port between the
// reservation being removed and the node binding it, so concurrent runs check here.
const claimedPorts = new Set<number>()

/**
 * Remove reservation containers left by a previous process (for example after a
 * crash); they would otherwise hold host ports for a day. Assumes one central
 * client per Docker host.
 */
export async function removeStaleReservations(
  dockerClient: Pick<Docker, 'listContainers' | 'getContainer'> = docker,
): Promise<number> {
  const stale = await dockerClient.listContainers({
    all: true,
    filters: { label: [`${RESERVATION_LABEL}=true`] },
  })
  for (const { Id } of stale) {
    try {
      await dockerClient.getContainer(Id).remove({ force: true })
    } catch (error) {
      if ((error as { statusCode?: number }).statusCode !== 404) throw error
    }
  }
  return stale.length
}

export async function reservePort(
  { start, end, imageName }: ReservePortOptions,
  dockerClient: Pick<Docker, 'createContainer'> = docker,
): Promise<ReservePortResult> {
  if (start < 1024 || end > 65535 || start > end) {
    throw new Error(
      'Invalid port range. Must be between 1024 and 65535 and start must be less than end.',
    )
  }

  for (let port = start; port <= end; port++) {
    if (claimedPorts.has(port)) continue
    const portWithProtocol = `${port}/tcp`
    const container = await dockerClient.createContainer({
      Image: imageName,
      Entrypoint: ['python'],
      Cmd: ['-c', 'import time; time.sleep(86400)'],
      Labels: { [RESERVATION_LABEL]: 'true' },
      ExposedPorts: { [portWithProtocol]: {} },
      HostConfig: {
        AutoRemove: false,
        CapDrop: ['ALL'],
        NetworkMode: 'bridge',
        PortBindings: {
          [portWithProtocol]: [{ HostPort: `${port}` }],
        },
        SecurityOpt: ['no-new-privileges:true'],
      },
    })

    try {
      await container.start()
      logger.info(`Reserved Docker host port ${port}`)
      claimedPorts.add(port)

      let held = true
      const releaseHold = async () => {
        if (!held) return
        try {
          await container.remove({ force: true })
        } catch (error) {
          if ((error as { statusCode?: number }).statusCode !== 404) {
            throw error
          }
        }
        held = false
      }
      return {
        port,
        releaseHold,
        release: async () => {
          try {
            await releaseHold()
          } finally {
            claimedPorts.delete(port)
          }
        },
      }
    } catch (error) {
      await removeFailedReservation(container, port)
      if (isPortAllocationError(error)) {
        continue
      }
      throw error
    }
  }

  logger.error(`No available Docker host ports in range ${start}-${end}.`)
  throw new Error('All ports in the specified range are in use.')
}

async function removeFailedReservation(
  container: Docker.Container,
  port: number,
): Promise<void> {
  try {
    await container.remove({ force: true })
  } catch (error) {
    if ((error as { statusCode?: number }).statusCode !== 404) {
      logger.warn(`Failed to remove port reservation container for ${port}`, {
        error,
      })
    }
  }
}

function isPortAllocationError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error)
  return /port is already allocated|address already in use|port is not available/i.test(
    message,
  )
}
