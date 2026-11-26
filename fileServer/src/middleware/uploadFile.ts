import { Request, Response, NextFunction } from 'express'
import multer from 'multer'
import fs from 'fs'
import path from 'path'
import { BASE_DIR } from '../config.js'
import { logger } from '../logger.js'
import calculateChecksum from '../utils/calculateChecksum.js'

export const INCOMING_DIR = path.join(BASE_DIR, '.incoming')

// Without a filename callback multer picks a random name, so the client never
// chooses where the upload lands.
const upload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => {
      fs.promises.mkdir(INCOMING_DIR, { recursive: true, mode: 0o700 })
        .then(() => cb(null, INCOMING_DIR), (error) => cb(error, INCOMING_DIR))
    },
  }),
  limits: { files: 1, fields: 0 },
}).single('file')

export const uploadFile = (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  upload(req, res, async (err) => {
    if (err) {
      logger.error(`Error during file upload: ${err}`)
      res.status(err instanceof multer.MulterError ? 400 : 500).send('Error during file upload')
      return
    }

    if (!req.file) {
      res.status(400).send('No file uploaded')
      return
    }

    try {
      const checksum = await calculateChecksum(req.file.path)
      logger.info(`Received ${req.file.size} byte upload with checksum ${checksum}`)
    } catch (error) {
      await fs.promises.rm(req.file.path, { force: true })
      logger.error(`Error processing uploaded file: ${error}`)
      res.status(500).send('Error processing uploaded file')
      return
    }
    next()
  })
}
