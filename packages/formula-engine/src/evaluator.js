/**
 * Formula Evaluator
 * Evaluates an AST with column values to produce a result.
 */

import logger from './logger.js';
import { NodeType } from './parser.js';
import { getFunction } from './functions/index.js';

const TAG = 'formula_evaluator';

/**
 * Binary operator implementations
 */
const BINARY_OPS = {
  '+': (a, b) => {
    // If both are numbers, do addition
    const numA = Number(a);
    const numB = Number(b);
    if (!isNaN(numA) && !isNaN(numB)) return numA + numB;
    // Otherwise concatenate as strings
    return String(a ?? '') + String(b ?? '');
  },
  '-': (a, b) => (Number(a) || 0) - (Number(b) || 0),
  '*': (a, b) => (Number(a) || 0) * (Number(b) || 0),
  '/': (a, b) => {
    const divisor = Number(b);
    if (divisor === 0) return 0;
    return (Number(a) || 0) / divisor;
  },
  '%': (a, b) => {
    const divisor = Number(b);
    if (divisor === 0) return 0;
    return (Number(a) || 0) % divisor;
  },
  '&': (a, b) => String(a ?? '') + String(b ?? ''), // String concatenation
  '>': (a, b) => Number(a) > Number(b),
  '<': (a, b) => Number(a) < Number(b),
  '>=': (a, b) => Number(a) >= Number(b),
  '<=': (a, b) => Number(a) <= Number(b),
  '=': (a, b) => {
    // Try numeric comparison first
    const numA = Number(a);
    const numB = Number(b);
    if (!isNaN(numA) && !isNaN(numB)) return numA === numB;
    // Fall back to string comparison
    return String(a ?? '') === String(b ?? '');
  },
  '<>': (a, b) => {
    // Not equal
    const numA = Number(a);
    const numB = Number(b);
    if (!isNaN(numA) && !isNaN(numB)) return numA !== numB;
    return String(a ?? '') !== String(b ?? '');
  },
};

/**
 * Unary operator implementations
 */
const UNARY_OPS = {
  '-': (a) => -(Number(a) || 0),
  '!': (a) => !Boolean(a),
};

/**
 * Evaluator class
 */
export class Evaluator {
  /**
   * @param {Map<string, any>} columnValues - Map of columnId -> value
   */
  constructor(columnValues = new Map()) {
    this.columnValues = columnValues;
  }

  /**
   * Evaluates an AST node.
   * @param {object} node - The AST node to evaluate.
   * @returns {any} The evaluated result.
   */
  evaluate(node) {
    if (!node) {
      return '';
    }

    switch (node.type) {
      case NodeType.LITERAL:
        return node.value;

      case NodeType.COLUMN_REF:
        return this.evaluateColumnRef(node);

      case NodeType.FUNCTION_CALL:
        return this.evaluateFunctionCall(node);

      case NodeType.BINARY_OP:
        return this.evaluateBinaryOp(node);

      case NodeType.UNARY_OP:
        return this.evaluateUnaryOp(node);

      default:
        logger.warn('Unknown node type', TAG, { nodeType: node.type });
        return '';
    }
  }

  /**
   * Evaluates a column reference.
   */
  evaluateColumnRef(node) {
    const { columnId, field } = node;

    let value = this.columnValues.get(columnId);

    if (value === undefined || value === null) {
      logger.debug('Column value not found', TAG, { columnId, field });
      return '';
    }

    // If field is specified and value is an object, extract the field
    if (field && typeof value === 'object' && value !== null) {
      value = value[field] ?? value;
    }

    logger.debug('Evaluated column reference', TAG, { columnId, field, value });
    return value;
  }

  /**
   * Evaluates a function call.
   */
  evaluateFunctionCall(node) {
    const { name, args } = node;

    // Get the function
    const func = getFunction(name);

    if (!func) {
      logger.warn('Unknown function', TAG, { name });
      return '';
    }

    // Evaluate all arguments
    const evaluatedArgs = args.map(arg => this.evaluate(arg));

    try {
      const result = func(...evaluatedArgs);
      logger.debug('Evaluated function', TAG, {
        name,
        argsCount: args.length,
        result: typeof result === 'object' ? '[object]' : result
      });
      return result;
    } catch (err) {
      logger.error('Error evaluating function', TAG, {
        name,
        error: err.message
      });
      return '';
    }
  }

  /**
   * Evaluates a binary operation.
   */
  evaluateBinaryOp(node) {
    const { operator, left, right } = node;

    const leftValue = this.evaluate(left);
    const rightValue = this.evaluate(right);

    const op = BINARY_OPS[operator];

    if (!op) {
      logger.warn('Unknown binary operator', TAG, { operator });
      return '';
    }

    const result = op(leftValue, rightValue);
    logger.debug('Evaluated binary op', TAG, {
      operator,
      left: leftValue,
      right: rightValue,
      result
    });
    return result;
  }

  /**
   * Evaluates a unary operation.
   */
  evaluateUnaryOp(node) {
    const { operator, operand } = node;

    const value = this.evaluate(operand);

    const op = UNARY_OPS[operator];

    if (!op) {
      logger.warn('Unknown unary operator', TAG, { operator });
      return value;
    }

    return op(value);
  }
}

/**
 * Convenience function to evaluate an AST with column values.
 * @param {object} ast - The AST to evaluate.
 * @param {Map<string, any>} columnValues - Map of columnId -> value.
 * @returns {any} The evaluated result.
 */
export function evaluate(ast, columnValues) {
  const evaluator = new Evaluator(columnValues);
  return evaluator.evaluate(ast);
}

/**
 * Formats the result as a display string.
 * @param {any} value - The value to format.
 * @returns {string} The formatted display value.
 */
export function formatResult(value) {
  if (value === null || value === undefined) {
    return '';
  }

  if (value instanceof Date) {
    // Format dates as ISO string
    return value.toISOString().split('T')[0];
  }

  if (typeof value === 'boolean') {
    return value ? 'true' : 'false';
  }

  if (typeof value === 'number') {
    // Round to reasonable precision
    if (Number.isInteger(value)) {
      return String(value);
    }
    return String(Math.round(value * 1000000) / 1000000);
  }

  return String(value);
}

export default {
  Evaluator,
  evaluate,
  formatResult,
};
