/**
 * Strategy Selector
 * Analyzes column metadata and decides optimal fetching strategy.
 * 
 * This module helps avoid unnecessary API calls by detecting when
 * display_value will be empty (e.g., mirrors pointing to formulas).
 */

// Column types that always return empty display_value when mirrored
const COMPLEX_COLUMN_TYPES = new Set(['formula', 'mirror', 'lookup']);

// Column ID prefixes that indicate complex types
const COMPLEX_COLUMN_PREFIXES = ['formula_', 'lookup_', 'mirror_'];

/**
 * Strategy types for fetching column values.
 */
export const Strategy = {
  // Skip display_value, go directly to deep fetch
  DIRECT_DEEP_FETCH: 'DIRECT_DEEP_FETCH',
  
  // Use coordinator to batch multiple column requests
  COORDINATOR_BATCH: 'COORDINATOR_BATCH',
  
  // Resolve dependencies in parallel without coordinator
  PARALLEL_RESOLVE: 'PARALLEL_RESOLVE',
  
  // Simple single-value fetch
  SIMPLE_FETCH: 'SIMPLE_FETCH',
};

/**
 * Checks if a column ID indicates a complex type (formula/mirror).
 * Uses column ID prefix heuristic since we may not have the schema yet.
 * 
 * @param {string} columnId - Column ID to check
 * @returns {boolean} True if column appears to be complex
 */
export function isComplexColumnId(columnId) {
  if (!columnId) return false;
  return COMPLEX_COLUMN_PREFIXES.some(prefix => columnId.startsWith(prefix));
}

/**
 * Checks if a column type is complex (will return empty display_value when mirrored).
 * 
 * @param {string} columnType - Column type (e.g., 'formula', 'mirror', 'numbers')
 * @returns {boolean} True if column type is complex
 */
export function isComplexColumnType(columnType) {
  return COMPLEX_COLUMN_TYPES.has(columnType);
}

/**
 * Analyzes a mirror column's target to determine if it's complex.
 * 
 * @param {Object} mirrorColumn - Mirror column definition with settings
 * @returns {Object} Analysis result { isComplex, targetBoardId, targetColumnId }
 */
export function analyzeMirrorTarget(mirrorColumn) {
  const settings = mirrorColumn?.settings || {};
  const displayedLinkedColumns = settings.displayed_linked_columns;
  
  if (!displayedLinkedColumns || displayedLinkedColumns.length === 0) {
    return { isComplex: false, targetBoardId: null, targetColumnId: null };
  }
  
  const firstTarget = displayedLinkedColumns[0];
  const targetBoardId = firstTarget.board_id ? String(firstTarget.board_id) : null;
  const targetColumnId = firstTarget.column_ids?.[0] || null;
  
  // Check if target column ID indicates a complex type
  const isComplex = isComplexColumnId(targetColumnId);
  
  return {
    isComplex,
    targetBoardId,
    targetColumnId,
  };
}

/**
 * Analyzes a mirror column's target with full schema lookup.
 * More accurate than analyzeMirrorTarget but requires async schema fetch.
 * 
 * @param {Object} mirrorColumn - Mirror column definition with settings
 * @param {Object} schemaCache - Schema cache instance
 * @returns {Promise<Object>} Analysis result { isComplex, targetBoardId, targetColumnId, targetColumnType }
 */
export async function analyzeMirrorTargetAsync(mirrorColumn, schemaCache) {
  const basicAnalysis = analyzeMirrorTarget(mirrorColumn);
  
  if (!basicAnalysis.targetBoardId || !basicAnalysis.targetColumnId) {
    return { ...basicAnalysis, targetColumnType: null };
  }
  
  // If we can determine from column ID, use that (faster)
  if (basicAnalysis.isComplex) {
    return { ...basicAnalysis, targetColumnType: 'unknown_complex' };
  }
  
  // Otherwise, fetch the target column schema to check its type
  try {
    const targetColumn = await schemaCache.getColumn(
      basicAnalysis.targetBoardId,
      basicAnalysis.targetColumnId
    );
    
    if (targetColumn) {
      const isComplex = isComplexColumnType(targetColumn.type);
      return {
        ...basicAnalysis,
        isComplex,
        targetColumnType: targetColumn.type,
      };
    }
  } catch (error) {
    // If we can't fetch, fall back to column ID heuristic
    console.warn('Failed to fetch target column schema:', error);
  }
  
  return { ...basicAnalysis, targetColumnType: null };
}

/**
 * Analyzes formula dependencies to determine if they're all complex.
 * 
 * @param {string[]} dependencyColumnIds - Array of dependency column IDs
 * @returns {Object} Analysis result { allComplex, complexCount, simpleCount }
 */
export function analyzeFormulaDependencies(dependencyColumnIds) {
  if (!dependencyColumnIds || dependencyColumnIds.length === 0) {
    return { allComplex: false, complexCount: 0, simpleCount: 0 };
  }
  
  let complexCount = 0;
  let simpleCount = 0;
  
  for (const columnId of dependencyColumnIds) {
    if (isComplexColumnId(columnId)) {
      complexCount++;
    } else {
      simpleCount++;
    }
  }
  
  return {
    allComplex: simpleCount === 0 && complexCount > 0,
    complexCount,
    simpleCount,
  };
}

