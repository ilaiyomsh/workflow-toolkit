/**
 * Formula Parser
 * Builds an Abstract Syntax Tree (AST) from tokens.
 */

import logger from './logger.js';
import { TokenType, tokenize } from './tokenizer.js';

const TAG = 'formula_parser_ast';

/**
 * AST Node types
 */
export const NodeType = {
  LITERAL: 'LITERAL',           // Numbers, strings, booleans
  COLUMN_REF: 'COLUMN_REF',     // {column_id}
  FUNCTION_CALL: 'FUNCTION_CALL', // SUM(...), IF(...)
  BINARY_OP: 'BINARY_OP',       // a + b, a > b
  UNARY_OP: 'UNARY_OP',         // -a
};

/**
 * Operator precedence (higher = binds tighter)
 */
const PRECEDENCE = {
  '<': 1, '>': 1, '=': 1, '<=': 1, '>=': 1, '<>': 1,
  '+': 2, '-': 2,
  '*': 3, '/': 3, '%': 3,
  '&': 4, // String concatenation
};

/**
 * AST Node factory functions
 */
export const AST = {
  literal(value, dataType = 'auto') {
    let type = dataType;
    if (dataType === 'auto') {
      if (typeof value === 'number') type = 'number';
      else if (typeof value === 'boolean') type = 'boolean';
      else type = 'string';
    }
    return { type: NodeType.LITERAL, value, dataType: type };
  },

  columnRef(columnId, field = null) {
    return { type: NodeType.COLUMN_REF, columnId, field };
  },

  functionCall(name, args = []) {
    return { type: NodeType.FUNCTION_CALL, name, args };
  },

  binaryOp(operator, left, right) {
    return { type: NodeType.BINARY_OP, operator, left, right };
  },

  unaryOp(operator, operand) {
    return { type: NodeType.UNARY_OP, operator, operand };
  },
};

/**
 * Parser class - converts tokens to AST
 */
export class Parser {
  constructor(tokens) {
    this.tokens = tokens || [];
    this.pos = 0;
  }

  /**
   * Returns current token without advancing.
   */
  peek(offset = 0) {
    return this.tokens[this.pos + offset];
  }

  /**
   * Returns current token and advances position.
   */
  advance() {
    return this.tokens[this.pos++];
  }

  /**
   * Checks if current token matches expected type.
   */
  check(type) {
    return this.peek()?.type === type;
  }

  /**
   * Consumes token if it matches expected type, throws otherwise.
   */
  expect(type, message) {
    if (!this.check(type)) {
      const token = this.peek();
      throw new Error(`${message}. Got ${token?.type} at position ${token?.position}`);
    }
    return this.advance();
  }

  /**
   * Main parse entry point.
   */
  parse() {
    if (this.tokens.length === 0 ||
        (this.tokens.length === 1 && this.tokens[0].type === TokenType.EOF)) {
      return AST.literal('');
    }

    const result = this.parseExpression();

    // Make sure we consumed all tokens (except EOF)
    if (!this.check(TokenType.EOF)) {
      const remaining = this.peek();
      logger.warn('Unexpected tokens remaining after parse', TAG, {
        remaining: remaining?.toString()
      });
    }

    return result;
  }

  /**
   * Parses an expression (handles binary operators with precedence).
   */
  parseExpression(minPrecedence = 0) {
    let left = this.parsePrimary();

    while (this.check(TokenType.OPERATOR)) {
      const op = this.peek().value;
      const precedence = PRECEDENCE[op];

      if (precedence === undefined || precedence < minPrecedence) {
        break;
      }

      this.advance(); // Consume operator
      const right = this.parseExpression(precedence + 1);
      left = AST.binaryOp(op, left, right);
    }

    return left;
  }

  /**
   * Parses a primary expression (literals, column refs, function calls).
   */
  parsePrimary() {
    const token = this.peek();

    if (!token || token.type === TokenType.EOF) {
      return AST.literal('');
    }

    switch (token.type) {
      case TokenType.NUMBER:
        this.advance();
        return AST.literal(token.value, 'number');

      case TokenType.STRING:
        this.advance();
        return AST.literal(token.value, 'string');

      case TokenType.BOOLEAN:
        this.advance();
        return AST.literal(token.value, 'boolean');

      case TokenType.COLUMN_REF:
        this.advance();
        return AST.columnRef(token.value.columnId, token.value.field);

      case TokenType.FUNCTION:
        return this.parseFunctionCall();

      case TokenType.LPAREN:
        return this.parseGroupedExpression();

      case TokenType.OPERATOR:
        // Unary minus
        if (token.value === '-') {
          this.advance();
          const operand = this.parsePrimary();
          return AST.unaryOp('-', operand);
        }
        throw new Error(`Unexpected operator: ${token.value}`);

      default:
        throw new Error(`Unexpected token: ${token.type} (${token.value})`);
    }
  }

  /**
   * Parses a function call: FUNC(arg1, arg2, ...)
   */
  parseFunctionCall() {
    const funcToken = this.advance(); // Function name
    const name = funcToken.value;

    // Some functions like TODAY(), PI(), TRUE(), FALSE() may have no parens
    if (!this.check(TokenType.LPAREN)) {
      // Constants that don't need parens
      if (name === 'TRUE') return AST.literal(true, 'boolean');
      if (name === 'FALSE') return AST.literal(false, 'boolean');
      if (name === 'PI') return AST.literal(Math.PI, 'number');
      if (name === 'TODAY' || name === 'NOW') {
        return AST.functionCall(name, []);
      }
      // Treat as zero-argument function
      return AST.functionCall(name, []);
    }

    this.expect(TokenType.LPAREN, `Expected '(' after function name ${name}`);

    const args = [];

    // Handle empty argument list
    if (!this.check(TokenType.RPAREN)) {
      // Parse first argument
      args.push(this.parseExpression());

      // Parse remaining arguments
      while (this.check(TokenType.COMMA)) {
        this.advance(); // Consume comma
        args.push(this.parseExpression());
      }
    }

    this.expect(TokenType.RPAREN, `Expected ')' after function arguments for ${name}`);

    return AST.functionCall(name, args);
  }

  /**
   * Parses a grouped expression: (expression)
   */
  parseGroupedExpression() {
    this.expect(TokenType.LPAREN, "Expected '('");
    const expr = this.parseExpression();
    this.expect(TokenType.RPAREN, "Expected ')'");
    return expr;
  }
}

/**
 * Convenience function to parse a formula string into an AST.
 * @param {string} formula - The formula string to parse.
 * @returns {object} The AST root node.
 */
export function parse(formula) {
  const tokens = tokenize(formula);
  const parser = new Parser(tokens);

  try {
    const ast = parser.parse();
    logger.debug('Parsed formula to AST', TAG, {
      formula,
      astType: ast.type
    });
    return ast;
  } catch (err) {
    logger.error('Failed to parse formula', TAG, {
      formula,
      error: err.message
    });
    throw err;
  }
}

/**
 * Extracts all column IDs referenced in the formula.
 * @param {string} formula - The formula string.
 * @returns {string[]} Array of unique column IDs.
 */
export function extractColumnIds(formula) {
  const tokens = tokenize(formula);
  const columnIds = new Set();

  for (const token of tokens) {
    if (token.type === TokenType.COLUMN_REF) {
      columnIds.add(token.value.columnId);
    }
  }

  return Array.from(columnIds);
}

export default {
  NodeType,
  AST,
  Parser,
  parse,
  extractColumnIds,
};
