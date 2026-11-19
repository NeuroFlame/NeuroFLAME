import axios from 'axios'
import { constants, promises as fs } from 'fs'
import path from 'path'
import { Readable, Transform } from 'stream'
import { pipeline } from 'stream/promises'
import { logger } from '../../../logger.js'

interface DownloadFileParams {
  url: string;
  accessToken: string;
  pathOutputDir: string;
  outputFilename: string;
  idleTimeoutMs?: number;
  totalTimeoutMs?: number;
}

// A stalled or dropped file server connection must fail the run start rather
// than leave it waiting forever.
const IDLE_TIMEOUT_MS = 60 * 1000
const TOTAL_TIMEOUT_MS = 30 * 60 * 1000

export default async function downloadFile({
  url,
  accessToken,
  pathOutputDir,
  outputFilename,
  idleTimeoutMs = IDLE_TIMEOUT_MS,
  totalTimeoutMs = TOTAL_TIMEOUT_MS,
}: DownloadFileParams): Promise<void> {
  const controller = new AbortController()
  let timeoutError: Error | undefined
  const abortWith = (message: string) => {
    timeoutError ??= new Error(message)
    controller.abort(timeoutError)
  }
  const totalTimer = setTimeout(
    () => abortWith(`no complete response within ${totalTimeoutMs} ms`),
    totalTimeoutMs,
  )
  let idleTimer: NodeJS.Timeout | undefined
  const armIdleTimer = () => {
    clearTimeout(idleTimer)
    idleTimer = setTimeout(
      () => abortWith(`no data received for ${idleTimeoutMs} ms`),
      idleTimeoutMs,
    )
  }
  const pathOutputFile = path.join(pathOutputDir, outputFilename)
  let fileOpened = false
  let body: Readable | undefined

  try {
    logger.info(`Attempting to download from URL: ${url}`)
    armIdleTimer()

    const response = await axios({
      method: 'POST',
      url,
      headers: {
        'x-access-token': accessToken,
      },
      responseType: 'stream',
      signal: controller.signal,
    })
    body = response.data as Readable

    await fs.mkdir(pathOutputDir, { recursive: true, mode: 0o700 })
    // The run kit directory is mounted into the computation container, so never
    // follow a link planted there.
    const file = await fs.open(
      pathOutputFile,
      constants.O_WRONLY | constants.O_CREAT | constants.O_TRUNC | (constants.O_NOFOLLOW ?? 0),
      0o600,
    )
    fileOpened = true
    logger.info(`Writing to file: ${pathOutputFile}`)

    let received = 0
    const watchdog = new Transform({
      transform(chunk, _encoding, callback) {
        received += chunk.length
        armIdleTimer()
        callback(null, chunk)
      },
    })
    await pipeline(body, watchdog, file.createWriteStream(), {
      signal: controller.signal,
    })

    const contentLength = response.headers['content-length']
    if (contentLength && received !== Number(contentLength)) {
      throw new Error(
        `File size mismatch: expected ${contentLength}, but got ${received}`,
      )
    }
    logger.info('File size matches the content-length. Download successful.')
  } catch (caught) {
    const error = timeoutError ?? caught
    body?.destroy()
    if (fileOpened) {
      await fs.rm(pathOutputFile, { force: true }).catch((removeError: Error) => {
        logger.error(`Failed to remove partial download: ${removeError.message}`)
      })
    }
    if (axios.isAxiosError(error)) {
      logger.error(`Failed to download file: ${error.message}`, JSON.stringify({
        message: error.message,
        url: error.config?.url,
        method: error.config?.method,
        statusCode: error.response?.status,
        statusText: error.response?.statusText,
      }, null, 2))
    } else {
      logger.error(`Failed to download file: ${(error as Error).message}`)
    }
    throw new Error(`Download failed: ${(error as Error).message}`)
  } finally {
    clearTimeout(totalTimer)
    clearTimeout(idleTimer)
  }
}
