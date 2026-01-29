/**
 * Handle Mirror Column
 * Resolves mirror columns by fetching linked items and resolving values from target board.
 * 
 * OPTIMIZATION (2026-01):
 * Uses mirrored_items field to fetch all data in a single query instead of
 * multiple queries (display_value + linked_items + each item's values).
 */

import { 
  fetchLinkedItemIds, 
  fetchLinkedItemIdsBatch,
  fetchMirrorDeep,
  fetchItemsMirrorDeep,
} from './graphql-queries.js';
import { parseNumericValues, applyAggregationFunction } from '../column-value-extractor.js';

/**
 * Extracts the board_relation column ID from mirror settings.
 * Mirror settings contain: { "relation_column": { "board_relation_xyz": true } }
 *
 * @param {Object} mirrorSettings - Mirror column settings
 * @returns {string|null} Relation column ID or null
 */
export function extractRelationColumnId(mirrorSettings) {
  const relationColumn = mirrorSettings?.relation_column;

  if (!relationColumn || typeof relationColumn !== 'object') {
    return null;
  }

  // relation_column is an object like { "board_relation_xyz": true }
  const keys = Object.keys(relationColumn);
  return keys.length > 0 ? keys[0] : null;
}

/**
 * Handles a mirror column.
 * 
 * STRATEGY:
 * 1. Fetch mirror with deep mirrored_items in ONE query.
 * 2. Try to use display_value directly (Fast Path).
 * 3. Fallback to recursive resolution if display_value is empty.
 *
 * @param {Object} options
 * @param {string} options.boardId - Board ID (source board)
 * @param {Object} options.column - Column definition with settings
 * @param {number} options.itemId - Item ID
 * @param {Object} options.apiClient - Monday API client
 * @param {Object} options.schemaCache - Schema cache instance
 * @param {Set<string>} options.visitedPaths - Set of visited paths for cycle detection
 * @param {Function} options.resolveColumnValue - Reference to resolveColumnValue for recursion
 * @returns {Promise<number|string>} Resolved value
 */
export async function handleMirror({
  boardId,
  column,
  itemId,
  apiClient,
  schemaCache,
  visitedPaths,
  resolveColumnValue,
}) {
  const settings = column.settings || {};
  const aggFunc = settings.function || 'sum';

  // 1. Fetch data
  const mirrorData = await fetchMirrorDeep(apiClient, itemId, column.id);
  const displayValue = mirrorData.display_value;
  const mirroredItems = mirrorData.mirrored_items || [];

  // 2. Try to use display_value directly (Fast Path)
  // This works for simple numeric mirrors or computed text strings
  if (displayValue && displayValue !== 'null' && displayValue !== '') {
    // Check if it's a list of numbers "10, 20"
    if (typeof displayValue === 'string' && /^-?\d+(\.\d+)?(,\s*-?\d+(\.\d+)?)*$/.test(displayValue)) {
       const values = parseNumericValues(displayValue);
       return applyAggregationFunction(values, aggFunc);
    }
    // If it's a single number
    const num = Number(displayValue);
    if (!isNaN(num) && displayValue !== '' && !Array.isArray(displayValue)) return num;
    
    // If it's text (e.g. "Project A, Project B")
    return displayValue;
  }

  // 3. Fallback: Recursion
  // If display_value is empty (complex mirror/formula), resolve via linked items
  if (mirroredItems.length === 0) return (aggFunc === 'sum' || aggFunc === 'avg' || aggFunc === 'count') ? 0 : '';

  const itemsNeedingRecursion = [];
  
  // Extract IDs to recurse
  for (const item of mirroredItems) {
    const linkedItemId = parseInt(item.linked_item?.id, 10);
    if (item.linked_board_id && linkedItemId) {
      itemsNeedingRecursion.push({
        boardId: item.linked_board_id,
        itemId: linkedItemId,
      });
    }
  }

  if (itemsNeedingRecursion.length === 0) return (aggFunc === 'sum' || aggFunc === 'avg' || aggFunc === 'count') ? 0 : '';

  // 4. Resolve Recursively
  const displayedLinkedColumns = settings.displayed_linked_columns;
  if (!displayedLinkedColumns || displayedLinkedColumns.length === 0) {
    return (aggFunc === 'sum' || aggFunc === 'avg' || aggFunc === 'count') ? 0 : '';
  }
  const targetColumnId = displayedLinkedColumns[0].column_ids?.[0];

  const recursionResults = await Promise.all(
    itemsNeedingRecursion.map(async ({ boardId: targetBoardId, itemId: targetItemId }) => {
      try {
        return await resolveColumnValue({
          boardId: String(targetBoardId),
          columnId: targetColumnId,
          itemId: targetItemId,
          apiClient,
          schemaCache,
          visitedPaths,
        });
      } catch (e) {
        return null;
      }
    })
  );

  // 5. Aggregate Results
  // Filter valid results
  const validResults = recursionResults.filter(v => v !== null && v !== '' && v !== undefined);
  
  if (validResults.length === 0) return (aggFunc === 'sum' || aggFunc === 'avg' || aggFunc === 'count') ? 0 : '';

  // Check if we have numbers or text
  const allNumbers = validResults.every(v => typeof v === 'number');
  
  if (allNumbers) {
    return applyAggregationFunction(validResults, aggFunc);
  } else {
    // Text aggregation (join with comma)
    return validResults.join(', ');
  }
}

