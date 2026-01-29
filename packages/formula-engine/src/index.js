/**
 * Formula Engine
 * Main entry point for the formula parser, evaluator, and recursive resolver.
 */

// Import for local use
import { TokenType, Token, Tokenizer, tokenize } from './tokenizer.js';
import { NodeType, AST, Parser, parse as parseFormula, extractColumnIds } from './parser.js';
import { Evaluator, evaluate as evalAST, formatResult as format } from './evaluator.js';
import { extractColumnValue, extractMultipleColumnValues, getColumnTypeFields, parseNumericValues, applyAggregationFunction } from './column-value-extractor.js';
import { FUNCTIONS, getFunction, getFunctionNames, hasFunction } from './functions/index.js';

// Re-export tokenizer
export { TokenType, Token, Tokenizer, tokenize };

// Re-export parser
export { NodeType, AST, Parser, extractColumnIds };
export const parse = parseFormula;

// Re-export evaluator
export { Evaluator, formatResult } from './evaluator.js';
export const evaluate = evalAST;

// Re-export column value extractor
export { extractColumnValue, extractMultipleColumnValues, getColumnTypeFields, parseNumericValues, applyAggregationFunction };

// Re-export functions
export { FUNCTIONS, getFunction, getFunctionNames, hasFunction };

// Re-export resolver (recursive column value resolution)
export {
  resolveColumnValue,
  resolveColumnValueBatch,
  resolveValue,
  resolveValues,
  createSchemaCache,
  createSimpleCache,
} from './resolver/index.js';

/**
 * All-in-one function to evaluate a formula string with column values.
 * @param {string} formula - The formula string to evaluate.
 * @param {Map<string, any>} columnValues - Map of columnId -> value.
 * @returns {string} The evaluated result as a display string.
 */
export function evaluateFormula(formula, columnValues) {
  if (!formula || typeof formula !== 'string') {
    return '';
  }

  try {
    // Parse the formula to AST
    const ast = parseFormula(formula);

    // Evaluate the AST
    const result = evalAST(ast, columnValues);

    // Format the result
    const displayValue = format(result);

    return displayValue;
  } catch (err) {
    console.error('Error evaluating formula:', err.message);
    return '';
  }
}

// Import resolver for default export
import {
  resolveColumnValue,
  resolveColumnValueBatch,
  resolveValue,
  resolveValues,
  createSchemaCache,
  createSimpleCache,
} from './resolver/index.js';

export default {
  // Tokenizer
  TokenType,
  Token,
  Tokenizer,
  tokenize,

  // Parser
  NodeType,
  AST,
  Parser,
  parse: parseFormula,
  extractColumnIds,

  // Evaluator
  Evaluator,
  evaluate: evalAST,
  formatResult: format,

  // Column value extractor
  extractColumnValue,
  extractMultipleColumnValues,
  getColumnTypeFields,
  parseNumericValues,
  applyAggregationFunction,

  // Functions
  FUNCTIONS,
  getFunction,
  getFunctionNames,
  hasFunction,

  // All-in-one formula evaluation
  evaluateFormula,

  // Recursive resolver (NEW)
  resolveColumnValue,
  resolveColumnValueBatch,
  resolveValue,
  resolveValues,
  createSchemaCache,
  createSimpleCache,
};
