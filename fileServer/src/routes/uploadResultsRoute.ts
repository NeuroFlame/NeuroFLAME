// fileServer/src/routes/uploadResultsRoute.ts

import { Router } from 'express'
import decodeAndValidateJWT from '../middleware/decodeAndValidateJWT.js'
import { uploadFile } from '../middleware/uploadFile.js'
import fs from 'fs'
import path from 'path'
import { BASE_DIR } from '../config.js'

const router = Router()

const RESULTS_DEBUG = (process.env.FILESERVER_RESULTS_DEBUG || '').toLowerCase() === 'true'

/**
 * Upload aggregated results for a run.
 *
 * Upload as multipart/form-data with field name: "file"
 * Stored at: <BASE_DIR>/<consortiumId>/<runId>/results/results.zip
 */
router.post(
  '/upload_results/:consortiumId/:runId',
  decodeAndValidateJWT,
  uploadFile, // IMPORTANT: uploadFile already does multer.single('file') internally
  async (req, res) => {
    try {
      const { consortiumId, runId } = req.params

      if (RESULTS_DEBUG) {
        // eslint-disable-next-line no-console
        console.log('[fileServer][upload_results] request', {
          consortiumId,
          runId,
          baseDir: BASE_DIR,
          hasFile: Boolean((req as any).file),
        })
      }


      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const decoded = ((req as any).decodedToken ?? res.locals.tokenPayload) as any

      const isCentral = Array.isArray(decoded?.roles) && decoded.roles.includes('central')

      // Central user (NeuroFLAME orchestrator) may upload results for any run.
      // Non-central tokens must match the target run/consortium.
      if (!isCentral && (decoded?.runId !== runId || decoded?.consortiumId !== consortiumId)) {
        if (RESULTS_DEBUG) {
          // eslint-disable-next-line no-console
          console.log('[fileServer][upload_results] token mismatch', { decoded, consortiumId, runId })
        }
        return res.status(403).json({ error: 'Forbidden' })
      }

      if (!req.file) {
        return res.status(400).json({ error: 'No file uploaded' })
      }

      const resultsDir = path.join(BASE_DIR, consortiumId, runId, 'results')
      fs.mkdirSync(resultsDir, { recursive: true })

      const uploadedPath = req.file.path
      const targetPath = path.join(resultsDir, 'results.zip')

      if (fs.existsSync(targetPath)) {
        fs.rmSync(targetPath)
      }
      fs.renameSync(uploadedPath, targetPath)

      if (RESULTS_DEBUG) {
        // eslint-disable-next-line no-console
        console.log('[fileServer][upload_results] stored', { targetPath, size: fs.statSync(targetPath).size })
      }

      return res.json({ message: 'Results uploaded', path: targetPath })
    } catch (e) {
      return res.status(500).json({ error: String(e) })
    }
  },
)

export default router
