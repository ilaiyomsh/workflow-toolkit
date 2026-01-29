/**
 * Update Connected Items Action
 * Updates a column on ALL items connected via a Connect Boards column.
 */

import { createApiClient, logger, extractFieldValues } from '@workflow-toolkit/shared';

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
 * Gets the column type for a specific column on a board.
 * @param {Object} apiClient - The API client
 * @param {string} boardId - The board ID
 * @param {string} columnId - The column ID
 * @returns {Promise<string>} The column type
 */
async function getColumnType(apiClient, boardId, columnId) {
  const query = `
    query GetColumnType($boardId: [ID!]!, $columnId: [String!]!) {
      boards(ids: $boardId) {
        columns(ids: $columnId) {
          id
          type
        }
      }
    }
  `;

  const data = await apiClient.query(query, {
    boardId: [String(boardId)],
    columnId: [String(columnId)]
  });

  const column = data?.boards?.[0]?.columns?.[0];
  if (!column) {
    throw new Error(`Column ${columnId} not found on board ${boardId}`);
  }

  return column.type;
}

/**
 * Formats a value for the appropriate column type.
 * Based on Monday.com API documentation:
 * https://developer.monday.com/api-reference/reference/column-types-reference
 *
 * @param {string} columnType - The column type
 * @param {string} value - The raw value to format
 * @returns {string} JSON-formatted value for the API
 */
function formatValueForColumnType(columnType, value) {
  switch (columnType) {
    // Status: {"label": "Done"} or {"index": 1}
    case 'status':
      // If value is a number, use index; otherwise use label
      if (!isNaN(parseInt(value, 10)) && String(parseInt(value, 10)) === value) {
        return JSON.stringify({ index: parseInt(value, 10) });
      }
      return JSON.stringify({ label: value });

    // Text: plain string
    case 'text':
      return JSON.stringify(value);

    // Long Text: {"text": "Sample text"}
    case 'long_text':
      return JSON.stringify({ text: value });

    // Numbers: plain string or number
    case 'numbers':
      return JSON.stringify(value);

    // Date: {"date": "YYYY-MM-DD", "time": "HH:MM:SS"} (time optional)
    case 'date': {
      const parsedDate = new Date(value);
      if (!isNaN(parsedDate.getTime())) {
        // Use local date components to avoid timezone conversion issues
        const year = parsedDate.getFullYear();
        const month = String(parsedDate.getMonth() + 1).padStart(2, '0');
        const day = String(parsedDate.getDate()).padStart(2, '0');
        const isoDate = `${year}-${month}-${day}`;
        return JSON.stringify({ date: isoDate });
      }
      // If parsing fails, try to use the value as-is (might already be ISO format)
      return JSON.stringify({ date: value });
    }

    // Checkbox: {"checked": "true"} or {"checked": "false"}
    case 'checkbox': {
      const isChecked = value.toLowerCase() === 'true' || value === '1' || value.toLowerCase() === 'yes';
      return JSON.stringify({ checked: isChecked ? 'true' : 'false' });
    }

    // Rating: {"rating": 5}
    case 'rating':
      return JSON.stringify({ rating: parseInt(value, 10) });

    // Dropdown: {"labels": ["label1", "label2"]} or {"ids": ["1", "2"]}
    case 'dropdown': {
      const items = value.split(',').map(l => l.trim());
      // Check if all items are numeric (IDs)
      const allNumeric = items.every(item => !isNaN(parseInt(item, 10)));
      if (allNumeric) {
        return JSON.stringify({ ids: items });
      }
      return JSON.stringify({ labels: items });
    }

    // Email: {"email": "email@example.com", "text": "display text"}
    case 'email':
      return JSON.stringify({ email: value, text: value });

    // Phone: {"phone": "+12025550169", "countryShortName": "US"}
    // If value contains country code (e.g., "US:+12025550169"), parse it
    case 'phone': {
      if (value.includes(':')) {
        const [countryCode, phone] = value.split(':').map(s => s.trim());
        return JSON.stringify({ phone, countryShortName: countryCode.toUpperCase() });
      }
      // Default to no country code
      return JSON.stringify({ phone: value });
    }

    // Link: {"url": "https://...", "text": "display text"}
    // If value contains "|" separator, use it for text
    case 'link': {
      if (value.includes('|')) {
        const [url, text] = value.split('|').map(s => s.trim());
        return JSON.stringify({ url, text });
      }
      return JSON.stringify({ url: value, text: value });
    }

    // Timeline: {"from": "YYYY-MM-DD", "to": "YYYY-MM-DD"}
    case 'timeline': {
      const [from, to] = value.split(',').map(d => d.trim());
      return JSON.stringify({ from, to });
    }

    // Hour: {"hour": 16, "minute": 42}
    // Expects format "HH:MM" or "HH:MM:SS"
    case 'hour': {
      const timeParts = value.split(':');
      const hour = parseInt(timeParts[0], 10);
      const minute = parseInt(timeParts[1] || '0', 10);
      return JSON.stringify({ hour, minute });
    }

    // Week: {"week": {"startDate": "YYYY-MM-DD", "endDate": "YYYY-MM-DD"}}
    // Expects format "startDate,endDate"
    case 'week': {
      const [startDate, endDate] = value.split(',').map(d => d.trim());
      return JSON.stringify({ week: { startDate, endDate } });
    }

    // Location: {"lat": "29.97", "lng": "31.13", "address": "Address"}
    // Expects format "lat,lng,address" or "lat,lng"
    case 'location': {
      const parts = value.split(',').map(s => s.trim());
      const result = {
        lat: parts[0],
        lng: parts[1]
      };
      if (parts[2]) {
        result.address = parts.slice(2).join(',').trim();
      }
      return JSON.stringify(result);
    }

    // Country: {"countryCode": "US", "countryName": "United States"}
    // Expects format "CODE:Name" (e.g., "US:United States")
    case 'country': {
      if (value.includes(':')) {
        const [countryCode, countryName] = value.split(':').map(s => s.trim());
        return JSON.stringify({ countryCode: countryCode.toUpperCase(), countryName });
      }
      // If just country code provided, try to use it
      return JSON.stringify({ countryCode: value.toUpperCase(), countryName: value });
    }

    // People: {"personsAndTeams": [{"id": 123, "kind": "person"}]}
    // Expects comma-separated IDs (assumes all are persons)
    case 'people': {
      const ids = value.split(',').map(id => ({
        id: parseInt(id.trim(), 10),
        kind: 'person'
      }));
      return JSON.stringify({ personsAndTeams: ids });
    }

    // Tags: {"tag_ids": ["123", "456"]}
    case 'tags': {
      const tagIds = value.split(',').map(id => id.trim());
      return JSON.stringify({ tag_ids: tagIds });
    }

    // Color Picker: NOT supported for updates via API
    case 'color_picker':
      throw new Error('Color picker column cannot be updated via API');

    // World Clock: {"timezone": "America/New_York"}
    case 'world_clock':
      return JSON.stringify({ timezone: value });

    // Unsupported read-only columns
    case 'formula':
    case 'mirror':
    case 'auto_number':
    case 'creation_log':
    case 'last_updated':
    case 'button':
    case 'item_id':
      throw new Error(`Column type '${columnType}' is read-only and cannot be updated`);

    default:
      // For unknown types, try as plain text
      return JSON.stringify(value);
  }
}

