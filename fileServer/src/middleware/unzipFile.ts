// unzipFile.ts
import path from 'path'
import unzipper from 'unzipper'
import fs from 'fs-extra'
import { Request, Response, NextFunction } from 'express'
import getConfig from '../config/getConfig.js'
import { logger } from '../logger.js'

export const unzipFile = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    if (!req.file) {
      throw new Error('No file uploaded')
    }

    const zipPath = req.file.path
    const { consortiumId, runId } = req.params
    const config = await getConfig()
    const { baseDir } = config
    const extractPath = path.join(baseDir, consortiumId, runId)
    const tmpPath = path.join(extractPath, 'tmp.zip')

    // Ensure the extraction directory exists and copy the uploaded file to a temporary location
    await fs.ensureDir(extractPath)
    await fs.copy(zipPath, tmpPath)

    logger.info(
      `Paths for extraction - \ntmpPath: ${tmpPath}, \nzipPath: ${zipPath}, \nextractPath: ${extractPath}`,
    )

    try {
      // Extract the zip file
      await fs
        .createReadStream(tmpPath)
        .pipe(unzipper.Extract({ path: extractPath }))
        .promise()
    } catch (error) {
      logger.warn(
        `Error extracting the file: ${JSON.stringify(error)}. \nContinuing...`,
      )
    }

    logger.info(`File uploaded and extracted successfully to ${extractPath}`)
    next()
  } catch (error) {
    logger.error(`Error during file extraction: ${(error as Error).message}`)
    next(error)
  }
}
