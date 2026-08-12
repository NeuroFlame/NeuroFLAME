// src/routes/runFilesRoutes.ts
import { Router } from 'express'
import {
  getRunError,
  listRunFiles,
  serveRunFile,
  serveRunFolder,
} from '../controllers/runResultsFilesController.js'

const router = Router()

// Define the routes
router.get('/error/:consortiumId/:runId/:participantId', getRunError)
router.get('/zip/:consortiumId/:runId/:participantId', serveRunFolder)
router.get('/:consortiumId/:runId/:participantId/*', serveRunFile)
router.get('/:consortiumId/:runId/:participantId', listRunFiles)
router.get('/zip/:consortiumId/:runId', serveRunFolder)
router.get('/:consortiumId/:runId/*', serveRunFile)
router.get('/:consortiumId/:runId', listRunFiles)

export default router
