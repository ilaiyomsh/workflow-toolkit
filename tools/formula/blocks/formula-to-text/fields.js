/**
 * Formula to Text - Field Handlers
 * Custom field handlers for the formula-to-text block.
 */

import { getFormulaColumns, logger } from '@workflow-toolkit/shared';

const TAG = 'formula_to_text_fields';

/**
 * Get formula columns for a board
 * Used as a remote options handler for the FormulaColumnId field
 */
export async function getFormulaColumnsHandler(req, res) {
  logger.info('getFormulaColumns called', TAG);
  logger.info('Request body', TAG, req.body);

  const { shortLivedToken } = req.session;
  const payload = req.body?.payload;

  logger.info('Payload received', TAG, payload);

  const dependencyData = payload?.dependencyData;

  // Get board ID from dependency data - check multiple possible locations
  const boardId = dependencyData?.boardId?.value
    || dependencyData?.board?.value
    || payload?.inputFields?.boardId?.value
    || payload?.inputFields?.board?.value;

  logger.info('Extracted boardId', TAG, { boardId, dependencyData });

  if (!boardId) {
    logger.warn('No boardId found, returning empty array', TAG);
    return res.status(200).send([]);
  }

  try {
    logger.info('Fetching formula columns from Monday API', TAG, { boardId });
    const columns = await getFormulaColumns(shortLivedToken, boardId);
    logger.info('Formula columns retrieved', TAG, { count: columns.length, columns });
    return res.status(200).send(columns);
  } catch (err) {
    logger.error('Failed to get formula columns', TAG, { boardId, error: err.message, stack: err.stack });
    return res.status(500).send({ message: 'internal server error' });
  }
}

/**
 * Export all field handlers
 */
export const fieldHandlers = {
  'get_formula_columns': getFormulaColumnsHandler,
};
