/**
 * Logical Functions
 * monday.com formula logical/conditional functions.
 */

/**
 * AND - Checks if all the given logical conditions are true and if so returns true.
 * Example: AND(3>1, 4>2) => true
 */
export function AND(...args) {
  if (args.length === 0) return true;
  return args.every(arg => Boolean(arg));
}

/**
 * EXACT - Compares two values, returns true if they are the same and false if they are different.
 * Example: EXACT({Status}, {Status}) => true
 */
export function EXACT(value1, value2) {
  // Convert both to strings for comparison
  const str1 = String(value1 ?? '');
  const str2 = String(value2 ?? '');
  return str1 === str2;
}

/**
 * IF - Checks if a condition is met. If so, returns the first value, otherwise returns the other.
 * Example: IF({some column} > 100, "big deal", "small deal")
 */
export function IF(condition, trueValue, falseValue = '') {
  return Boolean(condition) ? trueValue : falseValue;
}

/**
 * OR - Returns true if any one of the arguments is true.
 * Example: OR(3 > 10, 4 > 2) => true
 */
export function OR(...args) {
  if (args.length === 0) return false;
  return args.some(arg => Boolean(arg));
}

/**
 * XOR - Returns a logical exclusive Or of all the arguments.
 * Returns true if an odd number of arguments are true.
 * Example: XOR(3>0, 2>9) => true
 */
export function XOR(...args) {
  let trueCount = 0;
  for (const arg of args) {
    if (Boolean(arg)) trueCount++;
  }
  return trueCount % 2 === 1;
}

/**
 * SWITCH - Checks if a condition on a specific value is met,
 * if so returns the result of that value, otherwise returns the default result.
 * Pattern: SWITCH({Column}, "val1", "result1", ["val2", "result2"], ..., ["default"])
 * Example: SWITCH({Priority}, "High", 3, "Medium", 2, "Low", 1, 0) => 2 (if priority is "Medium")
 *
 * @param {any} expression - The value to switch on
 * @param {...any} cases - Pairs of value/result, with optional default at the end
 */
export function SWITCH(expression, ...cases) {
  if (cases.length === 0) return '';

  const exprStr = String(expression ?? '');

  // Process pairs of value/result
  for (let i = 0; i < cases.length - 1; i += 2) {
    const caseValue = String(cases[i] ?? '');
    const result = cases[i + 1];

    if (exprStr === caseValue) {
      return result;
    }
  }

  // If odd number of arguments, last one is default
  if (cases.length % 2 === 1) {
    return cases[cases.length - 1];
  }

  return '';
}

/**
 * NOT - Returns the opposite of a logical value.
 * Example: NOT(true) => false
 */
export function NOT(value) {
  return !Boolean(value);
}

/**
 * TRUE - Returns the logical value true.
 * Example: TRUE() => true
 */
export function TRUE() {
  return true;
}

/**
 * FALSE - Returns the logical value false.
 * Example: FALSE() => false
 */
export function FALSE() {
  return false;
}

/**
 * ISBLANK - Checks if a value is blank/empty.
 * Example: ISBLANK("") => true
 */
export function ISBLANK(value) {
  return value === null || value === undefined || value === '';
}

/**
 * ISNUMBER - Checks if a value is a number.
 * Example: ISNUMBER(123) => true
 */
export function ISNUMBER(value) {
  return typeof value === 'number' && !isNaN(value);
}

/**
 * ISTEXT - Checks if a value is text.
 * Example: ISTEXT("hello") => true
 */
export function ISTEXT(value) {
  return typeof value === 'string';
}

export default {
  AND,
  EXACT,
  IF,
  OR,
  XOR,
  SWITCH,
  NOT,
  TRUE,
  FALSE,
  ISBLANK,
  ISNUMBER,
  ISTEXT,
};
