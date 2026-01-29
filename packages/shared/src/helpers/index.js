/**
 * Shared Helpers
 * Utility functions used across the Workflow Toolkit.
 */

export { getSecret } from './secret-store.js';
export { extractFieldValue, extractFieldValues } from './field-extractors.js';

export default {
  getSecret: (await import('./secret-store.js')).getSecret,
  extractFieldValue: (await import('./field-extractors.js')).extractFieldValue,
  extractFieldValues: (await import('./field-extractors.js')).extractFieldValues,
};
