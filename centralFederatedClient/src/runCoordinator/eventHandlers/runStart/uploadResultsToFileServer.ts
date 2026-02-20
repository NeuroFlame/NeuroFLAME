import axios from 'axios'
import FormData from 'form-data'
import { createReadStream, createWriteStream } from 'fs'
import fs from 'fs/promises'
import path from 'path'
import archiver from 'archiver'
import crypto from 'crypto'
import { ACCESS_TOKEN, FILE_SERVER_URL } from '../../../config.js'
import { logger } from '../../../logger.js'

const RESULTS_DEBUG = process.env.NEUROFLAME_RESULTS_UPLOAD_DEBUG === 'true'

async function zipFolder(folderPath: string): Promise<string> {
  const zipFileName = `${crypto.randomUUID()}.zip`
  const zipFilePath = path.join(folderPath, '..', zipFileName)

  await new Promise<void>((resolve, reject) => {
    const output = createWriteStream(zipFilePath)
    const archive = archiver('zip', { zlib: { level: 9 } })

    output.on('close', () => resolve())
    archive.on('error', (err) => reject(err))

    archive.pipe(output)
    archive.directory(folderPath, false)
    archive.finalize()
  })

  return zipFilePath
}

/**
 * Upload aggregated run results to the NeuroFLAME file server.
 *
 * Expected server-side storage:
 *   <BASE_DIR>/<consortiumId>/<runId>/results/results.zip
 *
 * This function looks for an existing results.zip in the host-mounted output directory.
 * If it can't find one, it will zip the output directory and upload it as results.zip.
 */
export async function uploadResultsToFileServer(opts: {
  consortiumId: string
  runId: string
  // host path that is mounted to /workspace/output in the central container
  pathRunOutput: string
}): Promise<void> {
  const { consortiumId, runId, pathRunOutput } = opts

  if (!FILE_SERVER_URL) {
    logger.warn('[uploadResultsToFileServer] FILE_SERVER_URL not set; skipping')
    return
  }
  if (!ACCESS_TOKEN) {
    logger.warn('[uploadResultsToFileServer] ACCESS_TOKEN not set; skipping')
    return
  }

  const expectedZip = path.join(pathRunOutput, 'results.zip')
  let zipPath: string | null = null

  // Prefer an existing /output/results.zip written by the server app
  try {
    const st = await fs.stat(expectedZip)
    if (st.isFile() && st.size > 0) zipPath = expectedZip
  } catch {}

  // Otherwise zip the entire output directory (best-effort)
  if (!zipPath) {
    try {
      const st = await fs.stat(pathRunOutput)
      if (st.isDirectory()) {
        zipPath = await zipFolder(pathRunOutput)
        if (RESULTS_DEBUG) logger.info(`[uploadResultsToFileServer] zipped output dir to ${zipPath}`)
      }
    } catch {}
  }

  if (!zipPath) {
    logger.warn(
      `[uploadResultsToFileServer] No results found to upload (looked for: ${expectedZip}, or a directory at ${pathRunOutput}). Skipping.`,
    )
    return
  }

  const url = `${FILE_SERVER_URL}/upload_results/${consortiumId}/${runId}`
  logger.info(`[uploadResultsToFileServer] uploading ${zipPath} to ${url}`)

  if (RESULTS_DEBUG) {
    try {
      const st = await fs.stat(zipPath)
      logger.info(`[uploadResultsToFileServer] upload bytes=${st.size} runId=${runId} consortiumId=${consortiumId}`)
    } catch {}
  }

  const formData = new FormData()
  formData.append('file', createReadStream(zipPath), 'results.zip')

  await axios.post(url, formData, {
    headers: {
      ...formData.getHeaders(),
      'x-access-token': ACCESS_TOKEN,
    },
    maxBodyLength: Infinity,
    maxContentLength: Infinity,
  })

  logger.info('[uploadResultsToFileServer] results uploaded')

  // cleanup only if we created a temp zip
  if (zipPath !== expectedZip) {
    try {
      await fs.rm(zipPath)
    } catch {}
  }
}
