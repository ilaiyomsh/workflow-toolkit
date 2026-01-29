/**
 * Main Router
 * Combines all routes and provides health check endpoints.
 */

import { Router } from 'express';
import { loadTools, logRegistryStatus } from './auto-loader.js';
import actionsRouter from './actions.js';
import fieldsRouter from './fields.js';

const router = Router();

// Load tools and blocks on startup
await loadTools();
logRegistryStatus();

// Action routes - handles all block actions
router.use(actionsRouter);

// Field routes - handles all custom field requests
router.use(fieldsRouter);

// Health check endpoints
router.get('/', (req, res) => {
  res.json({
    ok: true,
    message: 'Workflow ToolKit App is healthy',
    version: '2.0.0'
  });
});

router.get('/health', (req, res) => {
  res.json({ ok: true, message: 'Healthy' });
});

export default router;
