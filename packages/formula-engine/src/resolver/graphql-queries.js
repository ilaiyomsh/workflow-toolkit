/**
 * GraphQL Queries for Resolver
 * API queries needed for recursive column value resolution.
 * Optimized for API version 2026-01
 */

// ============================================================================
// OPTIMIZED QUERIES - Use mirrored_items for deep fetching
// ============================================================================

/**
 * Optimized query that fetches mirror value with linked items info.
 * 
 * NOTE: mirrored_value only works for simple columns (numbers, text, status).
 * For formula/mirror columns, mirrored_value returns null with 403 errors.
 * In those cases, we use linked_item.id to query separately.
 * 
 * This still saves 1 API call (no need for separate linked_item_ids query).
 */
const GET_MIRROR_DEEP = `
  query GetMirrorDeep($itemId: ID!, $columnId: String!) {
    items(ids: [$itemId]) {
      id
      column_values(ids: [$columnId]) {
        id
        type
        ... on MirrorValue {
          display_value
          mirrored_items {
            linked_board_id
            linked_item {
              id
              name
            }
          }
        }
      }
    }
  }
`;

/**
 * Batch query for multiple columns on a single item.
 * Useful for formula dependencies.
 */
const GET_MULTI_COLUMNS_DEEP = `
  query GetMultiColumnsDeep($itemId: ID!, $columnIds: [String!]!) {
    items(ids: [$itemId]) {
      id
      column_values(ids: $columnIds) {
        id
        type
        text
        ... on FormulaValue { display_value }
        ... on MirrorValue {
          display_value
          mirrored_items {
            linked_board_id
            linked_item { id name }
          }
        }
        ... on NumbersValue { number }
        ... on StatusValue { label }
        ... on CheckboxValue { checked }
        
        # Support for text extraction from relations
        ... on BoardRelationValue {
          linked_items { id name }
        }
        ... on DependencyValue {
          linked_items { id name }
        }
      }
    }
  }
`;

/**
 * Batch query for multiple items - mirror with linked items info.
 * mirrored_value only works for simple types (numbers, text).
 */
const GET_ITEMS_MIRROR_DEEP = `
  query GetItemsMirrorDeep($itemIds: [ID!]!, $columnId: String!) {
    items(ids: $itemIds) {
      id
      column_values(ids: [$columnId]) {
        id
        type
        ... on MirrorValue {
          display_value
          mirrored_items {
            linked_board_id
            linked_item { id name }
          }
        }
      }
    }
  }
`;

// ============================================================================
// STANDARD QUERIES
// ============================================================================

/**
 * Query to get board columns with full settings.
 */
const GET_BOARD_COLUMNS = `
  query GetBoardColumns($boardId: ID!) {
    boards(ids: [$boardId]) {
      id
      name
      columns {
        id
        title
        type
        settings
      }
    }
  }
`;

/**
 * Query to get display_value for a column (single item).
 */
const GET_DISPLAY_VALUE = `
  query GetDisplayValue($itemId: ID!, $columnId: String!) {
    items(ids: [$itemId]) {
      id
      column_values(ids: [$columnId]) {
        id
        type
        text
        ... on FormulaValue {
          display_value
        }
        ... on MirrorValue {
          display_value
        }
        ... on NumbersValue {
          number
        }
      }
    }
  }
`;

/**
 * Query to get display_value for multiple items (batch).
 */
const GET_DISPLAY_VALUE_BATCH = `
  query GetDisplayValueBatch($boardId: ID!, $itemIds: [ID!]!, $columnId: String!) {
    boards(ids: [$boardId]) {
      items_page(query_params: { ids: $itemIds }, limit: 100) {
        items {
          id
          column_values(ids: [$columnId]) {
            id
            type
            text
            ... on FormulaValue {
              display_value
            }
            ... on MirrorValue {
              display_value
            }
            ... on NumbersValue {
              number
            }
          }
        }
      }
    }
  }
`;

/**
 * Query to get linked item IDs from a board_relation column.
 */
const GET_LINKED_ITEM_IDS = `
  query GetLinkedItemIds($itemId: ID!, $columnId: String!) {
    items(ids: [$itemId]) {
      id
      column_values(ids: [$columnId]) {
        ... on BoardRelationValue {
          linked_item_ids
        }
      }
    }
  }
`;

