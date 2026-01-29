/**
 * Resolve Column Value
 * Main entry point for resolving Formula/Mirror column values recursively.
 * 
 * Strategy:
 * 1. Check value cache first (optimization)
 * 2. Try display_value (optimization)
 * 3. If null or needs processing → recursion
 * 4. Cache result for reuse
 * 
 * OPTIMIZATIONS (2026-01):
 * - Value caching prevents repeated API calls for same item/column
 * - Mirrors use mirrored_items field for deep fetching in one query
 */

import { fetchDisplayValue, fetchDisplayValueBatch, fetchNumericValue } from './graphql-queries.js';
import { handleFormula, handleFormulaBatch } from './handle-formula.js';
import { handleMirror, handleMirrorBatch, processMirrorDisplayValue } from './handle-mirror.js';
import { parseNumericValues, applyAggregationFunction } from '../column-value-extractor.js';
import { extractColumnIds } from '../index.js';
import { analyzeFormulaDependencies, analyzeMirrorTarget } from './strategy-selector.js';

/**
 * Resolves the actual value of a Formula/Mirror column for a single item.
 * Returns the exact value as displayed in the Monday.com UI.
 * 
 * @param {Object} options
 * @param {string} options.boardId - Board ID
 * @param {string} options.columnId - Column ID (formula, mirror, or numbers)
 * @param {number} options.itemId - Item ID
 * @param {Object} options.apiClient - Monday API client { query: fn }
 * @param {Object} options.schemaCache - Schema cache instance
 * @param {Set<string>} [options.visitedPaths] - Internal: paths visited for cycle detection
 * @returns {Promise<number|string>} The resolved value
 */
export async function resolveColumnValue({
  boardId,
  columnId,
  itemId,
  apiClient,
  schemaCache,
  visitedPaths = new Set(),
}) {
  // 0. Check value cache first (if supported by schemaCache)
  if (schemaCache.hasValue && schemaCache.hasValue(boardId, columnId, itemId)) {
    return schemaCache.getCachedValue(boardId, columnId, itemId);
  }

  // 0.5 Check if resolution is already pending (Optimization 2: Deduplication)
  if (schemaCache.hasPendingValue && schemaCache.hasPendingValue(boardId, columnId, itemId)) {
    return schemaCache.getPendingValue(boardId, columnId, itemId);
  }

  // 1. Cycle detection
  const pathKey = `${boardId}:${columnId}:${itemId}`;
  if (visitedPaths.has(pathKey)) {
    console.warn(`Cycle detected at ${pathKey}, returning 0`);
    return 0;
  }
  visitedPaths.add(pathKey);

  // Create resolution promise and track it (Optimization 2: Deduplication)
  const resolutionPromise = resolveColumnValueInternal({
    boardId,
    columnId,
    itemId,
    apiClient,
    schemaCache,
    visitedPaths,
  });

  if (schemaCache.setPendingValue) {
    schemaCache.setPendingValue(boardId, columnId, itemId, resolutionPromise);
  }

  try {
    const result = await resolutionPromise;
    return result;
  } finally {
    visitedPaths.delete(pathKey);
    if (schemaCache.removePendingValue) {
      schemaCache.removePendingValue(boardId, columnId, itemId);
    }
  }
}

/**
 * Internal resolver (called after deduplication check).
 */
