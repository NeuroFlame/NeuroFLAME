// fileServer/src/routes/downloadResultsRoute.ts

import { Router } from 'express'
import decodeAndValidateJWT from '../middleware/decodeAndValidateJWT.js'
import fs from 'fs'
import path from 'path'
import { BASE_DIR } from '../config.js'

const router = Router()

const RESULTS_DEBUG = (process.env.FILESERVER_RESULTS_DEBUG || '').toLowerCase() === 'true'

function firstExisting(paths: string[]): string | null {
  for (const p of paths) {
    if (fs.existsSync(p)) return p
  }
  return null
}

/**
 * Download aggregated results for a run.
 *
 * Returns (preferred): <BASE_DIR>/<consortiumId>/<runId>/results/results.zip
 * Fallback (legacy):  <BASE_DIR>/<consortiumId>/<runId>/results.zip
 */
router.all(
  '/download_results/:consortiumId/:runId',
  decodeAndValidateJWT,
  async (req, res) => {
    try {
      const { consortiumId, runId } = req.params

      if (RESULTS_DEBUG) {
        // eslint-disable-next-line no-console
        console.log('[fileServer][download_results] request', { consortiumId, runId, baseDir: BASE_DIR })
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const decoded = ((req as any).decodedToken ?? res.locals.tokenPayload) as any

      const roles: unknown = decoded?.roles
      const isCentral = Array.isArray(roles) && roles.includes('central')

      // In some deployments the access token is user-scoped and only contains userId.
      // We allow any valid user-scoped token to download results for now.
      // If run/consortium claims are present, enforce they match.
      const hasRunClaims = typeof decoded?.runId === 'string' || typeof decoded?.consortiumId === 'string'
      const hasUserId = typeof decoded?.userId === 'string' || typeof decoded?.user_id === 'string'

      if (!isCentral) {
        if (hasRunClaims) {
          if (decoded?.runId !== runId || decoded?.consortiumId !== consortiumId) {
            if (RESULTS_DEBUG) {
              // eslint-disable-next-line no-console
              console.log('[fileServer][download_results] token mismatch', { decoded, consortiumId, runId })
            }
            return res.status(403).json({ error: 'Forbidden' })
          }
        } else if (!hasUserId) {
          if (RESULTS_DEBUG) {
            // eslint-disable-next-line no-console
            console.log('[fileServer][download_results] missing userId in token payload', { decoded })
          }
          return res.status(401).json({ error: 'Invalid token payload' })
        }
      }

      const candidates = [
        path.join(BASE_DIR, consortiumId, runId, 'results', 'results.zip'),
        path.join(BASE_DIR, consortiumId, runId, 'results.zip'),
      ]
      const resultsZipPath = firstExisting(candidates)

      if (!resultsZipPath) {
        if (RESULTS_DEBUG) {
          // eslint-disable-next-line no-console
          console.log('[fileServer][download_results] missing', { candidates })
        }
        return res.status(404).json({ error: 'results.zip not found' })
      }

      if (RESULTS_DEBUG) {
        // eslint-disable-next-line no-console
        console.log('[fileServer][download_results] sending', { resultsZipPath, size: fs.statSync(resultsZipPath).size })
      }

      return res.download(resultsZipPath, 'results.zip')
    } catch (e) {
      if (RESULTS_DEBUG) {
        // eslint-disable-next-line no-console
        console.log('[fileServer][download_results] error', e)
      }
      return res.status(500).json({ error: String(e) })
    }
  },
)

export default router