/**
 * Query to get linked item IDs for multiple items (batch).
 */
const GET_LINKED_ITEM_IDS_BATCH = `
  query GetLinkedItemIdsBatch($boardId: ID!, $itemIds: [ID!]!, $columnId: String!) {
    boards(ids: [$boardId]) {
      items_page(query_params: { ids: $itemIds }, limit: 100) {
        items {
          id
          column_values(ids: [$columnId]) {
            ... on BoardRelationValue {
              linked_item_ids
            }
          }
        }
      }
    }
  }
`;

/**
 * Query to get numeric value from a column.
 */
const GET_NUMERIC_VALUE = `
  query GetNumericValue($itemId: ID!, $columnId: String!) {
    items(ids: [$itemId]) {
      id
      column_values(ids: [$columnId]) {
        id
        type
        text
        ... on NumbersValue {
          number
        }
        ... on FormulaValue {
          display_value
        }
        ... on MirrorValue {
          display_value
        }
      }
    }
  }
`;

/**
 * Query to get multiple column values for a single item.
 * Used for resolving formula dependencies.
 */
const GET_COLUMN_VALUES = `
  query GetColumnValues($itemId: ID!, $columnIds: [String!]!) {
    items(ids: [$itemId]) {
      id
      column_values(ids: $columnIds) {
        id
        type
        text
        ... on NumbersValue {
          number
        }
        ... on FormulaValue {
          display_value
        }
        ... on MirrorValue {
          display_value
        }
        ... on StatusValue {
          label
        }
        ... on DateValue {
          date
          time
        }
        ... on CheckboxValue {
          checked
        }
      }
    }
  }
`;

// ============================================================================
// Query Functions
// ============================================================================

/**
 * Fetches board columns with settings.
 * @param {Object} apiClient - Monday API client
 * @param {string} boardId - Board ID
 * @returns {Promise<Array>} Array of column definitions
 */
export async function fetchBoardColumns(apiClient, boardId) {
  const response = await apiClient.query(GET_BOARD_COLUMNS, { boardId });

  const board = response.boards?.[0];
  if (!board) {
    throw new Error(`Board ${boardId} not found`);
  }

  return board.columns.map((col) => ({
    id: col.id,
    title: col.title,
    type: col.type,
    // settings is now a JSON object directly (not a string)
    settings: col.settings || {},
  }));
}

/**
 * Fetches display_value for a single item and column.
 * @param {Object} apiClient - Monday API client
 * @param {string} boardId - Board ID (unused but kept for consistency)
 * @param {string} columnId - Column ID
 * @param {number} itemId - Item ID
 * @returns {Promise<string|number|null>} Display value or null
 */
export async function fetchDisplayValue(apiClient, boardId, columnId, itemId) {
  const response = await apiClient.query(GET_DISPLAY_VALUE, {
    itemId: String(itemId),
    columnId,
  });

  const item = response.items?.[0];
  if (!item) {
    return null;
  }

  const colValue = item.column_values?.[0];
  if (!colValue) {
    return null;
  }

  // Try display_value first (Formula/Mirror)
  if (colValue.display_value !== undefined && colValue.display_value !== null) {
    return colValue.display_value;
  }

  // Try number (Numbers column)
  if (colValue.number !== undefined && colValue.number !== null) {
    return colValue.number;
  }

  // Fall back to text
  return colValue.text || null;
}

/**
 * Fetches display_value for multiple items (batch).
 * @param {Object} apiClient - Monday API client
 * @param {string} boardId - Board ID
 * @param {string} columnId - Column ID
 * @param {number[]} itemIds - Array of item IDs
 * @returns {Promise<Map<number, string|number|null>>} Map of itemId -> display value
 */
