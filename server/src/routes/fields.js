/**
 * Fields Router
 * Dynamic router for all custom field handlers.
 * Routes field requests to the appropriate block handler.
 */

import { Router } from 'express';
import { authenticationMiddleware, logger } from '@workflow-toolkit/shared';
import { findFieldHandler, getFieldHandler } from './auto-loader.js';

const TAG = 'fields_router';
const router = Router();

/**
 * Universal field endpoint with block and field name
 * Format: /monday/fields/:blockName/:fieldName
 * Example: /monday/fields/formula-to-text/get_formula_columns
 */
router.post('/monday/fields/:blockName/:fieldName', authenticationMiddleware, async (req, res) => {
  const { blockName, fieldName } = req.params;

  logger.info('Field request received', TAG, { blockName, fieldName });

  const handler = getFieldHandler(blockName, fieldName);

  if (!handler) {
    logger.warn('Field handler not found', TAG, { blockName, fieldName });
    return res.status(404).json({
      error: 'Field handler not found',
      block: blockName,
      field: fieldName
    });
  }

  try {
    return await handler(req, res);
  } catch (err) {
    logger.error('Error in field handler', TAG, {
      blockName,
      fieldName,
      error: err.message,
      stack: err.stack
    });
    return res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * Simplified field endpoint (searches all blocks)
 * Format: /monday/:fieldName
 * Example: /monday/get_formula_columns
 *
 * This maintains backward compatibility with existing field configurations
 */
router.post('/monday/:fieldName', authenticationMiddleware, async (req, res) => {
  const { fieldName } = req.params;

  // Skip if it looks like an action route
  if (fieldName === 'execute_action') {
    return res.status(404).json({ error: 'Not found' });
  }

  logger.info('Field request received (auto-detect block)', TAG, { fieldName });

  const result = findFieldHandler(fieldName);

  if (!result) {
    logger.warn('Field handler not found in any block', TAG, { fieldName });
    return res.status(404).json({
      error: 'Field handler not found',
      field: fieldName
    });
  }

  const { blockName, handler } = result;

  logger.info('Found field handler', TAG, { blockName, fieldName });

  try {
    return await handler(req, res);
  } catch (err) {
    logger.error('Error in field handler', TAG, {
      blockName,
      fieldName,
      error: err.message,
      stack: err.stack
    });
    return res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
