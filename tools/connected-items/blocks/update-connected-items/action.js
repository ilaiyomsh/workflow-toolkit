/**
 * Update Connected Items Action
 * Updates a column on ALL items connected via a Connect Boards column.
 */

import {
  createApiClient,
  logger,
  extractFieldValues,
  getColumnType,
  formatValueForColumnType,
  updateColumnValue
} from '@workflow-toolkit/shared';

const TAG = 'update_connected_items_action';

/**
 * Gets all linked item IDs from a Connect Boards column.
 * @param {Object} apiClient - The API client
 * @param {string} itemId - The source item ID
 * @param {string} connectColumnId - The connect boards column ID
 * @returns {Promise<Array<{id: string, boardId: string}>>} Array of linked items with their board IDs
 */
async function getConnectedItems(apiClient, itemId, connectColumnId) {
  const query = `
    query GetConnectedItems($itemId: [ID!]!, $columnId: [String!]!) {
      items(ids: $itemId) {
        column_values(ids: $columnId) {
          ... on BoardRelationValue {
            linked_item_ids
            linked_items {
              id
              board {
                id
              }
            }
          }
        }
      }
    }
  `;

  const data = await apiClient.query(query, {
    itemId: [String(itemId)],
    columnId: [String(connectColumnId)]
  });

  const columnValue = data?.items?.[0]?.column_values?.[0];
  if (!columnValue?.linked_items) {
    return [];
  }

  return columnValue.linked_items.map(item => ({
    id: item.id,
    boardId: item.board.id
  }));
}

/**
 * Controller for the 'Update Connected Items' action.
 * Updates a column on all items connected via a Connect Boards column.
 */
export async function executeAction(req, res) {
  const { accountId, userId, shortLivedToken } = req.session;
  const { inputFields } = req.body.payload;

  logger.info('Raw inputFields received', TAG, { inputFields });

  // Extract fields using Monday.com's built-in field keys
  const { boardId_A, itemId, connectBoardsColumnId, connectedBoardId, ColumnToupdate, newValue } = extractFieldValues(
    inputFields,
    ['boardId_A', 'itemId', 'connectBoardsColumnId', 'connectedBoardId', 'ColumnToupdate', 'newValue']
  );

  // Aliases for clarity
  const targetColumnId = ColumnToupdate;
  const boardId = boardId_A;
  const connectColumnId = connectBoardsColumnId;

  const loggingOptions = {
    accountId,
    userId,
    boardId,
    itemId,
    connectColumnId,
    connectedBoardId,
    targetColumnId,
    newValue
  };

  logger.info('Update connected items action received', TAG, loggingOptions);

  // Validate required fields
  if (!boardId || !itemId || !connectColumnId || !connectedBoardId || !targetColumnId) {
    logger.error('Missing required fields', TAG, loggingOptions);
    return res.status(400).json({
      severityCode: 4000,
      notificationErrorTitle: 'Missing required fields',
      notificationErrorDescription: 'Please provide all required fields: board, item, connect column, connected board, and target column',
      runtimeErrorDescription: 'Missing required input fields'
    });
  }

  try {
    const apiClient = createApiClient(shortLivedToken);

    // Step 1: Get all connected items
    logger.info('Fetching connected items', TAG, { itemId, connectColumnId });
    const connectedItems = await getConnectedItems(apiClient, itemId, connectColumnId);

    logger.info('Connected items retrieved', TAG, { count: connectedItems.length, connectedItems });

    // If no connected items, return success with 0 count
    if (connectedItems.length === 0) {
      logger.info('No connected items found', TAG);
      return res.status(200).json({
        outputFields: {
          updatedCount: 0,
          itemIds: ''
        }
      });
    }

    // Step 2: Determine column type from connected board
    const targetBoardId = connectedBoardId;
    logger.info('Getting column type', TAG, { targetBoardId, targetColumnId });

    const columnType = await getColumnType(apiClient, targetBoardId, targetColumnId);
    logger.info('Column type determined', TAG, { columnType });

    // Step 3: Format the value for the column type
    const formattedValue = formatValueForColumnType(columnType, newValue || '');
    logger.info('Value formatted', TAG, { columnType, newValue, formattedValue });

    // Step 4: Update all connected items
    const updatedIds = [];
    const errors = [];

    for (const item of connectedItems) {
      try {
        logger.info('Updating item', TAG, { itemId: item.id, boardId: item.boardId });
        const updatedId = await updateColumnValue(apiClient, item.boardId, item.id, targetColumnId, formattedValue);
        if (updatedId) {
          updatedIds.push(updatedId);
        }
      } catch (err) {
        logger.error('Failed to update item', TAG, { itemId: item.id, error: err.message });
        errors.push({ itemId: item.id, error: err.message });
      }
    }

    logger.info('Update completed', TAG, {
      totalItems: connectedItems.length,
      updatedCount: updatedIds.length,
      errorCount: errors.length
    });

    // Return success with results
    return res.status(200).json({
      outputFields: {
        updatedCount: updatedIds.length,
        itemIds: updatedIds.join(',')
      }
    });

  } catch (err) {
    logger.error('Update connected items action failed', TAG, { ...loggingOptions, error: err.message, stack: err.stack });

    if (err.message.includes('not found') || err.message.includes('404')) {
      return res.status(404).json({
        severityCode: 6000,
        notificationErrorTitle: 'Resource not found',
        notificationErrorDescription: 'The requested board, item, or column does not exist',
        runtimeErrorDescription: err.message,
        disableErrorDescription: 'Please check that the board, item, and columns are valid'
      });
    }

    return res.status(500).json({
      severityCode: 4000,
      notificationErrorTitle: 'Internal server error',
      notificationErrorDescription: 'An error occurred while updating connected items',
      runtimeErrorDescription: err.message
    });
  }
}
