import axios from 'axios'
import fs from 'fs'
import path from 'path'
import { logger } from '../../../logger.js'


function normalizeUrlForDocker(rawUrl: string): string {
  try {
    const u = new URL(rawUrl)
    if (u.hostname === 'localhost' || u.hostname === '127.0.0.1' || u.hostname === '::1') {
      // In Docker on macOS, localhost from inside a container points to the container itself.
      // host.docker.internal resolves to the host network interface.
      u.hostname = 'host.docker.internal'
      return u.toString()
    }
    return rawUrl
  } catch {
    return rawUrl
  }
}

interface DownloadFileParams {
  url: string;
  accessToken: string;
  pathOutputDir: string;
  outputFilename: string;
}

export default async function downloadFile({
  url,
  accessToken,
  pathOutputDir,
  outputFilename,
}: DownloadFileParams): Promise<void> {
  let normalizedUrl = url;
  try {
    normalizedUrl = normalizeUrlForDocker(url)
    logger.info(`Attempting to download from URL: ${normalizedUrl}`)

    const response = await axios({
      method: 'POST',
      url: normalizedUrl,
      headers: {
        'x-access-token': accessToken,
      },
      responseType: 'stream',
    })

    // Ensure the directory exists
    await fs.promises.mkdir(pathOutputDir, { recursive: true })
    const pathOutputFile = path.join(pathOutputDir, outputFilename)
    const writer = fs.createWriteStream(pathOutputFile)
    logger.info(`Writing to file: ${pathOutputFile}`)

    // Pipe the response data to the file
    response.data.pipe(writer)

    // Handle download completion and verification
    return new Promise<void>((resolve, reject) => {
      writer.on('finish', async () => {
        logger.info('File write completed successfully.')

        try {
          // Verify file size matches expected content-length
          const fileSize = (await fs.promises.stat(pathOutputFile)).size
          const contentLength = response.headers['content-length']

          if (contentLength && fileSize !== parseInt(contentLength, 10)) {
            reject(
              new Error(
                `File size mismatch: expected ${contentLength}, but got ${fileSize}`,
              ),
            )
          } else {
            logger.info('File size matches the content-length. Download successful.')
            resolve()
          }
        } catch (error) {
          logger.error('Error verifying downloaded file:', (error as Error).message)
          reject(error)
        }
      })

      writer.on('error', (error) => {
        logger.error('File write failed:', (error as Error).message)
        reject(error)
      })
    })
  } catch (error) {
    if (axios.isAxiosError(error)) {
      logger.error(`Failed to download file: ${error.message}`, JSON.stringify({
        message: error.message,
        url: normalizedUrl,
        originalUrl: error.config?.url,
        method: error.config?.method,
        statusCode: error.response?.status,
        statusText: error.response?.statusText,
      }, null, 2))
    } else {
      logger.error('Unexpected error:', (error as Error).message)
    }
    throw new Error(`Download failed: ${(error as Error).message}`)
  }
}