export async function fetchDisplayValueBatch(apiClient, boardId, columnId, itemIds) {
  const result = new Map();

  // Process in chunks of 100 (Monday API limit)
  const chunkSize = 100;
  for (let i = 0; i < itemIds.length; i += chunkSize) {
    const chunk = itemIds.slice(i, i + chunkSize);

    const response = await apiClient.query(GET_DISPLAY_VALUE_BATCH, {
      boardId,
      itemIds: chunk.map(String),
      columnId,
    });

    const items = response.boards?.[0]?.items_page?.items || [];

    for (const item of items) {
      const itemId = parseInt(item.id, 10);
      const colValue = item.column_values?.[0];

      if (!colValue) {
        result.set(itemId, null);
        continue;
      }

      // Try display_value first
      if (colValue.display_value !== undefined && colValue.display_value !== null) {
        result.set(itemId, colValue.display_value);
      } else if (colValue.number !== undefined && colValue.number !== null) {
        result.set(itemId, colValue.number);
      } else {
        result.set(itemId, colValue.text || null);
      }
    }
  }

  return result;
}

/**
 * Fetches linked item IDs from a board_relation column.
 * @param {Object} apiClient - Monday API client
 * @param {string} boardId - Board ID (unused but kept for consistency)
 * @param {number} itemId - Item ID
 * @param {string} relationColumnId - Board relation column ID
 * @returns {Promise<number[]>} Array of linked item IDs
 */
export async function fetchLinkedItemIds(apiClient, boardId, itemId, relationColumnId) {
  const response = await apiClient.query(GET_LINKED_ITEM_IDS, {
    itemId: String(itemId),
    columnId: relationColumnId,
  });

  const item = response.items?.[0];
  if (!item) {
    return [];
  }

  const colValue = item.column_values?.[0];
  if (!colValue?.linked_item_ids) {
    return [];
  }

  return colValue.linked_item_ids.map((id) => parseInt(id, 10));
}

/**
 * Fetches linked item IDs for multiple items (batch).
 * @param {Object} apiClient - Monday API client
 * @param {string} boardId - Board ID
 * @param {number[]} itemIds - Array of item IDs
 * @param {string} relationColumnId - Board relation column ID
 * @returns {Promise<Map<number, number[]>>} Map of itemId -> linked item IDs
 */
export async function fetchLinkedItemIdsBatch(apiClient, boardId, itemIds, relationColumnId) {
  const result = new Map();

  const chunkSize = 100;
  for (let i = 0; i < itemIds.length; i += chunkSize) {
    const chunk = itemIds.slice(i, i + chunkSize);

    const response = await apiClient.query(GET_LINKED_ITEM_IDS_BATCH, {
      boardId,
      itemIds: chunk.map(String),
      columnId: relationColumnId,
    });

    const items = response.boards?.[0]?.items_page?.items || [];

    for (const item of items) {
      const itemId = parseInt(item.id, 10);
      const colValue = item.column_values?.[0];

      if (colValue?.linked_item_ids) {
        result.set(itemId, colValue.linked_item_ids.map((id) => parseInt(id, 10)));
      } else {
        result.set(itemId, []);
      }
    }
  }

  return result;
}

/**
 * Fetches numeric value from a column.
 * @param {Object} apiClient - Monday API client
 * @param {string} boardId - Board ID (unused but kept for consistency)
 * @param {string} columnId - Column ID
 * @param {number} itemId - Item ID
 * @returns {Promise<number>} Numeric value or 0
 */
export async function fetchNumericValue(apiClient, boardId, columnId, itemId) {
  const response = await apiClient.query(GET_NUMERIC_VALUE, {
    itemId: String(itemId),
    columnId,
  });

  const item = response.items?.[0];
  if (!item) {
    return 0;
  }

  const colValue = item.column_values?.[0];
  if (!colValue) {
    return 0;
  }

  // Numbers column
  if (colValue.number !== undefined && colValue.number !== null) {
    return colValue.number;
  }

  // Formula/Mirror display_value
  if (colValue.display_value !== undefined && colValue.display_value !== null) {
    const num = parseFloat(colValue.display_value);
    return isNaN(num) ? 0 : num;
  }

  // Text fallback
  if (colValue.text) {
    const num = parseFloat(colValue.text);
    return isNaN(num) ? 0 : num;
  }

  return 0;
}

/**
 * Fetches multiple column values for a single item.
 * @param {Object} apiClient - Monday API client
 * @param {number} itemId - Item ID
 * @param {string[]} columnIds - Array of column IDs
 * @returns {Promise<Map<string, any>>} Map of columnId -> value
 */
