/**
 * Actions Router
 * Dynamic router for all block actions.
 * Routes action requests to the appropriate block handler.
 */

import { Router } from 'express';
import { authenticationMiddleware, logger } from '@workflow-toolkit/shared';
import { getBlock, getAllBlockNames, registry } from './auto-loader.js';

const TAG = 'actions_router';
const router = Router();

/**
 * Universal action endpoint
 * Handles all action requests and routes them to the appropriate block.
 *
 * The block can be identified by:
 * 1. URL parameter: /monday/execute_action/:blockName
 * 2. Payload metadata: req.body.payload.blockMetadata?.name
 * 3. Falls back to the first registered block if only one exists
 */
router.post('/monday/execute_action/:blockName?', authenticationMiddleware, async (req, res) => {
  try {
    // Try to get block name from URL parameter
    let blockName = req.params.blockName;

    // If not in URL, try to get from payload
    if (!blockName) {
      blockName = req.body.payload?.blockMetadata?.name;
    }

    // If still no block name and we have exactly one block, use it
    if (!blockName) {
      const blockNames = getAllBlockNames();
      if (blockNames.length === 1) {
        blockName = blockNames[0];
        logger.debug('Using single registered block', TAG, { blockName });
      }
    }

    if (!blockName) {
      logger.warn('No block name provided', TAG, {
        params: req.params,
        payloadBlockMetadata: req.body.payload?.blockMetadata
      });
      return res.status(400).json({
        severityCode: 4000,
        notificationErrorTitle: "Block not specified",
        notificationErrorDescription: "The action block name was not provided",
        runtimeErrorDescription: "Missing block identifier in request"
      });
    }

    const block = getBlock(blockName);

    if (!block) {
      logger.warn('Block not found', TAG, { blockName });
      return res.status(404).json({
        severityCode: 6000,
        notificationErrorTitle: "Block not found",
        notificationErrorDescription: `The action block '${blockName}' does not exist`,
        runtimeErrorDescription: `Unknown block: ${blockName}`
      });
    }

    if (!block.executeAction) {
      logger.error('Block has no executeAction handler', TAG, { blockName });
      return res.status(500).json({
        severityCode: 4000,
        notificationErrorTitle: "Invalid block configuration",
        notificationErrorDescription: `The block '${blockName}' is not properly configured`,
        runtimeErrorDescription: `Block ${blockName} missing executeAction handler`
      });
    }

    logger.info('Routing action to block', TAG, { blockName });

    // Execute the block's action handler
    return await block.executeAction(req, res);

  } catch (err) {
    logger.error('Error in action router', TAG, { error: err.message, stack: err.stack });
    return res.status(500).json({
      severityCode: 4000,
      notificationErrorTitle: "Internal server error",
      notificationErrorDescription: "An unexpected error occurred",
      runtimeErrorDescription: err.message
    });
  }
});

export default router;
