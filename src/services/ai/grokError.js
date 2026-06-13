const MAX_LOG_VALUE_LENGTH = 4000;

/** Truncate a value for safe structured logging. */
function truncateForLog(value, maxLength = MAX_LOG_VALUE_LENGTH) {
  if (value === undefined || value === null) return value;
  const stringValue = typeof value === 'string' ? value : JSON.stringify(value);
  if (stringValue.length <= maxLength) return stringValue;
  return `${stringValue.slice(0, maxLength)}...[truncated]`;
}

/**
 * Wrap an axios error from a Grok API call with request context for logging.
 * Shared by the image and video services — they differ only in the error name.
 */
function createGrokError(name, error, context) {
  const response = error.response;
  const requestId = response?.headers?.['x-request-id'] || response?.headers?.['request-id'] || null;
  const enrichedError = new Error(error.message);

  enrichedError.name = name;
  enrichedError.code = error.code;
  enrichedError.statusCode = response?.status;
  enrichedError.statusText = response?.statusText;
  enrichedError.requestId = requestId;
  enrichedError.responseData = truncateForLog(response?.data);
  enrichedError.context = context;
  enrichedError.cause = error;

  return enrichedError;
}

module.exports = { truncateForLog, createGrokError };