export async function fetchColumnValues(apiClient, itemId, columnIds) {
  const result = new Map();

  if (columnIds.length === 0) {
    return result;
  }

  const response = await apiClient.query(GET_COLUMN_VALUES, {
    itemId: String(itemId),
    columnIds,
  });

  const item = response.items?.[0];
  if (!item) {
    return result;
  }

  for (const colValue of item.column_values || []) {
    let value;

    if (colValue.number !== undefined && colValue.number !== null) {
      value = colValue.number;
    } else if (colValue.display_value !== undefined && colValue.display_value !== null) {
      value = colValue.display_value;
    } else if (colValue.label !== undefined) {
      value = colValue.label;
    } else if (colValue.checked !== undefined) {
      value = colValue.checked;
    } else if (colValue.date !== undefined) {
      value = colValue.time ? `${colValue.date} ${colValue.time}` : colValue.date;
    } else {
      value = colValue.text || '';
    }

    result.set(colValue.id, value);
  }

  return result;
}

// ============================================================================
// OPTIMIZED FETCH FUNCTIONS
// ============================================================================

/**
 * Fetches mirror value with all mirrored data in one deep query.
 * This is the main optimization - replaces 3+ queries with 1.
 * 
 * @param {Object} apiClient - Monday API client
 * @param {number} itemId - Item ID
 * @param {string} columnId - Mirror column ID
 * @returns {Promise<Object>} Object with display_value and mirrored_items
 */
export async function fetchMirrorDeep(apiClient, itemId, columnId) {
  const response = await apiClient.query(GET_MIRROR_DEEP, {
    itemId: String(itemId),
    columnId,
  });

  const item = response.items?.[0];
  if (!item) {
    return { display_value: null, mirrored_items: [] };
  }

  const colValue = item.column_values?.[0];
  if (!colValue) {
    return { display_value: null, mirrored_items: [] };
  }

  return {
    display_value: colValue.display_value,
    mirrored_items: colValue.mirrored_items || [],
  };
}

/**
 * Fetches multiple columns with deep mirror values in one query.
 * Useful for formula dependency resolution.
 * 
 * @param {Object} apiClient - Monday API client
 * @param {number} itemId - Item ID
 * @param {string[]} columnIds - Array of column IDs
 * @returns {Promise<Map<string, Object>>} Map of columnId -> column value data
 */
export async function fetchMultiColumnsDeep(apiClient, itemId, columnIds) {
  const result = new Map();

  if (columnIds.length === 0) {
    return result;
  }

  const response = await apiClient.query(GET_MULTI_COLUMNS_DEEP, {
    itemId: String(itemId),
    columnIds,
  });

  const item = response.items?.[0];
  if (!item) {
    return result;
  }

  for (const colValue of item.column_values || []) {
    result.set(colValue.id, colValue);
  }

  return result;
}

/**
 * Fetches mirror values for multiple items with deep data.
 * 
 * @param {Object} apiClient - Monday API client
 * @param {number[]} itemIds - Array of item IDs
 * @param {string} columnId - Mirror column ID
 * @returns {Promise<Map<number, Object>>} Map of itemId -> mirror data
 */
export async function fetchItemsMirrorDeep(apiClient, itemIds, columnId) {
  const result = new Map();

  if (itemIds.length === 0) {
    return result;
  }

  // Process in chunks of 100 (Monday API limit)
  const chunkSize = 100;
  for (let i = 0; i < itemIds.length; i += chunkSize) {
    const chunk = itemIds.slice(i, i + chunkSize);

    const response = await apiClient.query(GET_ITEMS_MIRROR_DEEP, {
      itemIds: chunk.map(String),
      columnId,
    });

    const items = response.items || [];

    for (const item of items) {
      const itemId = parseInt(item.id, 10);
      const colValue = item.column_values?.[0];

      if (colValue) {
        result.set(itemId, {
          display_value: colValue.display_value,
          mirrored_items: colValue.mirrored_items || [],
        });
      } else {
        result.set(itemId, { display_value: null, mirrored_items: [] });
      }
    }
  }

  return result;
}

export default {
  fetchBoardColumns,
  fetchDisplayValue,
  fetchDisplayValueBatch,
  fetchLinkedItemIds,
  fetchLinkedItemIdsBatch,
  fetchNumericValue,
  fetchColumnValues,
  // Optimized functions
  fetchMirrorDeep,
  fetchMultiColumnsDeep,
  fetchItemsMirrorDeep,
};
