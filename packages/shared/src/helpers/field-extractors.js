/**
 * Field Extractors
 * Utility functions for extracting values from Monday.com input fields.
 */

/**
 * Extracts a value from an input field.
 * Handles both direct values and objects with .value property.
 *
 * @param {any} field - The input field (may be direct value or object with .value)
 * @returns {any} The extracted value
 */
export function extractFieldValue(field) {
  return field?.value ?? field;
}

/**
 * Extracts multiple field values from an inputFields object.
 *
 * @param {object} inputFields - The inputFields object from request payload
 * @param {string[]} fieldNames - Array of field names to extract
 * @returns {object} Object with extracted values
 */
export function extractFieldValues(inputFields, fieldNames) {
  const result = {};
  for (const name of fieldNames) {
    result[name] = extractFieldValue(inputFields[name]);
  }
  return result;
}

export default {
  extractFieldValue,
  extractFieldValues,
};
