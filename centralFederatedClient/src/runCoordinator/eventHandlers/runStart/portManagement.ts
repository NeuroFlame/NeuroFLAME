import net from 'net'
import { logger } from '../../../logger.js'

interface ReservePortOptions {
  start: number
  end: number
}

interface ReservePortResult {
  port: number
  server: net.Server
}

export async function reservePort({
  start,
  end,
}: ReservePortOptions): Promise<ReservePortResult> {
  if (start < 1024 || end > 65535 || start > end) {
    throw new Error(
      'Invalid port range. Must be between 1024 and 65535 and start must be less than end.',
    )
  }

  return new Promise((resolve, reject) => {
    let port = start

    const attemptPort = () => {
      const server = createServer()

      server.listen(port, () => {
        const address = server.address() as net.AddressInfo
        const chosenPort = address.port
        logger.info(`Listening on port ${chosenPort}`)

        resolve({
          port: chosenPort,
          server,
        })
      })

      server.on('error', (err: NodeJS.ErrnoException) => {
        if (err.code === 'EADDRINUSE' && port < end) {
          port++
          attemptPort() // Try the next port
        } else if (err.code === 'EADDRINUSE') {
          logger.error(
            `No available ports in range ${start}-${end}. All are in use.`,
          )
          reject(new Error('All ports in the specified range are in use.'))
        } else {
          logger.error(`Error reserving port: ${err.message}`)
          reject(err) // Reject if no available ports or another error occurs
        }
      })
    }

    attemptPort()
  })
}

function createServer(): net.Server {
  return net.createServer((sock) => {
    sock.end('Hello world\n')
  })
}
