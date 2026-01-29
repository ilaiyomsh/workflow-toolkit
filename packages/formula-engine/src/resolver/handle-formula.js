/**
 * Handle Formula Column
 * Resolves formula columns by parsing the formula and resolving dependencies recursively.
 * 
 * OPTIMIZATION: Uses smart strategy selection to avoid unnecessary API calls.
 * - Skips coordinator for complex dependencies (mirrors pointing to formulas)
 * - Uses coordinator only when simple columns might have valid display_values
 */

import { extractColumnIds, evaluateFormula } from '../index.js';
import { analyzeFormulaDependencies, Strategy, isComplexColumnId } from './strategy-selector.js';

/**
 * Checks if a display value is nullish (requires deeper resolution).
 */
function isNullishDisplayValue(value) {
  return value === null || value === undefined || value === 'null' || value === '';
}

/**
 * Parses a display value to extract numeric value.
 */
function parseDisplayValue(displayValue) {
  if (typeof displayValue === 'number') return displayValue;
  const num = parseFloat(displayValue);
  return isNaN(num) ? displayValue : num;
}

/**
 * Checks if a value is numeric or a numeric list (comma separated).
 */
function isNumericValue(value) {
  if (typeof value === 'number') return true;
  if (typeof value === 'string') {
    return /^-?\d+(\.\d+)?(,\s*-?\d+(\.\d+)?)*$/.test(value.trim());
  }
  return false;
}

/**
 * Handles a formula column when display_value is null.
 * Parses the formula, resolves all dependencies recursively, and evaluates.
 * 
 * OPTIMIZATION: Uses coordinator to batch-fetch display values for all
 * dependencies in a single API call, then only recurses for nullish values.
 *
 * @param {Object} options
 * @param {string} options.boardId - Board ID
 * @param {Object} options.column - Column definition with settings
 * @param {number} options.itemId - Item ID
 * @param {Object} options.apiClient - Monday API client
 * @param {Object} options.schemaCache - Schema cache instance
 * @param {Set<string>} options.visitedPaths - Set of visited paths for cycle detection
 * @param {Function} options.resolveColumnValue - Reference to resolveColumnValue for recursion
 * @returns {Promise<number>} Resolved numeric value
 */
export async function handleFormula({
  boardId,
  column,
  itemId,
  apiClient,
  schemaCache,
  visitedPaths,
  resolveColumnValue,
}) {
  const formula = column.settings?.formula;

  if (!formula) {
    console.warn(`Formula column ${column.id} has no formula definition`);
    return 0;
  }

  // Extract column dependencies from formula
  const dependencyColumnIds = extractColumnIds(formula);

  if (dependencyColumnIds.length === 0) {
    // Formula has no column references - evaluate directly
    // This handles formulas like "5 + 3" or "TODAY()"
    try {
      const result = evaluateFormula(formula, new Map());
      const numResult = parseFloat(result);
      return isNaN(numResult) ? result : numResult;
    } catch (error) {
      console.error(`Error evaluating formula without dependencies: ${formula}`, error);
      return 0;
    }
  }

  const columnValues = new Map();

  // SMART STRATEGY: Analyze dependencies to decide approach
  const depAnalysis = analyzeFormulaDependencies(dependencyColumnIds);
  
  // If ALL dependencies are complex (mirrors/formulas), skip coordinator entirely
  // because their display_value will always be empty
  const useCoordinator = schemaCache.coordinatorRequest 
    && dependencyColumnIds.length > 1 
    && depAnalysis.simpleCount > 0; // Only use coordinator if there are simple columns

  if (useCoordinator) {
    // Use coordinator only for potentially simple columns
    const displayValuePromises = dependencyColumnIds.map(depColumnId =>
      schemaCache.coordinatorRequest(itemId, depColumnId)
        .then(value => ({ depColumnId, value }))
        .catch(() => ({ depColumnId, value: null }))
    );
    
    const displayValues = await Promise.all(displayValuePromises);
    const needsRecursion = [];
    
    for (const { depColumnId, value } of displayValues) {
      const isComplex = isComplexColumnId(depColumnId);
      const isNullish = isNullishDisplayValue(value);

      // For complex columns (mirror/lookup/formula), only use coordinator value
      // if it's a valid number. Otherwise, recurse to get the real value.
      if (!isNullish && !isComplex) {
        // Simple column with valid value - use directly
        columnValues.set(depColumnId, parseDisplayValue(value));
      } else if (!isNullish && isComplex && isNumericValue(value)) {
        // Complex column with numeric value - use it
        columnValues.set(depColumnId, parseDisplayValue(value));
      } else {
        // Needs recursion
        needsRecursion.push(depColumnId);
      }
    }
    
    // Resolve remaining columns through full recursion (in parallel)
    if (needsRecursion.length > 0) {
      const recursiveResults = await Promise.all(
        needsRecursion.map(async (depColumnId) => {
          try {
            const value = await resolveColumnValue({
              boardId,
              columnId: depColumnId,
              itemId,
              apiClient,
              schemaCache,
              visitedPaths,
            });
            return { depColumnId, value };
          } catch (error) {
            console.error(`Error resolving dependency ${depColumnId} for formula:`, error);
            return { depColumnId, value: 0 };
          }
        })
      );
      
      for (const { depColumnId, value } of recursiveResults) {
        columnValues.set(depColumnId, value);
      }
    }
  } else {
    // All dependencies are complex OR only 1 dependency - go straight to parallel resolve
    // This skips the coordinator call which would return empty values anyway
    const results = await Promise.all(
      dependencyColumnIds.map(async (depColumnId) => {
        try {
          const value = await resolveColumnValue({
            boardId,
            columnId: depColumnId,
            itemId,
            apiClient,
            schemaCache,
            visitedPaths,
          });
          return { depColumnId, value };
        } catch (error) {
          console.error(`Error resolving dependency ${depColumnId} for formula:`, error);
          return { depColumnId, value: 0 };
        }
      })
    );

    for (const { depColumnId, value } of results) {
      columnValues.set(depColumnId, value);
    }
  }

  // Evaluate formula with resolved values
  try {
    const result = evaluateFormula(formula, columnValues);
    const numResult = parseFloat(result);
    return isNaN(numResult) ? result : numResult;
  } catch (error) {
    console.error(`Error evaluating formula: ${formula}`, error);
    return 0;
  }
}

