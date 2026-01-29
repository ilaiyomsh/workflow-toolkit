/**
 * Request Coordinator
 * Coordinates multiple resolution requests to batch them efficiently.
 * (Optimization 5)
 * 
 * Key features:
 * - Collects requests for the same item with different columns
 * - Batches them into a single API call after a short window
 * - Prevents duplicate requests through deduplication
 */

import { fetchMultiColumnsDeep } from './graphql-queries.js';
import { extractColumnValue } from '../column-value-extractor.js';

/**
 * Creates a request coordinator for batching API calls.
 * 
 * @param {Object} apiClient - Monday API client
 * @param {Object} [options] - Coordinator options
 * @param {number} [options.batchWindow=10] - Time in ms to wait for batching
 * @returns {Object} Coordinator instance
 */
export function createRequestCoordinator(apiClient, options = {}) {
  const batchWindow = options.batchWindow ?? 10;
  
  // Pending requests: itemId -> { columns: Set<columnId>, resolvers: Map<columnId, {resolve, reject}[]> }
  const pendingByItem = new Map();
  
  // Batch timers: itemId -> timeoutId
  const batchTimers = new Map();
  
  // Results cache: `${itemId}:${columnId}` -> value
  const resultsCache = new Map();

  /**
   * Requests a column value for an item.
   * Will batch with other requests for the same item.
   * 
   * @param {number} itemId - Item ID
   * @param {string} columnId - Column ID
   * @returns {Promise<any>} Resolved value
   */
  async function request(itemId, columnId) {
    const cacheKey = `${itemId}:${columnId}`;
    
    // Check cache first
    if (resultsCache.has(cacheKey)) {
      return resultsCache.get(cacheKey);
    }
    
    return new Promise((resolve, reject) => {
      // Get or create pending entry for this item
      if (!pendingByItem.has(itemId)) {
        pendingByItem.set(itemId, {
          columns: new Set(),
          resolvers: new Map(),
        });
      }
      
      const pending = pendingByItem.get(itemId);
      pending.columns.add(columnId);
      
      // Add resolver for this column
      if (!pending.resolvers.has(columnId)) {
        pending.resolvers.set(columnId, []);
      }
      pending.resolvers.get(columnId).push({ resolve, reject });
      
      // Schedule batch execution
      if (!batchTimers.has(itemId)) {
        const timerId = setTimeout(() => executeBatch(itemId), batchWindow);
        batchTimers.set(itemId, timerId);
      }
    });
  }

  /**
   * Executes a batched request for an item.
   * @param {number} itemId - Item ID
   */
  async function executeBatch(itemId) {
    // Clear timer
    batchTimers.delete(itemId);
    
    // Get and clear pending
    const pending = pendingByItem.get(itemId);
    if (!pending) return;
    
    pendingByItem.delete(itemId);
    
    const columnIds = Array.from(pending.columns);
    const resolvers = pending.resolvers;
    
    try {
      // Fetch all columns in one request
      const columnsData = await fetchMultiColumnsDeep(apiClient, itemId, columnIds);
      
      // Resolve all pending requests
      for (const [columnId, resolverList] of resolvers) {
        const colValue = columnsData.get(columnId);
        const value = extractColumnValue(colValue, colValue?.type);
        const cacheKey = `${itemId}:${columnId}`;
        resultsCache.set(cacheKey, value);
        
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
   * Flushes all pending requests immediately.
   * Useful before process exits or for testing.
   */
  async function flush() {
    // Cancel all timers
    for (const [itemId, timerId] of batchTimers) {
      clearTimeout(timerId);
      batchTimers.delete(itemId);
    }
    
    // Execute all pending batches in parallel
    const itemIds = Array.from(pendingByItem.keys());
    await Promise.all(itemIds.map(executeBatch));
  }

  /**
   * Clears the coordinator state.
   */
  function clear() {
    // Cancel all timers
    for (const timerId of batchTimers.values()) {
      clearTimeout(timerId);
    }
    batchTimers.clear();
    pendingByItem.clear();
    resultsCache.clear();
  }

  /**
   * Gets coordinator statistics.
   */
  function getStats() {
    return {
      pendingItems: pendingByItem.size,
      cachedResults: resultsCache.size,
      pendingTimers: batchTimers.size,
    };
  }

  return {
    request,
    flush,
    clear,
    getStats,
  };
}

/**
 * Creates a batch resolver that coordinates resolution of multiple columns.
 * 
 * This is a higher-level utility that wraps the coordinator with
 * convenience methods for common patterns.
 * 
 * @param {Object} apiClient - Monday API client
 * @param {Object} schemaCache - Schema cache instance
 * @returns {Object} Batch resolver instance
 */
export function createBatchResolver(apiClient, schemaCache) {
  const coordinator = createRequestCoordinator(apiClient);
  
  // Track items that need resolution by board
  const pendingByBoard = new Map(); // boardId -> Map<itemId, Set<columnId>>
  
  /**
   * Queues a column resolution for later batch execution.
   * 
   * @param {string} boardId - Board ID
   * @param {string} columnId - Column ID
   * @param {number} itemId - Item ID
   * @returns {Promise<any>} Resolution promise
   */
  function queueResolution(boardId, columnId, itemId) {
    return coordinator.request(itemId, columnId);
  }

  /**
   * Flushes all queued resolutions.
   */
  async function flush() {
    await coordinator.flush();
  }

  /**
   * Clears all state.
   */
  function clear() {
    coordinator.clear();
    pendingByBoard.clear();
  }

  return {
    queueResolution,
    flush,
    clear,
    getStats: coordinator.getStats,
  };
}

export default {
  createRequestCoordinator,
  createBatchResolver,
};
