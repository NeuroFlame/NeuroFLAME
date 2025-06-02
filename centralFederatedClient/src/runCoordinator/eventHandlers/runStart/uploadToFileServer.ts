import axios from 'axios'
import FormData from 'form-data'
import { createReadStream, createWriteStream } from 'fs'
import fs from 'fs/promises'
import path from 'path'
import archiver from 'archiver'
import crypto from 'crypto'
import getConfig from '../../../config/getConfig.js'
import { logger } from '../../../logger.js'

interface UploadParameters {
  consortiumId: string
  runId: string
  path_baseDirectory: string
}

export default async function uploadFileToServer({
  consortiumId,
  runId,
  path_baseDirectory,
}: UploadParameters): Promise<void> {
  const { fileServerUrl, accessToken } = await getConfig()
  const url = `${fileServerUrl}/upload/${consortiumId}/${runId}`
  const zipPath = path.join(
    path_baseDirectory,
    'runs',
    consortiumId,
    runId,
    'hosting',
    `${runId}.zip`,
  )
  const extractPath = path.join(
    path_baseDirectory,
    'runs',
    consortiumId,
    runId,
    'hosting',
  )

  try {
    await zipDirectory(extractPath, zipPath)
    logger.info(`Zip file created at ${zipPath}`)

    await validateZipFile(zipPath)

    const fileSize = await getFileSize(zipPath)
    logger.info(`File size is ${fileSize} bytes`)

    const checksum = await generateChecksum(zipPath)
    logger.info(`Checksum is ${checksum}`)

    await uploadZipFile(url, zipPath, accessToken)
  } catch (error) {
    logger.error('Error during file upload:', formatAxiosError(error))
    throw error // Properly propagate errors
  }
}

async function validateZipFile(zipPath: string): Promise<void> {
  logger.info(`Validating zip file at ${zipPath}...`)
  const fileStats = await fs.stat(zipPath)
  if (fileStats.size === 0) {
    throw new Error('Zip file is empty')
  }
  logger.info('Zip file validation successful')
}

async function getFileSize(filePath: string): Promise<number> {
  const stats = await fs.stat(filePath)
  return stats.size
}

async function generateChecksum(filePath: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const hash = crypto.createHash('sha256')
    const stream = createReadStream(filePath)

    stream.on('data', (data) => hash.update(data))
    stream.on('end', () => resolve(hash.digest('hex')))
    stream.on('error', (error) => reject(error))
  })
}

async function uploadZipFile(
  url: string,
  zipPath: string,
  accessToken: string,
): Promise<void> {
  const formData = new FormData()
  formData.append('file', createReadStream(zipPath))

  logger.info('Starting file upload...')

  try {
    const response = await axios.post(url, formData, {
      headers: {
        'x-access-token': accessToken,
        ...formData.getHeaders(),
      },
      maxContentLength: Infinity, // Ensure large files are handled
      maxBodyLength: Infinity,
    })

    if (response.status === 200) {
      logger.info('File uploaded successfully')
    } else {
      throw new Error(`Failed to upload file: ${response.statusText}`)
    }
  } catch (error) {
    logger.error('File upload failed:', formatAxiosError(error))
    throw new Error(formatAxiosError(error))
  }
}

export async function zipDirectory(
  sourceDir: string,
  outPath: string,
): Promise<void> {
  return new Promise(async (resolve, reject) => {
    const outputDir = path.dirname(outPath)
    try {
      await fs.mkdir(outputDir, { recursive: true })
    } catch (err) {
      return reject(`Failed to create directory ${outputDir}: ${err}`)
    }

    const output = createWriteStream(outPath)
    const archive = archiver('zip', { zlib: { level: 9 } })

    output.on('close', () => {
      logger.info(`Archived ${archive.pointer()} total bytes.`)
      resolve()
    })

    output.on('end', () => {
      logger.info('Data has been drained')
    })

    archive.on('error', (err) => {
      logger.error('Archiving error:', err)
      reject(err)
    })

    archive.on('warning', (err) => {
      if (err.code === 'ENOENT') {
        console.warn('Archiving warning:', err)
      } else {
        logger.error('Archiving warning:', err)
        reject(err)
      }
    })

    archive.pipe(output)
    archive.directory(sourceDir, false)
    await archive.finalize()
  })
}

function formatAxiosError(error: any): string {
  if (axios.isAxiosError(error)) {
    const status = error.response?.status || 'N/A'
    const statusText = error.response?.statusText || 'N/A'
    const url = error.config?.url || 'N/A'
    const method = error.config?.method || 'N/A'
    const data = error.response?.data || 'N/A'

    return `Axios error:
    Status: ${status}
    StatusText: ${statusText}
    URL: ${url}
    Method: ${method}
    Data: ${JSON.stringify(data)}`
  }

  return `Error: ${error.message}`
}
