/**
 * Text Functions
 * monday.com formula text manipulation functions.
 */

/**
 * CONCATENATE - Concatenates text values into a single text value.
 * Example: CONCATENATE("I","love","monday.com") => "Ilovemonday.com"
 */
export function CONCATENATE(...args) {
  return args.map(arg => String(arg ?? '')).join('');
}

/**
 * LEFT - Extracts a given number of characters from the left side.
 * Example: LEFT("monday.com", 3) => "mon"
 */
export function LEFT(text, numChars) {
  const str = String(text ?? '');
  const num = Math.max(0, Math.floor(Number(numChars) || 0));
  return str.substring(0, num);
}

/**
 * LEN - Returns the amount of characters of a given text string.
 * Example: LEN("hello") => 5
 */
export function LEN(text) {
  return String(text ?? '').length;
}

/**
 * LOWER - Converts a specified string to lowercase.
 * Example: LOWER("Some STRING") => "some string"
 */
export function LOWER(text) {
  return String(text ?? '').toLowerCase();
}

/**
 * REPLACE - Replaces a part of a string with the new string.
 * Example: REPLACE("Goat", 1, 2, "Fl") => "Flat"
 * @param {string} text - Original text
 * @param {number} startPos - Starting position (1-based)
 * @param {number} numChars - Number of characters to replace
 * @param {string} newText - Replacement text
 */
export function REPLACE(text, startPos, numChars, newText) {
  const str = String(text ?? '');
  const start = Math.max(1, Math.floor(Number(startPos) || 1)) - 1; // Convert to 0-based
  const num = Math.max(0, Math.floor(Number(numChars) || 0));
  const replacement = String(newText ?? '');

  return str.substring(0, start) + replacement + str.substring(start + num);
}

/**
 * REPT - Repeats a string a given number of times.
 * Example: REPT("monday", 3) => "mondaymondaymonday"
 */
export function REPT(text, times) {
  const str = String(text ?? '');
  const count = Math.max(0, Math.floor(Number(times) || 0));
  return str.repeat(count);
}

/**
 * RIGHT - Extracts a number of characters from the right side of a given text string.
 * Example: RIGHT("monday", 3) => "day"
 */
export function RIGHT(text, numChars) {
  const str = String(text ?? '');
  const num = Math.max(0, Math.floor(Number(numChars) || 0));
  return str.slice(-num);
}

/**
 * SEARCH - Searches a string within another string.
 * Returns the position (1-based) or 0 if not found.
 * Example: SEARCH("love", "I love monday", 1) => 3
 * @param {string} findText - Text to find
 * @param {string} withinText - Text to search in
 * @param {number} startPos - Starting position (1-based, optional)
 */
export function SEARCH(findText, withinText, startPos = 1) {
  const find = String(findText ?? '').toLowerCase();
  const within = String(withinText ?? '').toLowerCase();
  const start = Math.max(0, Math.floor(Number(startPos) || 1) - 1);

  const index = within.indexOf(find, start);
  return index >= 0 ? index + 1 : 0; // Return 1-based position or 0
}

/**
 * SUBSTITUTE - Replace text in a given text string by matching.
 * Example: SUBSTITUTE("goodmorning", "morning", "night") => "goodnight"
 * @param {string} text - Original text
 * @param {string} oldText - Text to replace
 * @param {string} newText - Replacement text
 * @param {number} instance - Which instance to replace (optional, all if omitted)
 */
export function SUBSTITUTE(text, oldText, newText, instance) {
  const str = String(text ?? '');
  const old = String(oldText ?? '');
  const replacement = String(newText ?? '');

  if (!old) return str;

  if (instance === undefined || instance === null) {
    // Replace all instances
    return str.split(old).join(replacement);
  }

  // Replace specific instance
  const num = Math.max(1, Math.floor(Number(instance) || 1));
  let count = 0;
  let result = str;
  let pos = 0;

  while (pos < result.length) {
    const index = result.indexOf(old, pos);
    if (index === -1) break;

    count++;
    if (count === num) {
      result = result.substring(0, index) + replacement + result.substring(index + old.length);
      break;
    }
    pos = index + old.length;
  }

  return result;
}

/**
 * TEXT - Formats the given value based on the given text format.
 * Example: TEXT(8500.6, "$#,##0.00") => "$8,500.60"
 * Supports basic number formatting.
 */
export function TEXT(value, formatString) {
  const num = Number(value);
  const format = String(formatString ?? '');

  if (isNaN(num)) {
    return String(value ?? '');
  }

  // Basic format patterns
  if (format.includes('#') || format.includes('0')) {
    // Number formatting
    let prefix = '';
    let suffix = '';
    let formatPart = format;

    // Extract prefix (like $)
    const prefixMatch = format.match(/^([^#0,.]+)/);
    if (prefixMatch) {
      prefix = prefixMatch[1];
      formatPart = format.substring(prefix.length);
    }

    // Extract suffix
    const suffixMatch = formatPart.match(/([^#0,.]+)$/);
    if (suffixMatch) {
      suffix = suffixMatch[1];
      formatPart = formatPart.substring(0, formatPart.length - suffix.length);
    }

    // Determine decimal places
    const decimalMatch = formatPart.match(/\.(0+)/);
    const decimals = decimalMatch ? decimalMatch[1].length : 0;

    // Format number
    const useThousands = formatPart.includes(',');
    let formatted = num.toFixed(decimals);

    if (useThousands) {
      const parts = formatted.split('.');
      parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',');
      formatted = parts.join('.');
    }

    return prefix + formatted + suffix;
  }

  // Date formats would go here if needed
  return String(value ?? '');
}

/**
 * TRIM - Removes all spaces from a string except for single spaces between words.
 * Example: TRIM(" I love MDY ") => "I love MDY"
 */
export function TRIM(text) {
  return String(text ?? '').trim().replace(/\s+/g, ' ');
}

/**
 * UPPER - Convert a specified string to uppercase.
 * Example: UPPER("monday.com") => "MONDAY.COM"
 */
export function UPPER(text) {
  return String(text ?? '').toUpperCase();
}

export default {
  CONCATENATE,
  LEFT,
  LEN,
  LOWER,
  REPLACE,
  REPT,
  RIGHT,
  SEARCH,
  SUBSTITUTE,
  TEXT,
  TRIM,
  UPPER,
};
