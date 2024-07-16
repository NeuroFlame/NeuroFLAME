import { Request, Response, NextFunction } from 'express'
import multer from 'multer'
import fs from 'fs'
import path from 'path'
import crypto from 'crypto'
import getConfig from '../config/getConfig.js'

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
  const config = await getConfig()
  const { baseDir } = config
  const { consortiumId, runId } = req.params
  const uploadPath = path.join(baseDir, consortiumId, runId)
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
      console.error('Error during file upload:', err)
      return res.status(500).send(`Error during file upload: ${err.message}`)
    }

    if (!req.file) {
      return res.status(400).send('No file uploaded')
    }

    const uploadedFilePath = path.join(uploadPath, req.file.filename)

    try {
      const fileSize = fs.statSync(uploadedFilePath).size
      const checksum = generateChecksumSync(uploadedFilePath)

      console.log(`File uploaded to ${uploadedFilePath}`)
      console.log(`Uploaded file size: ${fileSize} bytes`)
      console.log(`Uploaded file checksum: ${checksum}`)
      
      next()
    } catch (error) {
      console.error('Error processing uploaded file:', error)
      return res
        .status(500)
        .send(`Error processing uploaded file: ${(error as Error).message}`)
    }
  })
}
