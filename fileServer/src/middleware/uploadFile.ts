import { Request, Response, NextFunction } from 'express'
import multer from 'multer'
import fs from 'fs'
import path from 'path'
import crypto from 'crypto'
import { BASE_DIR } from '../config.js'
import { logger } from '../logger.js'

function generateChecksumSync(filePath: string): string {
  const hash = crypto.createHash('sha256')
  const fileBuffer = fs.readFileSync(filePath)
  hash.update(fileBuffer)
  return hash.digest('hex')
}

export const uploadFile = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  const { consortiumId, runId } = req.params
  const uploadPath = path.join(BASE_DIR, consortiumId, runId)
  fs.mkdirSync(uploadPath, { recursive: true })

  const storage = multer.diskStorage({
    destination: (req, file, cb) => {
      cb(null, uploadPath)
    },
    filename: (req, file, cb) => cb(null, file.originalname),
  })

  const upload = multer({ storage }).single('file')

  upload(req, res, (err) => {
    if (err) {
      logger.error(`Error during file upload: ${err}`)
      return res.status(500).send(`Error during file upload: ${err.message}`)
    }

    if (!req.file) {
      return res.status(400).send('No file uploaded')
    }

    const uploadedFilePath = path.join(uploadPath, req.file.filename)

    // Ensure the file is completely written to disk
    try {
      const fileDescriptor = fs.openSync(uploadedFilePath, 'r+')
      fs.fsyncSync(fileDescriptor) // Ensure all writes are flushed to disk
      fs.closeSync(fileDescriptor) // Close the file descriptor

      const fileSize = fs.statSync(uploadedFilePath).size
      const checksum = generateChecksumSync(uploadedFilePath)

      logger.info(`File uploaded to ${uploadedFilePath}`)
      logger.info(`Uploaded file size: ${fileSize} bytes`)
      logger.info(`Uploaded file checksum: ${checksum}`)

      next()
    } catch (error) {
      logger.error(`Error processing uploaded file: ${error}`)
      return res
        .status(500)
        .send(`Error processing uploaded file: ${(error as Error).message}`)
    }
  })
}
