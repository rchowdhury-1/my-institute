function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

/**
 * Validates a duration in minutes: must be a multiple of 30, at least 30.
 * Returns an error message string if invalid, or null if valid. Callers
 * decide their own parsing/defaulting policy (e.g. `parseInt(x) || 60` for
 * create endpoints vs an explicit `isNaN` check for optional edits) before
 * calling this — the shared part is just the rule and its message.
 */
function validateDuration(minutes, label = 'Duration') {
  if (isNaN(minutes) || minutes < 30 || minutes % 30 !== 0) {
    return `${label} must be 30, 60, 90, or 120 minutes`;
  }
  return null;
}

/**
 * Returns an error message string if `value` isn't in `allowed`, else null.
 */
function validateEnum(value, allowed, errorMessage = 'Invalid value') {
  if (!allowed.includes(value)) return errorMessage;
  return null;
}

module.exports = { isValidEmail, validateDuration, validateEnum };
