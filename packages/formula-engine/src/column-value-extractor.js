/**
 * Column Value Extractor
 * Extracts display values from different monday.com column types.
 *
 * Based on monday.com GraphQL API column value types.
 */

import logger from './logger.js';

const TAG = 'column_value_extractor';

/**
 * Parses a comma-separated string of numeric values into an array of numbers.
 * Handles various formats: "9.75, 3, 1.50, 1.00" -> [9.75, 3, 1.5, 1]
 * @param {string} displayValue - The display value string from Mirror column.
 * @returns {number[]} - Array of parsed numbers (empty values are filtered out).
 */
export function parseNumericValues(displayValue) {
  if (!displayValue || typeof displayValue !== 'string') {
    return [];
  }

  return displayValue
    .split(',')
    .map(v => v.trim())
    .filter(v => v !== '' && v !== 'null' && v !== 'undefined')
    .map(v => parseFloat(v))
    .filter(n => !isNaN(n));
}

/**
 * Applies an aggregation function to an array of numbers.
 * Supports: sum, avg/average, count, min, max
 * @param {number[]} values - Array of numbers to aggregate.
 * @param {string} func - The aggregation function name.
 * @returns {number} - The aggregated result.
 */
export function applyAggregationFunction(values, func) {
  if (!values || values.length === 0) {
    return 0;
  }

  const funcLower = (func || '').toLowerCase();

  switch (funcLower) {
    case 'sum':
      return values.reduce((acc, val) => acc + val, 0);

    case 'avg':
    case 'average':
      return values.reduce((acc, val) => acc + val, 0) / values.length;

    case 'count':
      return values.length;

    case 'min':
      return Math.min(...values);

    case 'max':
      return Math.max(...values);

    default:
      // If unknown function, return sum as default for numeric aggregation
      logger.warn('Unknown aggregation function, defaulting to sum', TAG, { func });
      return values.reduce((acc, val) => acc + val, 0);
  }
}

/**
 * Column type to value extractor mapping.
 * Each extractor knows how to get the display value from its column type.
 */
const VALUE_EXTRACTORS = {
  // Text-based columns - use text directly
  text: (colValue) => colValue.text ?? '',
  long_text: (colValue) => colValue.text ?? '',
  email: (colValue) => colValue.text ?? colValue.email ?? '',
  link: (colValue) => colValue.text ?? colValue.url ?? '',
  phone: (colValue) => colValue.text ?? colValue.phone ?? '',

  // Numeric columns
  numbers: (colValue) => {
    if (colValue.number !== null && colValue.number !== undefined) {
      return colValue.number;
    }
    return colValue.text ?? '';
  },

  // Date/Time columns
  date: (colValue) => {
    // Return the date string, or formatted text
    if (colValue.date) {
      return colValue.time ? `${colValue.date} ${colValue.time}` : colValue.date;
    }
    return colValue.text ?? '';
  },

  hour: (colValue) => {
    if (colValue.hour !== null && colValue.hour !== undefined) {
      const hour = String(colValue.hour).padStart(2, '0');
      const minute = String(colValue.minute ?? 0).padStart(2, '0');
      return `${hour}:${minute}`;
    }
    return colValue.text ?? '';
  },

  timeline: (colValue) => {
    if (colValue.from && colValue.to) {
      return `${colValue.from} - ${colValue.to}`;
    }
    return colValue.text ?? '';
  },

  // Status/Selection columns
  status: (colValue) => colValue.label ?? colValue.text ?? '',

  dropdown: (colValue) => {
    if (colValue.values && Array.isArray(colValue.values)) {
      return colValue.values.map(v => v.label ?? v.name ?? v).join(', ');
    }
    return colValue.text ?? '';
  },

  // People columns
  people: (colValue) => {
    if (colValue.persons_and_teams && Array.isArray(colValue.persons_and_teams)) {
      return colValue.persons_and_teams.map(p => p.name ?? p.id).join(', ');
    }
    return colValue.text ?? '';
  },

  // Boolean columns
  checkbox: (colValue) => {
    if (colValue.checked !== null && colValue.checked !== undefined) {
      return colValue.checked ? 'true' : 'false';
    }
    return colValue.text ?? '';
  },

  // Rating column
  rating: (colValue) => {
    if (colValue.rating !== null && colValue.rating !== undefined) {
      return colValue.rating;
    }
    return colValue.text ?? '';
  },

  // Vote column
  vote: (colValue) => {
    if (colValue.vote_count !== null && colValue.vote_count !== undefined) {
      return colValue.vote_count;
    }
    return colValue.text ?? '';
  },

  // Country column
  country: (colValue) => colValue.text ?? colValue.name ?? '',

  // Creation/Update log columns
  creation_log: (colValue) => colValue.text ?? colValue.created_at ?? '',
  last_updated: (colValue) => colValue.text ?? colValue.updated_at ?? '',

  // Item ID column
  item_id: (colValue) => colValue.text ?? colValue.item_id ?? '',

  // Time tracking column
  time_tracking: (colValue) => {
    if (colValue.duration !== null && colValue.duration !== undefined) {
      // Duration is in seconds, convert to readable format
      const hours = Math.floor(colValue.duration / 3600);
      const minutes = Math.floor((colValue.duration % 3600) / 60);
      return `${hours}:${String(minutes).padStart(2, '0')}`;
    }
    return colValue.text ?? '';
  },

  // Dependency column
  dependency: (colValue) => {
    if (colValue.linked_items && Array.isArray(colValue.linked_items)) {
      return colValue.linked_items.map(item => item.name ?? item.id).join(', ');
    }
    return colValue.text ?? '';
  },

  // Board relation column
  board_relation: (colValue) => {
    if (colValue.linked_items && Array.isArray(colValue.linked_items)) {
      return colValue.linked_items.map(item => item.name ?? item.id).join(', ');
    }
    return colValue.text ?? '';
  },

  // Mirror column - supports aggregation functions (sum, avg, count, min, max)
  mirror: (colValue, settings) => {
    const displayValue = colValue.display_value;

    // If settings has an aggregation function and we have display_value, apply it
    if (settings?.function && displayValue) {
      const values = parseNumericValues(displayValue);
      if (values.length > 0) {
        const result = applyAggregationFunction(values, settings.function);
        logger.debug('Mirror aggregation applied', TAG, {
          displayValue,
          function: settings.function,
          values,
          result
        });
        return result;
      }
    }

    // If mirrored_items available, use them for text representation
    if (colValue.mirrored_items && Array.isArray(colValue.mirrored_items)) {
      return colValue.mirrored_items
        .map(mirror => mirror.linked_item?.name ?? mirror.linked_item?.id)
        .filter(Boolean)
        .join(', ');
    }

    // Fallback to display_value or text
    if (displayValue) {
      return displayValue;
    }
    return colValue.text ?? '';
  },

  // Formula column
  formula: (colValue) => colValue.display_value ?? colValue.text ?? '',

  // World clock column
  world_clock: (colValue) => colValue.text ?? colValue.timezone ?? '',

  // Week column
  week: (colValue) => {
    if (colValue.start_date && colValue.end_date) {
      return `${colValue.start_date} - ${colValue.end_date}`;
    }
    return colValue.text ?? '';
  },
};