async function resolveColumnValueInternal({
  boardId,
  columnId,
  itemId,
  apiClient,
  schemaCache,
  visitedPaths,
}) {
  // 2. Get column definition from cache
  const column = await schemaCache.getColumn(boardId, columnId);

  if (!column) {
    console.warn(`Column ${columnId} not found in board ${boardId}`);
    return '';
  }

  let result;

  // 3. For mirrors, use optimized deep fetch (skips display_value step)
  if (column.type === 'mirror') {
    result = await handleMirror({
      boardId,
      column,
      itemId,
      apiClient,
      schemaCache,
      visitedPaths,
      resolveColumnValue,
    });
  }
  // 4. For formulas, check if we should skip display_value fetch
  else if (column.type === 'formula') {
    const formula = column.settings?.formula;
    let shouldSkipDisplayValue = false;
    
    // OPTIMIZATION: If all dependencies are complex (mirrors/formulas),
    // display_value will always be "null" - skip the API call
    if (formula) {
      const dependencyColumnIds = extractColumnIds(formula);
      const depAnalysis = analyzeFormulaDependencies(dependencyColumnIds);
      shouldSkipDisplayValue = depAnalysis.allComplex;
    }
    
    if (shouldSkipDisplayValue) {
      // Skip display_value fetch - go straight to recursive resolution
      result = await handleFormula({
        boardId,
        column,
        itemId,
        apiClient,
        schemaCache,
        visitedPaths,
        resolveColumnValue,
      });
    } else {
      // Try display_value first (might work for simple formulas)
      const displayValue = await fetchDisplayValue(apiClient, boardId, columnId, itemId);
      const isNullish = displayValue === null || displayValue === undefined || displayValue === 'null' || displayValue === '';
      
      if (!isNullish) {
        // Strict typing: Only convert if it's a pure number string
        if (typeof displayValue === 'string' && /^-?\d+(\.\d+)?$/.test(displayValue)) {
          result = parseFloat(displayValue);
        } else {
          result = typeof displayValue === 'number' ? displayValue : String(displayValue);
        }
      } else {
        result = await handleFormula({
          boardId,
          column,
          itemId,
          apiClient,
          schemaCache,
          visitedPaths,
          resolveColumnValue,
        });
      }
    }
  }
  // 5. Other column types - fetch display_value or numeric value
  else {
    const displayValue = await fetchDisplayValue(apiClient, boardId, columnId, itemId);
    const isNullish = displayValue === null || displayValue === undefined || displayValue === 'null' || displayValue === '';
    
    if (!isNullish) {
      if (typeof displayValue === 'number') {
        result = displayValue;
      } else {
        // Strict typing: Only convert if it's a pure number string
        if (typeof displayValue === 'string' && /^-?\d+(\.\d+)?$/.test(displayValue)) {
          result = parseFloat(displayValue);
        } else {
          result = String(displayValue);
        }
      }
    } else {
      // Smart Default: numbers returns 0, everything else returns empty string
      if (column.type === 'numbers') {
        result = await fetchNumericValue(apiClient, boardId, columnId, itemId);
      } else {
        result = '';
      }
    }
  }

  // 6. Cache the result
  if (schemaCache.setCachedValue) {
    schemaCache.setCachedValue(boardId, columnId, itemId, result);
  }

  return result;
}

/**
 * Resolves values for multiple items (batch).
 * More efficient than calling resolveColumnValue multiple times.
 * 
 * @param {Object} options
 * @param {string} options.boardId - Board ID
 * @param {string} options.columnId - Column ID
 * @param {number[]} options.itemIds - Array of item IDs
 * @param {Object} options.apiClient - Monday API client
 * @param {Object} options.schemaCache - Schema cache instance
 * @param {Set<string>} [options.visitedPaths] - Internal: paths visited for cycle detection
 * @returns {Promise<Map<number, number|string>>} Map of itemId -> resolved value
 */
