import fetch from 'node-fetch';
import logger from './logger/index.js';

const MONDAY_API_URL = 'https://api.monday.com/v2';
const TAG = 'monday_api';

/**
 * Creates an API client adapter for the formula engine resolver.
 * @param {string} token - The short-lived API token.
 * @returns {Object} - An object with a query function.
 */
export function createApiClient(token) {
  return {
    query: async (query, variables = {}) => {
      const response = await fetch(MONDAY_API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': token,
          'API-Version': '2025-10'
        },
        body: JSON.stringify({ query, variables })
      });

      const result = await response.json();

      // The Resolver expects data directly, without the wrapper
      return result.data;
    }
  };
}

/**
 * Fetches all formula columns from a board.
 * @param {string} token - The API token.
 * @param {string} boardId - The board ID.
 * @returns {Array} Array of {title, value} for dropdown options.
 */
/**
 * Gets the column type for a specific column on a board.
 * @param {Object} apiClient - The API client
 * @param {string} boardId - The board ID
 * @param {string} columnId - The column ID
 * @returns {Promise<string>} The column type
 */
export async function getColumnType(apiClient, boardId, columnId) {
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
export function formatValueForColumnType(columnType, value) {
  switch (columnType) {
    // Status: {"label": "Done"} or {"index": 1}
    case 'status':
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
        const year = parsedDate.getFullYear();
        const month = String(parsedDate.getMonth() + 1).padStart(2, '0');
        const day = String(parsedDate.getDate()).padStart(2, '0');
        const isoDate = `${year}-${month}-${day}`;
        return JSON.stringify({ date: isoDate });
      }
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
    case 'phone': {
      if (value.includes(':')) {
        const [countryCode, phone] = value.split(':').map(s => s.trim());
        return JSON.stringify({ phone, countryShortName: countryCode.toUpperCase() });
      }
      return JSON.stringify({ phone: value });
    }

    // Link: {"url": "https://...", "text": "display text"}
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
    case 'hour': {
      const timeParts = value.split(':');
      const hour = parseInt(timeParts[0], 10);
      const minute = parseInt(timeParts[1] || '0', 10);
      return JSON.stringify({ hour, minute });
    }

    // Week: {"week": {"startDate": "YYYY-MM-DD", "endDate": "YYYY-MM-DD"}}
    case 'week': {
      const [startDate, endDate] = value.split(',').map(d => d.trim());
      return JSON.stringify({ week: { startDate, endDate } });
    }

    // Location: {"lat": "29.97", "lng": "31.13", "address": "Address"}
    case 'location': {
      const parts = value.split(',').map(s => s.trim());
      const result = { lat: parts[0], lng: parts[1] };
      if (parts[2]) {
        result.address = parts.slice(2).join(',').trim();
      }
      return JSON.stringify(result);
    }

    // Country: {"countryCode": "US", "countryName": "United States"}
    case 'country': {
      if (value.includes(':')) {
        const [countryCode, countryName] = value.split(':').map(s => s.trim());
        return JSON.stringify({ countryCode: countryCode.toUpperCase(), countryName });
      }
      return JSON.stringify({ countryCode: value.toUpperCase(), countryName: value });
    }

    // People: {"personsAndTeams": [{"id": 123, "kind": "person"}]}
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
export async function updateColumnValue(apiClient, boardId, itemId, columnId, value) {
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

export async function getFormulaColumns(token, boardId) {
  const query = `
    query GetBoardColumns($boardId: [ID!]) {
      boards(ids: $boardId) {
        columns(types: [formula]) {
          id
          title
        }
      }
    }
  `;

  const variables = { boardId: [String(boardId)] };
  const requestBody = { query, variables };

  logger.info('Monday API Request - getFormulaColumns', TAG, {
    url: MONDAY_API_URL,
    method: 'POST',
    apiVersion: '2025-10',
    query: query.trim(),
    variables
  });

  const response = await fetch(MONDAY_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': token,
      'API-Version': '2025-10'
    },
    body: JSON.stringify(requestBody)
  });

  const result = await response.json();

  logger.info('Monday API Response - getFormulaColumns', TAG, {
    status: response.status,
    statusText: response.statusText,
    response: result
  });

  if (result.errors) {
    logger.error('Monday API returned errors', TAG, { errors: result.errors });
    throw new Error(result.errors[0].message);
  }

  const board = result.data?.boards?.[0];
  if (!board) throw new Error(`Board ${boardId} not found`);

  return board.columns.map(col => ({
    title: col.title,
    value: col.id
  }));
}

export default {
  createApiClient,
  getColumnType,
  formatValueForColumnType,
  updateColumnValue,
  getFormulaColumns,
};