/**
 * Handles a formula column for multiple items (batch).
 *
 * @param {Object} options
 * @param {string} options.boardId - Board ID
 * @param {Object} options.column - Column definition with settings
 * @param {number[]} options.itemIds - Array of item IDs
 * @param {Object} options.apiClient - Monday API client
 * @param {Object} options.schemaCache - Schema cache instance
 * @param {Set<string>} options.visitedPaths - Set of visited paths for cycle detection
 * @param {Function} options.resolveColumnValueBatch - Reference to batch resolver for recursion
 * @returns {Promise<Map<number, number>>} Map of itemId -> resolved value
 */
export async function handleFormulaBatch({
  boardId,
  column,
  itemIds,
  apiClient,
  schemaCache,
  visitedPaths,
  resolveColumnValueBatch,
}) {
  const result = new Map();
  const formula = column.settings?.formula;

  if (!formula) {
    console.warn(`Formula column ${column.id} has no formula definition`);
    for (const itemId of itemIds) {
      result.set(itemId, 0);
    }
    return result;
  }

  // Extract column dependencies
  const dependencyColumnIds = extractColumnIds(formula);

  if (dependencyColumnIds.length === 0) {
    // No dependencies - same result for all items
    try {
      const value = evaluateFormula(formula, new Map());
      const numValue = parseFloat(value);
      const finalValue = isNaN(numValue) ? value : numValue;
      for (const itemId of itemIds) {
        result.set(itemId, finalValue);
      }
    } catch (error) {
      console.error(`Error evaluating formula without dependencies: ${formula}`, error);
      for (const itemId of itemIds) {
        result.set(itemId, 0);
      }
    }
    return result;
  }

  // Resolve all dependency columns in PARALLEL (Optimization 1)
  const dependencyValues = new Map(); // columnId -> Map<itemId, value>

  const batchResults = await Promise.all(
    dependencyColumnIds.map(async (depColumnId) => {
      try {
        const values = await resolveColumnValueBatch({
          boardId,
          columnId: depColumnId,
          itemIds,
          apiClient,
          schemaCache,
          visitedPaths,
        });
        return { depColumnId, values };
      } catch (error) {
        console.error(`Error resolving dependency ${depColumnId} for formula batch:`, error);
        const emptyMap = new Map();
        for (const itemId of itemIds) {
          emptyMap.set(itemId, 0);
        }
        return { depColumnId, values: emptyMap };
      }
    })
  );

  for (const { depColumnId, values } of batchResults) {
    dependencyValues.set(depColumnId, values);
  }

  // Evaluate formula for each item
  for (const itemId of itemIds) {
    const columnValuesForItem = new Map();

    for (const [depColumnId, depValues] of dependencyValues) {
      columnValuesForItem.set(depColumnId, depValues.get(itemId) ?? 0);
    }

    try {
      const evalResult = evaluateFormula(formula, columnValuesForItem);
      const numResult = parseFloat(evalResult);
      result.set(itemId, isNaN(numResult) ? evalResult : numResult);
    } catch (error) {
      console.error(`Error evaluating formula for item ${itemId}: ${formula}`, error);
      result.set(itemId, 0);
    }
  }

  return result;
}

export default {
  handleFormula,
  handleFormulaBatch,
};