/**
 * Extracts the display value from a column value object.
 * @param {object} columnValue - The column value object from monday.com API.
 * @param {string} columnType - The column type (e.g., 'text', 'numbers', 'date').
 * @param {object} [columnSettings] - Optional column settings for aggregation functions.
 * @returns {any} - The extracted value suitable for formula evaluation.
 */
export function extractColumnValue(columnValue, columnType, columnSettings = null) {
  if (!columnValue) {
    // Smart Defaults: numbers returns 0, everything else returns empty string
    return (columnType?.toLowerCase() === 'numbers') ? 0 : '';
  }

  const type = columnType?.toLowerCase() ?? columnValue.type?.toLowerCase();

  if (!type) {
    logger.warn('No column type provided, using text fallback', TAG);
    return columnValue.text ?? '';
  }

  const extractor = VALUE_EXTRACTORS[type];

  if (extractor) {
    try {
      // Pass settings to extractors that support it (like mirror)
      const value = extractor(columnValue, columnSettings);
      
      // Smart Default for null/undefined result
      if (value === null || value === undefined) {
        return (type === 'numbers') ? 0 : '';
      }
      
      logger.debug('Extracted column value', TAG, { type, value, hasSettings: !!columnSettings });
      return value;
    } catch (err) {
      logger.warn('Error extracting column value, using text fallback', TAG, {
        type,
        error: err.message
      });
      return columnValue.text ?? '';
    }
  }

  // Fallback to text for unknown column types
  logger.debug('Unknown column type, using text fallback', TAG, { type });
  return columnValue.text ?? '';
}

/**
 * Extracts values from multiple column values.
 * @param {object[]} columnValues - Array of column value objects.
 * @returns {Map<string, any>} - Map of columnId -> extracted value.
 */
export function extractMultipleColumnValues(columnValues) {
  const valuesMap = new Map();

  if (!columnValues || !Array.isArray(columnValues)) {
    return valuesMap;
  }

  for (const colValue of columnValues) {
    const columnId = colValue.id;
    const columnType = colValue.type;
    const extractedValue = extractColumnValue(colValue, columnType);
    valuesMap.set(columnId, extractedValue);
  }

  logger.info('Extracted multiple column values', TAG, {
    count: valuesMap.size,
    columns: Array.from(valuesMap.keys())
  });

  return valuesMap;
}

/**
 * Gets the GraphQL fragment fields needed for a specific column type.
 * This helps build efficient queries that request only needed fields.
 * @param {string} columnType - The column type.
 * @returns {string} - GraphQL fragment fields.
 */
export function getColumnTypeFields(columnType) {
  const COLUMN_TYPE_FIELDS = {
    text: 'text',
    long_text: 'text',
    numbers: 'number text',
    date: 'date time text',
    hour: 'hour minute text',
    status: 'label text',
    dropdown: 'values { id label } text',
    people: 'persons_and_teams { id name } text',
    checkbox: 'checked text',
    rating: 'rating text',
    timeline: 'from to text',
    formula: 'display_value text',
    board_relation: 'linked_items { id name } text',
    mirror: 'mirrored_items { linked_item { id name } } display_value text',
    vote: 'vote_count text',
    time_tracking: 'duration text',
    dependency: 'linked_items { id name } text',
  };

  return COLUMN_TYPE_FIELDS[columnType?.toLowerCase()] ?? 'text';
}

export default {
  extractColumnValue,
  extractMultipleColumnValues,
  getColumnTypeFields,
  parseNumericValues,
  applyAggregationFunction,
};
