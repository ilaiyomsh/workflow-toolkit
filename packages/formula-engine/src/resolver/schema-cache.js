/**
 * Schema Cache
 * Caches column definitions to minimize API calls during recursive resolution.
 */

import { fetchBoardColumns, fetchMultiColumnsDeep } from './graphql-queries.js';
import { extractColumnValue } from '../column-value-extractor.js';
import { 
  analyzeMirrorTarget, 
  analyzeFormulaDependencies,
  isComplexColumnId,
  isComplexColumnType,
  selectStrategy,
  Strategy,
} from './strategy-selector.js';

// Default cache TTL: 5 minutes
const DEFAULT_TTL = 5 * 60 * 1000;

/**
 * Creates a schema cache instance.
 * @param {Object} apiClient - Monday API client with query method
 * @param {Object} [options] - Cache options
 * @param {number} [options.ttl] - Cache TTL in milliseconds
 * @returns {Object} Schema cache instance
 */
export function createSchemaCache(apiClient, options = {}) {
  const ttl = options.ttl ?? DEFAULT_TTL;
  const cache = new Map();

  /**
   * Gets a column definition from cache or fetches from API.
   * @param {string} boardId - Board ID
   * @param {string} columnId - Column ID
   * @returns {Promise<Object|null>} Column definition or null if not found
   */
  async function getColumn(boardId, columnId) {
    const now = Date.now();
    const cacheKey = boardId;

    // Check if board is cached and not expired
    let boardCache = cache.get(cacheKey);

    if (!boardCache || now - boardCache.timestamp > ttl) {
      // Fetch fresh column data
      try {
        const columns = await fetchBoardColumns(apiClient, boardId);

        // Build columns map
        const columnsMap = new Map();
        for (const col of columns) {
          columnsMap.set(col.id, col);
        }

        boardCache = {
          columns: columnsMap,
          timestamp: now,
        };
        cache.set(cacheKey, boardCache);
      } catch (error) {
        console.error(`Failed to fetch columns for board ${boardId}:`, error);
        return null;
      }
    }

    return boardCache.columns.get(columnId) || null;
  }

  /**
   * Gets all columns for a board.
   * @param {string} boardId - Board ID
   * @returns {Promise<Map<string, Object>>} Map of columnId -> column definition
   */
  async function getColumns(boardId) {
    const now = Date.now();
    const cacheKey = boardId;

    let boardCache = cache.get(cacheKey);

    if (!boardCache || now - boardCache.timestamp > ttl) {
      try {
        const columns = await fetchBoardColumns(apiClient, boardId);

        const columnsMap = new Map();
        for (const col of columns) {
          columnsMap.set(col.id, col);
        }

        boardCache = {
          columns: columnsMap,
          timestamp: now,
        };
        cache.set(cacheKey, boardCache);
      } catch (error) {
        console.error(`Failed to fetch columns for board ${boardId}:`, error);
        return new Map();
      }
    }

    return boardCache.columns;
  }

  /**
   * Invalidates cache for a board or all boards.
   * @param {string} [boardId] - Optional board ID to invalidate
   */
  function invalidate(boardId) {
    if (boardId) {
      cache.delete(boardId);
    } else {
      cache.clear();
    }
  }

  /**
   * Preloads columns for a board into cache.
   * @param {string} boardId - Board ID
   */
  async function preload(boardId) {
    await getColumns(boardId);
  }

  return {
    getColumn,
    getColumns,
    invalidate,
    preload,
  };
}

/**
 * Simple in-memory cache for single-request use (no TTL).
 * Useful for Node.js request handlers where cache lives only during request.
 * 
 * ENHANCED: Also includes value cache and pending requests tracking
 * to prevent repeated resolution of same item/column (Optimization 2).
 */
