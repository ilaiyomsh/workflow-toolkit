/**
 * Formula Functions Registry
 * Combines all function modules into a single registry.
 */

import textFunctions from './text.js';
import numericFunctions from './numeric.js';
import logicalFunctions from './logical.js';
import dateFunctions from './date.js';

/**
 * All available formula functions
 */
export const FUNCTIONS = {
  // Text functions
  ...textFunctions,

  // Numeric functions
  ...numericFunctions,

  // Logical functions
  ...logicalFunctions,

  // Date functions
  ...dateFunctions,
};

/**
 * Get a function by name (case-insensitive)
 */
export function getFunction(name) {
  const upperName = String(name).toUpperCase();
  return FUNCTIONS[upperName] || null;
}

/**
 * Check if a function exists
 */
export function hasFunction(name) {
  const upperName = String(name).toUpperCase();
  return upperName in FUNCTIONS;
}

/**
 * Get list of all available function names
 */
export function getFunctionNames() {
  return Object.keys(FUNCTIONS);
}

export default {
  FUNCTIONS,
  getFunction,
  hasFunction,
  getFunctionNames,
};
