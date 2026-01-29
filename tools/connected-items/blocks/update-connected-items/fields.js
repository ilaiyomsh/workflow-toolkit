/**
 * Update Connected Items - Field Handlers
 * Custom field handlers for the update-connected-items block.
 */

import { createApiClient, logger } from '@workflow-toolkit/shared';

const TAG = 'update_connected_items_fields';

/**
 * Get writable columns from the target board.
 * Used as a remote options handler for the ColumnToupdate field.
 * Depends on connectedBoardId (Monday.com built-in field) to determine which board to query.
 */
export async function getTargetColumnsHandler(req, res) {
  logger.info('getTargetColumns called', TAG);

  const { shortLivedToken } = req.session;
  const payload = req.body?.payload;

  const dependencyData = payload?.dependencyData;
  const inputFields = payload?.inputFields;

  // Get target board ID directly from connectedBoardId (Monday.com built-in field)
  // This is automatically provided by Monday.com when a connect column is selected
  const targetBoardId = dependencyData?.connectedBoardId?.value
    || dependencyData?.connectedBoardId
    || payload?.connectedBoardId?.value
    || payload?.connectedBoardId
    || inputFields?.connectedBoardId?.value
    || inputFields?.connectedBoardId;

  logger.info('Extracted target board ID', TAG, { targetBoardId });

  if (!targetBoardId) {
    logger.warn('Missing connectedBoardId, returning empty array', TAG);
    return res.status(200).send([]);
  }

  try {
    const apiClient = createApiClient(shortLivedToken);

    // Get all writable columns from the target board
    const query = `
      query GetWritableColumns($boardId: [ID!]!) {
        boards(ids: $boardId) {
          columns {
            id
            title
            type
          }
        }
      }
    `;

    const data = await apiClient.query(query, { boardId: [String(targetBoardId)] });

    const board = data?.boards?.[0];
    if (!board) {
      logger.warn('Target board not found', TAG, { targetBoardId });
      return res.status(200).send([]);
    }

    // Filter out read-only and system columns
    const readOnlyTypes = [
      'name',           // Item name (special handling needed)
      'formula',        // Read-only formula
      'auto_number',    // Auto-generated
      'creation_log',   // System column
      'last_updated',   // System column
      'button',         // Not a value column
      'board_relation', // Connect boards (different API)
      'dependency',     // Dependencies (special handling)
      'mirror',         // Mirror column (read-only)
      'subtasks',       // Subtasks column
      'doc',            // Document column
      'file'            // File column (different API)
    ];

    const columns = board.columns
      .filter(col => !readOnlyTypes.includes(col.type))
      .map(col => ({
        title: col.title,
        value: col.id
      }));

    logger.info('Writable columns retrieved', TAG, { count: columns.length });
    return res.status(200).send(columns);
  } catch (err) {
    logger.error('Failed to get target columns', TAG, { targetBoardId, error: err.message });
    return res.status(500).send({ message: 'internal server error' });
  }
}

/**
 * Export field handlers
 */
export const fieldHandlers = {
  'get_target_columns': getTargetColumnsHandler,
};