export async function resolveColumnValueBatch({
  boardId,
  columnId,
  itemIds,
  apiClient,
  schemaCache,
  visitedPaths = new Set(),
}) {
  const result = new Map();

  if (!itemIds || itemIds.length === 0) {
    return result;
  }

  // 1. Cycle detection (batch level)
  const pathKey = `${boardId}:${columnId}`;
  if (visitedPaths.has(pathKey)) {
    console.warn(`Cycle detected at ${pathKey} (batch), returning zeros`);
    for (const itemId of itemIds) {
      result.set(itemId, 0);
    }
    return result;
  }
  visitedPaths.add(pathKey);

  try {
    // 2. Get column definition
    const column = await schemaCache.getColumn(boardId, columnId);

    if (!column) {
      console.warn(`Column ${columnId} not found in board ${boardId}`);
      for (const itemId of itemIds) {
        result.set(itemId, '');
      }
      return result;
    }

    // 2.5 OPTIMIZATION: Check if we should skip display_value fetch
    let shouldSkipDisplayValue = false;
    
    if (column.type === 'formula') {
      const formula = column.settings?.formula;
      if (formula) {
        const dependencyColumnIds = extractColumnIds(formula);
        const depAnalysis = analyzeFormulaDependencies(dependencyColumnIds);
        shouldSkipDisplayValue = depAnalysis.allComplex;
      }
    } else if (column.type === 'mirror') {
      const mirrorAnalysis = analyzeMirrorTarget(column);
      shouldSkipDisplayValue = mirrorAnalysis.isComplex;
    }

    // 3. Determine items needing recursion
    const itemsNeedingRecursion = [];
    const aggFunc = column.settings?.function || 'sum';

    if (shouldSkipDisplayValue) {
      // All items need recursion - skip display_value fetch
      itemsNeedingRecursion.push(...itemIds);
    } else {
      // Try display_value first (batch)
      const displayValues = await fetchDisplayValueBatch(apiClient, boardId, columnId, itemIds);

      // 4. Check which items need recursion
      for (const itemId of itemIds) {
        const displayValue = displayValues.get(itemId);

        // Note: Monday.com API sometimes returns "null" as a string instead of actual null
        // Empty string "" also means we need to recurse (e.g., mirror with linked items that have values)
        const isNullish = displayValue === null || displayValue === undefined || displayValue === 'null' || displayValue === '';
        if (!isNullish) {
          // Mirror with comma-separated values (numeric aggregation)
          if (column.type === 'mirror' && typeof displayValue === 'string' && /^-?\d+(\.\d+)?(,\s*-?\d+(\.\d+)?)*$/.test(displayValue)) {
            result.set(itemId, processMirrorDisplayValue(displayValue, aggFunc));
          }
          // Number
          else if (typeof displayValue === 'number') {
            result.set(itemId, displayValue);
          }
          // Strict typing: Only convert if it's a pure numeric string
          else if (typeof displayValue === 'string' && /^-?\d+(\.\d+)?$/.test(displayValue)) {
            result.set(itemId, parseFloat(displayValue));
          }
          // Otherwise keep as string
          else {
            result.set(itemId, String(displayValue));
          }
        } else {
          // Needs recursion or default
          if (column.type === 'formula' || column.type === 'mirror') {
            itemsNeedingRecursion.push(itemId);
          } else {
            // Smart Default for simple columns
            result.set(itemId, column.type === 'numbers' ? 0 : '');
          }
        }
      }
    }

    // 5. If no items need recursion, we're done
    if (itemsNeedingRecursion.length === 0) {
      return result;
    }

    // 6. Handle items that need recursion
    let recursiveResults;

    if (column.type === 'formula') {
      recursiveResults = await handleFormulaBatch({
        boardId,
        column,
        itemIds: itemsNeedingRecursion,
        apiClient,
        schemaCache,
        visitedPaths,
        resolveColumnValueBatch, // Pass self for recursion
      });
    } else if (column.type === 'mirror') {
      recursiveResults = await handleMirrorBatch({
        boardId,
        column,
        itemIds: itemsNeedingRecursion,
        apiClient,
        schemaCache,
        visitedPaths,
        resolveColumnValueBatch, // Pass self for recursion
      });
    } else {
      // Other column types - fetch one by one (fallback)
      recursiveResults = new Map();
      for (const itemId of itemsNeedingRecursion) {
        const value = await fetchNumericValue(apiClient, boardId, columnId, itemId);
        recursiveResults.set(itemId, value);
      }
    }

    // Merge recursive results
    for (const [itemId, value] of recursiveResults) {
      result.set(itemId, value);
    }

    return result;

  } finally {
    visitedPaths.delete(pathKey);
  }
}

export default {
  resolveColumnValue,
  resolveColumnValueBatch,
};