/**
 * Updates a column value on an item.
 * @param {Object} apiClient - The API client
 * @param {string} boardId - The board ID
 * @param {string} itemId - The item ID
 * @param {string} columnId - The column ID
 * @param {string} value - The JSON-formatted value
 * @returns {Promise<string>} The updated item ID
 */
async function updateColumnValue(apiClient, boardId, itemId, columnId, value) {
  const mutation = `
    mutation UpdateColumnValue($boardId: ID!, $itemId: ID!, $columnId: String!, $value: JSON!) {
      change_column_value(
        board_id: $boardId
        item_id: $itemId
        column_id: $columnId
        value: $value
      ) {
        id
      }
    }
  `;

  const data = await apiClient.query(mutation, {
    boardId: String(boardId),
    itemId: String(itemId),
    columnId: String(columnId),
    value: value
  });

  return data?.change_column_value?.id;
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
  // Note: ColumnToupdate is the custom field key configured in Developer Center
  const { boardId_A, itemId, connectBoardsColumnId, connectedBoardId, ColumnToupdate, newValue } = extractFieldValues(
    inputFields,
    ['boardId_A', 'itemId', 'connectBoardsColumnId', 'connectedBoardId', 'ColumnToupdate', 'newValue']
  );

  // Alias for clarity
  const targetColumnId = ColumnToupdate;

  // Alias for clarity in code
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
    // Use connectedBoardId from Monday.com's built-in field (automatically provided)
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

    // Handle specific errors
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