export function createSimpleCache(apiClient) {
  const schemaCache = new Map(); // boardId -> Map<columnId, column>
  const valueCache = new Map();  // `${boardId}:${columnId}:${itemId}` -> resolved value
  const pendingSchemaRequests = new Map(); // boardId -> Promise
  const pendingValueRequests = new Map();  // `${boardId}:${columnId}:${itemId}` -> Promise

  // ============================================================================
  // REQUEST COORDINATOR - Batches multiple column requests for same item
  // ============================================================================
  const BATCH_WINDOW_MS = 5; // Short window to collect requests
  const coordinatorPending = new Map(); // itemId -> { columns: Set, resolvers: Map, timer }
  const coordinatorCache = new Map();   // `${itemId}:${columnId}` -> value

  /**
   * Requests display value for a column using batched coordinator.
   * Waits a short time to collect multiple column requests for same item.
   * 
   * @param {number} itemId - Item ID
   * @param {string} columnId - Column ID
   * @returns {Promise<any>} Display value
   */
  function coordinatorRequest(itemId, columnId) {
    const cacheKey = `${itemId}:${columnId}`;
    
    // Check coordinator cache first
    if (coordinatorCache.has(cacheKey)) {
      return Promise.resolve(coordinatorCache.get(cacheKey));
    }
    
    return new Promise((resolve, reject) => {
      // Get or create pending entry for this item
      if (!coordinatorPending.has(itemId)) {
        coordinatorPending.set(itemId, {
          columns: new Set(),
          resolvers: new Map(),
          timer: null,
        });
      }
      
      const pending = coordinatorPending.get(itemId);
      pending.columns.add(columnId);
      
      // Add resolver for this column
      if (!pending.resolvers.has(columnId)) {
        pending.resolvers.set(columnId, []);
      }
      pending.resolvers.get(columnId).push({ resolve, reject });
      
      // Schedule batch execution (if not already scheduled)
      if (!pending.timer) {
        pending.timer = setTimeout(() => executeCoordinatorBatch(itemId), BATCH_WINDOW_MS);
      }
    });
  }

  /**
   * Executes a batched request for an item.
   */
  async function executeCoordinatorBatch(itemId) {
    const pending = coordinatorPending.get(itemId);
    if (!pending) return;
    
    coordinatorPending.delete(itemId);
    
    const columnIds = Array.from(pending.columns);
    const resolvers = pending.resolvers;
    
    try {
      // Fetch all columns in ONE request
      const columnsData = await fetchMultiColumnsDeep(apiClient, itemId, columnIds);
      
      // Resolve all pending requests
      for (const [columnId, resolverList] of resolvers) {
        const colValue = columnsData.get(columnId);
        const value = extractColumnValue(colValue, colValue?.type);
        const cacheKey = `${itemId}:${columnId}`;
        coordinatorCache.set(cacheKey, value);
        
        for (const { resolve } of resolverList) {
          resolve(value);
        }
      }
    } catch (error) {
      // Reject all pending requests
      for (const [, resolverList] of resolvers) {
        for (const { reject } of resolverList) {
          reject(error);
        }
      }
    }
  }

  /**
   * Flushes all pending coordinator requests immediately.
   */
  async function flushCoordinator() {
    const itemIds = Array.from(coordinatorPending.keys());
    
    // Clear all timers first
    for (const itemId of itemIds) {
      const pending = coordinatorPending.get(itemId);
      if (pending?.timer) {
        clearTimeout(pending.timer);
        pending.timer = null;
      }
    }
    
    // Execute all batches in parallel
    await Promise.all(itemIds.map(executeCoordinatorBatch));
  }

  // ============================================================================
  // SCHEMA CACHE
  // ============================================================================

  async function getColumn(boardId, columnId) {
    const cacheKey = boardId;

    // Return from cache if available
    if (schemaCache.has(cacheKey)) {
      return schemaCache.get(cacheKey)?.get(columnId) || null;
    }

    // Check if request is already in flight (Optimization 2: Deduplication)
    if (pendingSchemaRequests.has(cacheKey)) {
      await pendingSchemaRequests.get(cacheKey);
      return schemaCache.get(cacheKey)?.get(columnId) || null;
    }

    // Create new request and track it
    const fetchPromise = (async () => {
      try {
        const columns = await fetchBoardColumns(apiClient, boardId);
        const columnsMap = new Map();
        for (const col of columns) {
          columnsMap.set(col.id, col);
        }
        schemaCache.set(cacheKey, columnsMap);
      } catch (error) {
        console.error(`Failed to fetch columns for board ${boardId}:`, error);
      } finally {
        pendingSchemaRequests.delete(cacheKey);
      }
    })();

    pendingSchemaRequests.set(cacheKey, fetchPromise);
    await fetchPromise;

    return schemaCache.get(cacheKey)?.get(columnId) || null;
  }

  /**
   * Gets a cached resolved value.
   * @param {string} boardId - Board ID
   * @param {string} columnId - Column ID
   * @param {number} itemId - Item ID
   * @returns {any|undefined} Cached value or undefined if not cached
   */
  function getCachedValue(boardId, columnId, itemId) {
    const key = `${boardId}:${columnId}:${itemId}`;
    return valueCache.get(key);
  }

  /**
   * Caches a resolved value.
   * @param {string} boardId - Board ID
   * @param {string} columnId - Column ID
   * @param {number} itemId - Item ID
   * @param {any} value - Resolved value
   */
  function setCachedValue(boardId, columnId, itemId, value) {
    const key = `${boardId}:${columnId}:${itemId}`;
    valueCache.set(key, value);
  }

  /**
   * Checks if a value is cached.
   * @param {string} boardId - Board ID
   * @param {string} columnId - Column ID
   * @param {number} itemId - Item ID
   * @returns {boolean} True if value is cached
   */
  function hasValue(boardId, columnId, itemId) {
    const key = `${boardId}:${columnId}:${itemId}`;
    return valueCache.has(key);
  }

  /**
   * Checks if a value resolution is pending (in-flight).
   * (Optimization 2: Request Deduplication)
   * @param {string} boardId - Board ID
   * @param {string} columnId - Column ID
   * @param {number} itemId - Item ID
   * @returns {boolean} True if resolution is pending
   */
  function hasPendingValue(boardId, columnId, itemId) {
    const key = `${boardId}:${columnId}:${itemId}`;
    return pendingValueRequests.has(key);
  }

  /**
   * Gets a pending value resolution promise.
   * (Optimization 2: Request Deduplication)
   * @param {string} boardId - Board ID
   * @param {string} columnId - Column ID
   * @param {number} itemId - Item ID
   * @returns {Promise|undefined} Pending promise or undefined
   */
  function getPendingValue(boardId, columnId, itemId) {
    const key = `${boardId}:${columnId}:${itemId}`;
    return pendingValueRequests.get(key);
  }

  /**
   * Sets a pending value resolution promise.
   * (Optimization 2: Request Deduplication)
   * @param {string} boardId - Board ID
   * @param {string} columnId - Column ID
   * @param {number} itemId - Item ID
   * @param {Promise} promise - Resolution promise
   */
  function setPendingValue(boardId, columnId, itemId, promise) {
    const key = `${boardId}:${columnId}:${itemId}`;
    pendingValueRequests.set(key, promise);
  }

  /**
   * Removes a pending value resolution.
   * (Optimization 2: Request Deduplication)
   * @param {string} boardId - Board ID
   * @param {string} columnId - Column ID
   * @param {number} itemId - Item ID
   */
  function removePendingValue(boardId, columnId, itemId) {
    const key = `${boardId}:${columnId}:${itemId}`;
    pendingValueRequests.delete(key);
  }

  function invalidate(boardId) {
    if (boardId) {
      schemaCache.delete(boardId);
      pendingSchemaRequests.delete(boardId);
      // Also clear values and pending requests for this board
      for (const key of valueCache.keys()) {
        if (key.startsWith(`${boardId}:`)) {
          valueCache.delete(key);
        }
      }
      for (const key of pendingValueRequests.keys()) {
        if (key.startsWith(`${boardId}:`)) {
          pendingValueRequests.delete(key);
        }
      }
    } else {
      schemaCache.clear();
      valueCache.clear();
      pendingSchemaRequests.clear();
      pendingValueRequests.clear();
      // Clear coordinator state
      for (const pending of coordinatorPending.values()) {
        if (pending.timer) clearTimeout(pending.timer);
      }
      coordinatorPending.clear();
      coordinatorCache.clear();
    }
  }

  /**
   * Gets cache statistics for debugging.
   */
  function getStats() {
    return {
      schemaEntries: schemaCache.size,
      valueEntries: valueCache.size,
      pendingSchemaRequests: pendingSchemaRequests.size,
      pendingValueRequests: pendingValueRequests.size,
      coordinatorPending: coordinatorPending.size,
      coordinatorCache: coordinatorCache.size,
    };
  }

  /**
   * Preloads schemas for multiple boards in parallel.
   * (Optimization 6: Schema Pre-fetch)
   * 
   * Call this at the start of resolution when you know which boards
   * will be involved (e.g., from mirror settings).
   * 
   * @param {string[]} boardIds - Array of board IDs to preload
   * @returns {Promise<void>}
   */
  async function preloadBoards(boardIds) {
    if (!boardIds || boardIds.length === 0) return;
    
    // Filter out already cached boards
    const toLoad = boardIds.filter(boardId => !schemaCache.has(boardId));
    
    if (toLoad.length === 0) return;
    
    // Load all boards in parallel
    await Promise.all(
      toLoad.map(boardId => getColumn(boardId, '_preload_'))
    );
  }

  /**
   * Extracts board IDs from mirror column settings.
   * Useful for preloading boards before resolution.
   * 
   * @param {Object} mirrorSettings - Mirror column settings
   * @returns {string[]} Array of board IDs
   */
  function extractBoardIdsFromMirrorSettings(mirrorSettings) {
    const boardIds = new Set();
    
    const displayedLinkedColumns = mirrorSettings?.displayed_linked_columns;
    if (displayedLinkedColumns && Array.isArray(displayedLinkedColumns)) {
      for (const entry of displayedLinkedColumns) {
        if (entry.board_id) {
          boardIds.add(String(entry.board_id));
        }
      }
    }
    
    return Array.from(boardIds);
  }

  // ============================================================================
  // STRATEGY HELPERS - Analyze columns for optimal fetching strategy
  // ============================================================================

  /**
   * Analyzes a mirror column to determine if its target is complex.
   * Complex targets (formula, mirror) will always return empty display_value.
   * 
   * @param {Object} mirrorColumn - Mirror column definition
   * @returns {Object} { isComplex, targetBoardId, targetColumnId }
   */
  function analyzeTargetColumn(mirrorColumn) {
    return analyzeMirrorTarget(mirrorColumn);
  }

  /**
   * Analyzes a mirror column's target with full schema lookup.
   * Falls back to column ID heuristic if schema unavailable.
   * 
   * @param {Object} mirrorColumn - Mirror column definition
   * @returns {Promise<Object>} { isComplex, targetBoardId, targetColumnId, targetColumnType }
   */
  async function analyzeTargetColumnAsync(mirrorColumn) {
    const basicAnalysis = analyzeMirrorTarget(mirrorColumn);
    
    if (!basicAnalysis.targetBoardId || !basicAnalysis.targetColumnId) {
      return { ...basicAnalysis, targetColumnType: null };
    }
    
    // If column ID indicates complex type, trust that
    if (basicAnalysis.isComplex) {
      return { ...basicAnalysis, targetColumnType: 'complex_from_id' };
    }
    
    // Try to fetch target column for accurate type check
    try {
      const targetColumn = await getColumn(
        basicAnalysis.targetBoardId,
        basicAnalysis.targetColumnId
      );
      
      if (targetColumn) {
        return {
          ...basicAnalysis,
          isComplex: isComplexColumnType(targetColumn.type),
          targetColumnType: targetColumn.type,
        };
      }
    } catch (error) {
      // Fall back to ID-based heuristic
    }
    
    return { ...basicAnalysis, targetColumnType: null };
  }

  /**
   * Gets the optimal fetching strategy for a column.
   * 
   * @param {Object} column - Column definition
   * @param {Object} [options] - Options { depth, dependencyColumnIds }
   * @returns {string} Strategy name from Strategy enum
   */
  function getStrategy(column, options = {}) {
    return selectStrategy(column, options);
  }

  /**
   * Checks if a column should skip display_value fetching.
   * Returns true for mirrors pointing to formula/mirror columns.
   * 
   * @param {Object} column - Column definition
   * @returns {boolean} True if should skip display_value
   */
  function shouldSkipDisplayValue(column) {
    if (column?.type !== 'mirror') {
      return false;
    }
    
    const analysis = analyzeMirrorTarget(column);
    return analysis.isComplex;
  }

  return {
    getColumn,
    getCachedValue,
    setCachedValue,
    hasValue,
    hasPendingValue,
    getPendingValue,
    setPendingValue,
    removePendingValue,
    invalidate,
    getStats,
    preloadBoards,
    extractBoardIdsFromMirrorSettings,
    // Request Coordinator methods
    coordinatorRequest,
    flushCoordinator,
    // Strategy helpers
    analyzeTargetColumn,
    analyzeTargetColumnAsync,
    getStrategy,
    shouldSkipDisplayValue,
    Strategy, // Re-export Strategy enum for convenience
  };
}

/**
 * Creates a cache that includes both schema and value caching.
 * This is the recommended cache for optimal performance.
 * Alias for createSimpleCache with enhanced documentation.
 */
export const createOptimizedCache = createSimpleCache;

export default {
  createSchemaCache,
  createSimpleCache,
  createOptimizedCache,
};