/**
 * Handles a mirror column for multiple items (batch).
 * 
 * @param {Object} options
 * @param {string} options.boardId - Board ID (source board)
 * @param {Object} options.column - Column definition with settings
 * @param {number[]} options.itemIds - Array of item IDs
 * @param {Object} options.apiClient - Monday API client
 * @param {Object} options.schemaCache - Schema cache instance
 * @param {Set<string>} options.visitedPaths - Set of visited paths for cycle detection
 * @param {Function} options.resolveColumnValueBatch - Reference to batch resolver for recursion
 * @returns {Promise<Map<number, number|string>>} Map of itemId -> resolved value
 */
export async function handleMirrorBatch({
  boardId,
  column,
  itemIds,
  apiClient,
  schemaCache,
  visitedPaths,
  resolveColumnValueBatch,
}) {
  const result = new Map();
  const settings = column.settings || {};
  const aggFunc = settings.function || 'sum';
  const targetColumnId = settings.displayed_linked_columns?.[0]?.column_ids?.[0];

  const mirrorsData = await fetchItemsMirrorDeep(apiClient, itemIds, column.id);
  const recursionQueue = new Map(); // itemId -> [ {targetBoard, targetItem} ]

  // 1. First pass: Check display_values
  for (const itemId of itemIds) {
    const data = mirrorsData.get(itemId);
    const dv = data?.display_value;
    
    if (dv && dv !== 'null' && dv !== '') {
       // Try numeric parse
       if (typeof dv === 'string' && /^-?\d+(\.\d+)?(,\s*-?\d+(\.\d+)?)*$/.test(dv)) {
          const vals = parseNumericValues(dv);
          result.set(itemId, applyAggregationFunction(vals, aggFunc));
       } else {
          const num = Number(dv);
          result.set(itemId, (!isNaN(num) && dv !== '' && !Array.isArray(dv)) ? num : dv);
       }
    } else {
       // Needs recursion
       const items = data?.mirrored_items || [];
       if (items.length > 0 && targetColumnId) {
          recursionQueue.set(itemId, items.map(i => ({
             boardId: i.linked_board_id,
             itemId: parseInt(i.linked_item?.id, 10)
          })));
       } else {
          result.set(itemId, (aggFunc === 'sum' || aggFunc === 'avg' || aggFunc === 'count') ? 0 : '');
       }
    }
  }

  // 2. Batch Resolve Recursion
  if (recursionQueue.size > 0) {
     // Collect all targets by board
     const targetsByBoard = new Map();
     for (const targets of recursionQueue.values()) {
        for (const t of targets) {
           if (t.boardId && t.itemId) {
              if (!targetsByBoard.has(t.boardId)) targetsByBoard.set(t.boardId, new Set());
              targetsByBoard.get(t.boardId).add(t.itemId);
           }
        }
     }

     // Resolve each board
     const resolvedCache = new Map(); // id -> value
     await Promise.all(Array.from(targetsByBoard.entries()).map(async ([bId, ids]) => {
        try {
          const vals = await resolveColumnValueBatch({
             boardId: String(bId),
             columnId: targetColumnId,
             itemIds: Array.from(ids),
             apiClient,
             schemaCache,
             visitedPaths
          });
          for (const [id, val] of vals) resolvedCache.set(id, val);
        } catch (e) {
          // Ignore errors
        }
     }));

     // Aggregate per item
     for (const [itemId, targets] of recursionQueue) {
        const values = [];
        for (const t of targets) {
           const val = resolvedCache.get(t.itemId);
           if (val !== null && val !== undefined && val !== '') values.push(val);
        }
        
        if (values.length === 0) {
           result.set(itemId, (aggFunc === 'sum' || aggFunc === 'avg' || aggFunc === 'count') ? 0 : '');
        } else if (values.every(v => typeof v === 'number')) {
           result.set(itemId, applyAggregationFunction(values, aggFunc));
        } else {
           result.set(itemId, values.join(', '));
        }
     }
  }

  // Final check for any missing items in result
  for (const itemId of itemIds) {
    if (!result.has(itemId)) {
      result.set(itemId, (aggFunc === 'sum' || aggFunc === 'avg' || aggFunc === 'count') ? 0 : '');
    }
  }

  return result;
}

/**
 * Processes a mirror display_value that contains comma-separated numeric values.
 * Used when API returns display_value but aggregation is needed.
 *
 * @param {string} displayValue - Display value like "10, 20, 30"
 * @param {string} aggFunc - Aggregation function (sum, avg, min, max, count)
 * @returns {number} Aggregated result
 */
export function processMirrorDisplayValue(displayValue, aggFunc = 'sum') {
  if (!displayValue || typeof displayValue !== 'string') {
    return 0;
  }

  const values = parseNumericValues(displayValue);

  if (values.length === 0) {
    return 0;
  }

  return applyAggregationFunction(values, aggFunc);
}

export default { handleMirror, handleMirrorBatch, extractRelationColumnId, processMirrorDisplayValue };
