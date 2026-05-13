// src/routes/runFilesRoutes.ts
import { Router } from 'express'
import {
  listRunFiles,
  serveRunFile,
  serveRunFolder,
} from '../controllers/runResultsFilesController.js'

const router = Router()

// Define the routes
router.get('/zip/:consortiumId/:runId/:participantId', serveRunFolder)
router.get('/:consortiumId/:runId/:participantId/*', serveRunFile)
router.get('/:consortiumId/:runId/:participantId', listRunFiles)
router.get('/zip/:consortiumId/:runId', serveRunFolder)
router.get('/:consortiumId/:runId/*', serveRunFile)
router.get('/:consortiumId/:runId', listRunFiles)

export default router
