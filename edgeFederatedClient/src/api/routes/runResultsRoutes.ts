// src/routes/runFilesRoutes.ts
import { Router } from 'express'
import {
  getRunError,
  listRunFiles,
  serveRunFile,
  serveRunFolder,
} from '../controllers/runResultsFilesController.js'
import { isRunPathSegment } from '../runPathSegment.js'

const router = Router()

// Path IDs are joined into local paths; skip any route whose IDs are not ObjectIds.
for (const name of ['consortiumId', 'runId', 'participantId']) {
  router.param(name, (_req, _res, next, value) => {
    next(isRunPathSegment(value) ? undefined : 'route')
  })
}

// Define the routes
router.get('/error/:consortiumId/:runId/:participantId', getRunError)
router.get('/zip/:consortiumId/:runId/:participantId', serveRunFolder)
router.get('/:consortiumId/:runId/:participantId/*', serveRunFile)
router.get('/:consortiumId/:runId/:participantId', listRunFiles)
router.get('/zip/:consortiumId/:runId', serveRunFolder)
router.get('/:consortiumId/:runId/*', serveRunFile)
router.get('/:consortiumId/:runId', listRunFiles)

export default router
