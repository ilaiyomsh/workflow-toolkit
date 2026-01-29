/**
 * Numeric Functions
 * monday.com formula numeric/mathematical functions.
 */

/**
 * ABS - Returns the absolute value of a given number.
 * Example: ABS(-1) => 1
 */
export function ABS(number) {
  return Math.abs(Number(number) || 0);
}

/**
 * AVERAGE - Returns the average of the given numbers.
 * Example: AVERAGE(1, 2, 3) => 2
 */
export function AVERAGE(...args) {
  const numbers = args.flat().map(n => Number(n)).filter(n => !isNaN(n));
  if (numbers.length === 0) return 0;
  return numbers.reduce((sum, n) => sum + n, 0) / numbers.length;
}

/**
 * COUNT - Counts the number of numerical items.
 * Example: COUNT(1, 2, "a") => 2
 */
export function COUNT(...args) {
  return args.flat().filter(val => {
    const num = Number(val);
    return !isNaN(num) && val !== null && val !== '';
  }).length;
}

/**
 * DIVIDE - One number divided by another.
 * Example: DIVIDE(10, 5) => 2
 */
export function DIVIDE(dividend, divisor) {
  const a = Number(dividend) || 0;
  const b = Number(divisor);
  if (b === 0 || isNaN(b)) return 0; // Avoid division by zero
  return a / b;
}

/**
 * LOG - Gets the logarithm of a number.
 * Example: LOG(16, 2) => 4
 * @param {number} number - The number to get logarithm of
 * @param {number} base - The logarithm base (default: 10)
 */
export function LOG(number, base = 10) {
  const num = Number(number);
  const b = Number(base);
  if (num <= 0 || isNaN(num)) return 0;
  if (b <= 0 || b === 1 || isNaN(b)) return Math.log10(num);
  return Math.log(num) / Math.log(b);
}

/**
 * MAX - Returns the largest value from a set of data.
 * Example: MAX(1, 3, 5, 9) => 9
 */
export function MAX(...args) {
  const numbers = args.flat().map(n => Number(n)).filter(n => !isNaN(n));
  if (numbers.length === 0) return 0;
  return Math.max(...numbers);
}

/**
 * MIN - Returns the smallest value from a set of data.
 * Example: MIN(1, 3, 5, 9) => 1
 */
export function MIN(...args) {
  const numbers = args.flat().map(n => Number(n)).filter(n => !isNaN(n));
  if (numbers.length === 0) return 0;
  return Math.min(...numbers);
}

/**
 * MINUS - Difference of two numbers.
 * Example: MINUS(5, 3) => 2
 */
export function MINUS(number1, number2) {
  return (Number(number1) || 0) - (Number(number2) || 0);
}

/**
 * MOD - Returns the remainder of the division of the given number in the divisor.
 * Example: MOD(10, 3) => 1
 */
export function MOD(number, divisor) {
  const a = Number(number) || 0;
  const b = Number(divisor);
  if (b === 0 || isNaN(b)) return 0;
  return a % b;
}

/**
 * MULTIPLY - Product of two numbers.
 * Example: MULTIPLY(5, 2) => 10
 */
export function MULTIPLY(number1, number2) {
  return (Number(number1) || 0) * (Number(number2) || 0);
}

/**
 * POWER - A number raised to a power.
 * Example: POWER(2, 3) => 8
 */
export function POWER(base, exponent) {
  return Math.pow(Number(base) || 0, Number(exponent) || 0);
}

/**
 * ROUND - Rounds a number to a specific number of digits.
 * Example: ROUND(1.123456, 2) => 1.12
 */
export function ROUND(number, numDigits = 0) {
  const num = Number(number) || 0;
  const digits = Math.floor(Number(numDigits) || 0);
  const factor = Math.pow(10, digits);
  return Math.round(num * factor) / factor;
}

/**
 * ROUNDDOWN - Always rounds a number down.
 * Example: ROUNDDOWN(1.9, 0) => 1
 */
export function ROUNDDOWN(number, numDigits = 0) {
  const num = Number(number) || 0;
  const digits = Math.floor(Number(numDigits) || 0);
  const factor = Math.pow(10, digits);
  return Math.floor(num * factor) / factor;
}

/**
 * ROUNDUP - Always rounds a number up.
 * Example: ROUNDUP(1.1, 0) => 2
 */
export function ROUNDUP(number, numDigits = 0) {
  const num = Number(number) || 0;
  const digits = Math.floor(Number(numDigits) || 0);
  const factor = Math.pow(10, digits);
  return Math.ceil(num * factor) / factor;
}

/**
 * SQRT - Positive square root of a positive number.
 * Example: SQRT(9) => 3
 */
export function SQRT(number) {
  const num = Number(number);
  if (num < 0 || isNaN(num)) return 0;
  return Math.sqrt(num);
}

/**
 * SUM - Sums up all the given numbers.
 * Example: SUM(2, 3, 8) => 13
 */
export function SUM(...args) {
  return args.flat().reduce((sum, val) => {
    const num = Number(val);
    return sum + (isNaN(num) ? 0 : num);
  }, 0);
}

/**
 * PI - Returns the value of PI.
 * Example: PI() => 3.14159...
 */
export function PI() {
  return Math.PI;
}

export default {
  ABS,
  AVERAGE,
  COUNT,
  DIVIDE,
  LOG,
  MAX,
  MIN,
  MINUS,
  MOD,
  MULTIPLY,
  POWER,
  ROUND,
  ROUNDDOWN,
  ROUNDUP,
  SQRT,
  SUM,
  PI,
};