/**
 * Analyzes formula dependencies with full schema lookup.
 * 
 * @param {string} boardId - Board ID
 * @param {string[]} dependencyColumnIds - Array of dependency column IDs
 * @param {Object} schemaCache - Schema cache instance
 * @returns {Promise<Object>} Analysis result with column types
 */
export async function analyzeFormulaDependenciesAsync(boardId, dependencyColumnIds, schemaCache) {
  if (!dependencyColumnIds || dependencyColumnIds.length === 0) {
    return { 
      allComplex: false, 
      complexCount: 0, 
      simpleCount: 0,
      columns: new Map(),
    };
  }
  
  const columns = new Map();
  let complexCount = 0;
  let simpleCount = 0;
  
  // Fetch all columns in parallel
  const columnPromises = dependencyColumnIds.map(async (columnId) => {
    try {
      const column = await schemaCache.getColumn(boardId, columnId);
      return { columnId, column };
    } catch {
      return { columnId, column: null };
    }
  });
  
  const results = await Promise.all(columnPromises);
  
  for (const { columnId, column } of results) {
    const isComplex = column 
      ? isComplexColumnType(column.type)
      : isComplexColumnId(columnId);
    
    columns.set(columnId, {
      column,
      isComplex,
      type: column?.type || 'unknown',
    });
    
    if (isComplex) {
      complexCount++;
    } else {
      simpleCount++;
    }
  }
  
  return {
    allComplex: simpleCount === 0 && complexCount > 0,
    complexCount,
    simpleCount,
    columns,
  };
}

/**
 * Selects the optimal strategy for resolving a column value.
 * 
 * @param {Object} column - Column definition
 * @param {Object} [options] - Additional options
 * @param {number} [options.depth] - Current recursion depth
 * @param {string[]} [options.dependencyColumnIds] - Formula dependency column IDs
 * @returns {string} Strategy from Strategy enum
 */
export function selectStrategy(column, options = {}) {
  const { depth = 0, dependencyColumnIds = [] } = options;
  
  if (!column) {
    return Strategy.SIMPLE_FETCH;
  }
  
  // For mirrors, check if target is complex
  if (column.type === 'mirror') {
    const targetAnalysis = analyzeMirrorTarget(column);
    
    if (targetAnalysis.isComplex) {
      // Target is formula/mirror - display_value will be empty
      return Strategy.DIRECT_DEEP_FETCH;
    }
    
    // Target is simple type - display_value might be useful
    return Strategy.SIMPLE_FETCH;
  }
  
  // For formulas, check if dependencies are all complex
  if (column.type === 'formula') {
    if (dependencyColumnIds.length === 0) {
      return Strategy.SIMPLE_FETCH;
    }
    
    const depAnalysis = analyzeFormulaDependencies(dependencyColumnIds);
    
    if (depAnalysis.allComplex) {
      // All dependencies are mirrors/formulas - skip coordinator
      return Strategy.PARALLEL_RESOLVE;
    }
    
    if (depAnalysis.simpleCount > 0 && dependencyColumnIds.length > 1) {
      // Mix of simple and complex - use coordinator for simple ones
      return Strategy.COORDINATOR_BATCH;
    }
    
    return Strategy.PARALLEL_RESOLVE;
  }
  
  // Other column types - simple fetch
  return Strategy.SIMPLE_FETCH;
}

/**
 * Selects strategy with async schema analysis for more accuracy.
 * 
 * @param {Object} column - Column definition
 * @param {Object} schemaCache - Schema cache instance
 * @param {Object} [options] - Additional options
 * @returns {Promise<string>} Strategy from Strategy enum
 */
export async function selectStrategyAsync(column, schemaCache, options = {}) {
  const { boardId, dependencyColumnIds = [] } = options;
  
  if (!column) {
    return Strategy.SIMPLE_FETCH;
  }
  
  // For mirrors, check target with schema lookup
  if (column.type === 'mirror') {
    const targetAnalysis = await analyzeMirrorTargetAsync(column, schemaCache);
    
    if (targetAnalysis.isComplex) {
      return Strategy.DIRECT_DEEP_FETCH;
    }
    
    return Strategy.SIMPLE_FETCH;
  }
  
  // For formulas, analyze dependencies with schema lookup
  if (column.type === 'formula' && boardId && dependencyColumnIds.length > 0) {
    const depAnalysis = await analyzeFormulaDependenciesAsync(
      boardId,
      dependencyColumnIds,
      schemaCache
    );
    
    if (depAnalysis.allComplex) {
      return Strategy.PARALLEL_RESOLVE;
    }
    
    if (depAnalysis.simpleCount > 0 && dependencyColumnIds.length > 1) {
      return Strategy.COORDINATOR_BATCH;
    }
    
    return Strategy.PARALLEL_RESOLVE;
  }
  
  return Strategy.SIMPLE_FETCH;
}

export default {
  Strategy,
  isComplexColumnId,
  isComplexColumnType,
  analyzeMirrorTarget,
  analyzeMirrorTargetAsync,
  analyzeFormulaDependencies,
  analyzeFormulaDependenciesAsync,
  selectStrategy,
  selectStrategyAsync,
};
