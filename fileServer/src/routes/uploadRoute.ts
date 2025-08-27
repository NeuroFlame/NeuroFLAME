// uploadRoute.ts
import { Router, Request, Response, NextFunction } from 'express'
import decodeAndValidateJWT from '../middleware/decodeAndValidateJWT.js'
import isCentralUser from '../middleware/isCentralUser.js'
import { uploadFile } from '../middleware/uploadFile.js'
import { unzipFile } from '../middleware/unzipFile.js'

const router = Router()

router.post(
  '/upload/:consortiumId/:runId',
  decodeAndValidateJWT,
  isCentralUser,
  uploadFile,
  unzipFile,
  (req: Request, res: Response) => {
    res.send('File uploaded and extracted successfully!')
  },
)

export default router
