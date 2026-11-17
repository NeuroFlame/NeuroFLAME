import { Router, Request, Response } from 'express'
import path from 'path'
import fs from 'fs'
import decodeAndValidateJWT from '../middleware/decodeAndValidateJWT.js'
import { BASE_DIR } from '../config.js'
import { ParticipantRunParams } from '../types.js'

const router = Router()

router.post(
  '/download/:consortiumId/:runId/:participantId',
  decodeAndValidateJWT,
  async (req: Request<ParticipantRunParams>, res: Response) => {
    const { consortiumId, runId, participantId } = req.params
    const tokenPayload = res.locals.tokenPayload

    if (
      !tokenPayload?.consortiumId ||
      !tokenPayload?.runId ||
      !tokenPayload?.participantId
    ) {
      return res.status(400).send('Missing required token payload data')
    }

    if (
      tokenPayload.consortiumId !== consortiumId ||
      tokenPayload.runId !== runId ||
      tokenPayload.participantId !== participantId
    ) {
      return res
        .status(400)
        .send('Token payload data does not match requested resource')
    }
    const relativePath = path.join(
      tokenPayload.consortiumId,
      tokenPayload.runId,
      `${tokenPayload.participantId}.zip`,
    )
    if (fs.existsSync(path.join(BASE_DIR, relativePath))) {
      // Pass root so a dot-folder in BASE_DIR isn't treated as a hidden file
      res.sendFile(relativePath, { root: BASE_DIR })
    } else {
      res.status(404).send('File not found')
    }
  },
)

export default router
