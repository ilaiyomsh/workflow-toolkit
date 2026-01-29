/**
 * Simple logger for formula-engine package
 * Can be replaced with any logger implementation
 */

const isDebug = typeof process !== 'undefined' && process.env?.DEBUG === 'true';

const logger = {
  info: (message, tag, data) => {
    if (isDebug) console.log(`[INFO][${tag}]`, message, data || '');
  },
  warn: (message, tag, data) => {
    console.warn(`[WARN][${tag}]`, message, data || '');
  },
  error: (message, tag, data) => {
    console.error(`[ERROR][${tag}]`, message, data || '');
  },
  debug: (message, tag, data) => {
    if (isDebug) console.debug(`[DEBUG][${tag}]`, message, data || '');
  },
};

export default logger;
