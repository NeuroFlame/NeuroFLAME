import { Request, Response } from 'express'
import path from 'path'
import fs from 'fs'
import archiver from 'archiver'
import { getConfig } from '../../config/config.js'
import { logger } from '../../logger.js'

export const listRunFiles = async (req: Request, res: Response) => {
  try {
    const { path_base_directory: filesDirectory } = await getConfig()
    const { consortiumId, runId } = req.params
    const directoryPath = path.join(filesDirectory, consortiumId, runId, `results`)

    if (!fs.existsSync(directoryPath)) {
      logger.warn(`Directory not found: ${directoryPath}`)
      return res.status(404).json({ error: 'Run directory not found' })
    }

    fs.readdir(directoryPath, (err, files) => {
      if (err) {
        logger.error(`Error reading directory: ${err.message}`)
        return res.status(500).json({ error: 'Failed to list files' })
      }

      const fileList = files.map((file) => {
        const filePath = path.join(directoryPath, file)
        const stats = fs.statSync(filePath)

        return {
          name: file,
          size: stats.size,
          isDirectory: stats.isDirectory(),
          lastModified: stats.mtime,
          url: `${consortiumId}/${runId}/${file}`,
        }
      })

      res.json(fileList)
    })
  } catch (error) {
    logger.error(`Error in listRunFiles: ${(error as Error).message}`)
    res.status(500).json({ error: 'Internal Server Error' })
  }
}

export const serveRunFile = async (req: Request, res: Response) => {
  try {
    const { path_base_directory: filesDirectory } = await getConfig()
    const { consortiumId, runId, filename } = req.params
    const filePath = path.join(filesDirectory, consortiumId, runId, 'results', filename)

    // Validate the file path
    if (!filePath.startsWith(path.resolve(filesDirectory))) {
      logger.warn(`Attempt to access unauthorized path: ${filePath}`)
      return res.status(403).json({ error: 'Unauthorized access' })
    }

    if (fs.existsSync(filePath) && fs.lstatSync(filePath).isFile()) {
      res.sendFile(filePath)
    } else {
      logger.warn(`File not found: ${filePath}`)
      res.status(404).send('File not found')
    }
  } catch (error) {
    logger.error(`Error in serveRunFile: ${(error as Error).message}`)
    res.status(500).json({ error: 'Internal Server Error' })
  }
}

export const serveRunFolder = async (req: Request, res: Response) => {
  try {
    const { path_base_directory: filesDirectory } = await getConfig()
    const { consortiumId, runId } = req.params
    const directoryPath = path.join(filesDirectory, consortiumId, runId, `results`)

    console.log(directoryPath)

    if (!fs.existsSync(directoryPath)) {
      logger.warn(`Directory not found: ${directoryPath}`)
      return res.status(404).json({ error: 'Run directory not found' })
    }
    res.setHeader('Content-Type', 'application/zip')
    res.setHeader('Content-Disposition', `attachment; filename=${runId}_results.zip`)

    const archive = archiver('zip', {
      zlib: { level: 9 },
    })

    archive.on('error', (err) => {
      logger.error(`Archive error: ${err.message}`)
      res.status(500).end()
    })

    archive.pipe(res)
    archive.directory(directoryPath, false)
    archive.finalize()
  } catch (error) {
    logger.error(`Error in serveRunFolder: ${(error as Error).message}`)
    res.status(500).json({ error: 'Internal Server Error' })
  }
}
