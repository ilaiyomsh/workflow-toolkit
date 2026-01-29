/**
 * Formula Engine Resolver
 * Resolves Formula/Mirror column values recursively, handling nested dependencies.
 * 
 * Main exports:
 * - resolveColumnValue: Resolve a single item's column value
 * - resolveColumnValueBatch: Resolve multiple items' column values (batch)
 * - createSchemaCache: Create a schema cache for column definitions
 */

// Main resolver functions
export { resolveColumnValue, resolveColumnValueBatch } from './resolve-column-value.js';

// Schema cache (with value caching for optimization)
export { createSchemaCache, createSimpleCache, createOptimizedCache } from './schema-cache.js';

// GraphQL queries (for advanced usage)
export {
  fetchBoardColumns,
  fetchDisplayValue,
  fetchDisplayValueBatch,
  fetchLinkedItemIds,
  fetchLinkedItemIdsBatch,
  fetchNumericValue,
  fetchColumnValues,
  // Optimized queries
  fetchMirrorDeep,
  fetchMultiColumnsDeep,
  fetchItemsMirrorDeep,
} from './graphql-queries.js';

// Handlers (for advanced usage)
export { handleFormula, handleFormulaBatch } from './handle-formula.js';
export { handleMirror, handleMirrorBatch, extractRelationColumnId, processMirrorDisplayValue } from './handle-mirror.js';

// Request coordinator (Optimization 5)
export { createRequestCoordinator, createBatchResolver } from './request-coordinator.js';

// Strategy selector (Smart decisions)
export {
  Strategy,
  isComplexColumnId,
  isComplexColumnType,
  analyzeMirrorTarget,
  analyzeFormulaDependencies,
  selectStrategy,
} from './strategy-selector.js';

/**
 * Convenience function: Resolve column value with auto-created cache.
 * Creates a simple cache that lives for the duration of the call.
 * 
 * @param {Object} options
 * @param {string} options.boardId - Board ID
 * @param {string} options.columnId - Column ID
 * @param {number} options.itemId - Item ID
 * @param {Object} options.apiClient - Monday API client { query: fn }
 * @returns {Promise<number|string>} The resolved value
 */
export async function resolveValue({ boardId, columnId, itemId, apiClient }) {
  const { createSimpleCache } = await import('./schema-cache.js');
  const { resolveColumnValue } = await import('./resolve-column-value.js');
  
  const schemaCache = createSimpleCache(apiClient);
  
  return resolveColumnValue({
    boardId,
    columnId,
    itemId,
    apiClient,
    schemaCache,
  });
}

/**
 * Convenience function: Resolve column values for multiple items with auto-created cache.
 * 
 * @param {Object} options
 * @param {string} options.boardId - Board ID
 * @param {string} options.columnId - Column ID
 * @param {number[]} options.itemIds - Array of item IDs
 * @param {Object} options.apiClient - Monday API client { query: fn }
 * @returns {Promise<Map<number, number|string>>} Map of itemId -> value
 */
export async function resolveValues({ boardId, columnId, itemIds, apiClient }) {
  const { createSimpleCache } = await import('./schema-cache.js');
  const { resolveColumnValueBatch } = await import('./resolve-column-value.js');
  
  const schemaCache = createSimpleCache(apiClient);
  
  return resolveColumnValueBatch({
    boardId,
    columnId,
    itemIds,
    apiClient,
    schemaCache,
  });
}

export default {
  resolveColumnValue: async (options) => {
    const { resolveColumnValue } = await import('./resolve-column-value.js');
    return resolveColumnValue(options);
  },
  resolveColumnValueBatch: async (options) => {
    const { resolveColumnValueBatch } = await import('./resolve-column-value.js');
    return resolveColumnValueBatch(options);
  },
  resolveValue,
  resolveValues,
  createSchemaCache: async (apiClient, options) => {
    const { createSchemaCache } = await import('./schema-cache.js');
    return createSchemaCache(apiClient, options);
  },
  createSimpleCache: async (apiClient) => {
    const { createSimpleCache } = await import('./schema-cache.js');
    return createSimpleCache(apiClient);
  },
};
