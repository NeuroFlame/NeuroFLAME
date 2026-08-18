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
  release: () => Promise<void>
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

      let released = false
      return {
        port,
        release: async () => {
          if (released) return
          try {
            await container.remove({ force: true })
          } catch (error) {
            if ((error as { statusCode?: number }).statusCode !== 404) {
              throw error
            }
          }
          released = true
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
