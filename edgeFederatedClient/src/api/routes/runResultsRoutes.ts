// src/routes/runFilesRoutes.ts
import { Router } from 'express';
import { authenticate } from '../middlewares/authMiddleware.js'; // Ensure this middleware is implemented
import { listRunFiles, serveRunFile } from '../controllers/runResultsFilesController.js';

const router = Router();

// Apply authentication middleware to all routes under /run-files
router.use(authenticate);

// Define the routes
router.get('/:consortiumId/:runId', listRunFiles);
router.get('/:consortiumId/:runId/*', serveRunFile);

export default router;
