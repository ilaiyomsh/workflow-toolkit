import logger from '../services/logger/index.js';

/**
 * Middleware to log all incoming requests and their responses.
 */
export function requestLoggerMiddleware(req, res, next) {
  const startTime = Date.now();

  // Log incoming request
  logger.request(req);

  // Log request body for POST requests (excluding sensitive data)
  if (req.method === 'POST' && req.body) {
    const safeBody = { ...req.body };
    // Remove sensitive fields if present
    if (safeBody.payload?.inputFields?.shortLivedToken) {
      safeBody.payload.inputFields.shortLivedToken = '[REDACTED]';
    }
    logger.debug('Request body', 'request_logger', safeBody);
  }

  // Capture response
  const originalSend = res.send;
  res.send = function(body) {
    const duration = Date.now() - startTime;
    logger.response(req, res.statusCode, duration);
    return originalSend.call(this, body);
  };

  next();
}
