/**
 * Formula Tokenizer
 * Breaks down monday.com formula strings into tokens for parsing.
 */

import logger from './logger.js';

const TAG = 'formula_tokenizer';

/**
 * Token types
 */
export const TokenType = {
  NUMBER: 'NUMBER',           // 123, 3.14, -5
  STRING: 'STRING',           // "hello", 'world'
  COLUMN_REF: 'COLUMN_REF',   // {column_id}, {col#field}
  FUNCTION: 'FUNCTION',       // SUM, IF, CONCATENATE
  OPERATOR: 'OPERATOR',       // +, -, *, /, >, <, =, >=, <=, <>
  LPAREN: 'LPAREN',           // (
  RPAREN: 'RPAREN',           // )
  COMMA: 'COMMA',             // ,
  BOOLEAN: 'BOOLEAN',         // TRUE, FALSE
  EOF: 'EOF',                 // End of formula
};

/**
 * List of all supported function names (case insensitive)
 */
const FUNCTION_NAMES = new Set([
  // Text functions
  'CONCATENATE', 'LEFT', 'LEN', 'LOWER', 'REPLACE', 'REPT', 'RIGHT',
  'SEARCH', 'SUBSTITUTE', 'TEXT', 'TRIM', 'UPPER',
  // Logical functions
  'AND', 'EXACT', 'IF', 'OR', 'XOR', 'SWITCH',
  // Numeric functions
  'ABS', 'AVERAGE', 'DIVIDE', 'COUNT', 'LOG', 'MAX', 'MIN',
  'MINUS', 'MULTIPLY', 'MOD', 'ROUND', 'ROUNDUP', 'ROUNDDOWN',
  'SQRT', 'SUM', 'POWER',
  // Date functions
  'ADD_DAYS', 'DATE', 'DAY', 'DAYS', 'FORMAT_DATE', 'HOUR',
  'HOURS_DIFF', 'WORKDAYS', 'WORKDAY', 'MINUTE', 'MONTH',
  'SECOND', 'SUBTRACT_DAYS', 'TODAY', 'WEEKNUM', 'ISOWEEKNUM',
  'YEAR', 'SUBTRACT_MINUTES', 'DATEVALUE', 'NOW',
  // Constants
  'PI', 'TRUE', 'FALSE',
]);

/**
 * Operators in order of precedence (for later use in parser)
 */
const OPERATORS = new Set([
  '+', '-', '*', '/', '%',
  '>', '<', '=', '>=', '<=', '<>',
  '&', // String concatenation
]);

/**
 * Two-character operators
 */
const TWO_CHAR_OPERATORS = new Set(['>=', '<=', '<>']);

/**
 * Token class
 */
export class Token {
  constructor(type, value, position) {
    this.type = type;
    this.value = value;
    this.position = position;
  }

  toString() {
    return `Token(${this.type}, ${JSON.stringify(this.value)}, pos:${this.position})`;
  }
}

/**
 * Tokenizer class
 */
export class Tokenizer {
  constructor(formula) {
    this.formula = formula || '';
    this.pos = 0;
    this.tokens = [];
  }

  /**
   * Returns the current character without advancing.
   */
  peek(offset = 0) {
    return this.formula[this.pos + offset];
  }

  /**
   * Returns the current character and advances position.
   */
  advance() {
    return this.formula[this.pos++];
  }

  /**
   * Checks if we've reached the end of the formula.
   */
  isEOF() {
    return this.pos >= this.formula.length;
  }

  /**
   * Skips whitespace characters.
   */
  skipWhitespace() {
    while (!this.isEOF() && /\s/.test(this.peek())) {
      this.advance();
    }
  }

  /**
   * Reads a number (integer or decimal).
   */
  readNumber() {
    const start = this.pos;
    let hasDecimal = false;

    // Handle negative numbers
    if (this.peek() === '-') {
      this.advance();
    }

    while (!this.isEOF()) {
      const char = this.peek();
      if (/\d/.test(char)) {
        this.advance();
      } else if (char === '.' && !hasDecimal) {
        hasDecimal = true;
        this.advance();
      } else {
        break;
      }
    }

    const value = this.formula.slice(start, this.pos);
    return new Token(TokenType.NUMBER, parseFloat(value), start);
  }

  /**
   * Reads a string literal (double or single quoted).
   */
  readString() {
    const start = this.pos;
    const quote = this.advance(); // Opening quote
    let value = '';

    while (!this.isEOF()) {
      const char = this.peek();

      if (char === quote) {
        this.advance(); // Closing quote
        return new Token(TokenType.STRING, value, start);
      }

      if (char === '\\' && this.peek(1) === quote) {
        // Escaped quote
        this.advance();
        value += this.advance();
      } else {
        value += this.advance();
      }
    }

    // Unterminated string
    logger.warn('Unterminated string literal', TAG, { start, value });
    return new Token(TokenType.STRING, value, start);
  }

