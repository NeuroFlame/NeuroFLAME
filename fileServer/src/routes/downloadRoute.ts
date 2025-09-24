import { Router, Request, Response } from 'express'
import path from 'path'
import fs from 'fs'
import decodeAndValidateJWT from '../middleware/decodeAndValidateJWT.js'
import { BASE_DIR } from '../config.js'

const router = Router()

router.post(
  '/download/:consortiumId/:runId/:userId',
  decodeAndValidateJWT,
  async (req: Request, res: Response) => {
    const { consortiumId, runId, userId } = req.params
    const tokenPayload = res.locals.tokenPayload

    if (
      !tokenPayload?.consortiumId ||
      !tokenPayload?.runId ||
      !tokenPayload?.userId
    ) {
      return res.status(400).send('Missing required token payload data')
    }

    if (
      tokenPayload.consortiumId !== consortiumId ||
      tokenPayload.runId !== runId ||
      tokenPayload.userId !== userId
    ) {
      return res
        .status(400)
        .send('Token payload data does not match requested resource')
    }
    const filePath = path.join(
      BASE_DIR,
      tokenPayload.consortiumId,
      tokenPayload.runId,
      `${tokenPayload.userId}.zip`,
    )
    if (fs.existsSync(filePath)) {
      res.sendFile(filePath)
    } else {
      res.status(404).send('File not found')
    }
  },
)

export default router