  /**
   * Reads a column reference: {column_id} or {column_id#field}
   */
  readColumnRef() {
    const start = this.pos;
    this.advance(); // Opening brace

    let columnId = '';
    let field = null;
    let readingField = false;

    while (!this.isEOF()) {
      const char = this.peek();

      if (char === '}') {
        this.advance(); // Closing brace
        return new Token(TokenType.COLUMN_REF, { columnId: columnId.trim(), field }, start);
      }

      if (char === '#') {
        readingField = true;
        this.advance();
        field = '';
      } else if (readingField) {
        field += this.advance();
      } else {
        columnId += this.advance();
      }
    }

    // Unterminated column reference
    logger.warn('Unterminated column reference', TAG, { start, columnId });
    return new Token(TokenType.COLUMN_REF, { columnId: columnId.trim(), field }, start);
  }

  /**
   * Reads an identifier (function name or boolean).
   */
  readIdentifier() {
    const start = this.pos;
    let value = '';

    while (!this.isEOF()) {
      const char = this.peek();
      if (/[a-zA-Z0-9_]/.test(char)) {
        value += this.advance();
      } else {
        break;
      }
    }

    const upperValue = value.toUpperCase();

    // Check if it's a boolean
    if (upperValue === 'TRUE' || upperValue === 'FALSE') {
      return new Token(TokenType.BOOLEAN, upperValue === 'TRUE', start);
    }

    // Check if it's a known function
    if (FUNCTION_NAMES.has(upperValue)) {
      return new Token(TokenType.FUNCTION, upperValue, start);
    }

    // Unknown identifier - treat as function anyway (might be custom)
    logger.debug('Unknown identifier treated as function', TAG, { value });
    return new Token(TokenType.FUNCTION, upperValue, start);
  }

  /**
   * Reads an operator.
   */
  readOperator() {
    const start = this.pos;
    const char = this.peek();
    const twoChar = char + (this.peek(1) || '');

    // Check for two-character operators first
    if (TWO_CHAR_OPERATORS.has(twoChar)) {
      this.advance();
      this.advance();
      return new Token(TokenType.OPERATOR, twoChar, start);
    }

    // Single character operator
    if (OPERATORS.has(char)) {
      this.advance();
      return new Token(TokenType.OPERATOR, char, start);
    }

    // Unknown character
    logger.warn('Unknown character', TAG, { char, position: start });
    this.advance();
    return null;
  }

  /**
   * Gets the next token from the formula.
   */
  nextToken() {
    this.skipWhitespace();

    if (this.isEOF()) {
      return new Token(TokenType.EOF, null, this.pos);
    }

    const char = this.peek();

    // Number (including negative)
    if (/\d/.test(char) || (char === '-' && /\d/.test(this.peek(1)))) {
      return this.readNumber();
    }

    // String literal
    if (char === '"' || char === "'") {
      return this.readString();
    }

    // Column reference
    if (char === '{') {
      return this.readColumnRef();
    }

    // Identifier (function name or boolean)
    if (/[a-zA-Z_]/.test(char)) {
      return this.readIdentifier();
    }

    // Parentheses
    if (char === '(') {
      this.advance();
      return new Token(TokenType.LPAREN, '(', this.pos - 1);
    }

    if (char === ')') {
      this.advance();
      return new Token(TokenType.RPAREN, ')', this.pos - 1);
    }

    // Comma
    if (char === ',') {
      this.advance();
      return new Token(TokenType.COMMA, ',', this.pos - 1);
    }

    // Operators
    return this.readOperator();
  }

  /**
   * Tokenizes the entire formula.
   * @returns {Token[]} Array of tokens.
   */
  tokenize() {
    this.tokens = [];
    this.pos = 0;

    while (true) {
      const token = this.nextToken();

      if (token) {
        this.tokens.push(token);
      }

      if (token?.type === TokenType.EOF) {
        break;
      }
    }

    logger.debug('Tokenized formula', TAG, {
      formula: this.formula,
      tokenCount: this.tokens.length
    });

    return this.tokens;
  }
}

/**
 * Convenience function to tokenize a formula.
 * @param {string} formula - The formula string to tokenize.
 * @returns {Token[]} Array of tokens.
 */
export function tokenize(formula) {
  const tokenizer = new Tokenizer(formula);
  return tokenizer.tokenize();
}

export default {
  TokenType,
  Token,
  Tokenizer,
  tokenize,
};
