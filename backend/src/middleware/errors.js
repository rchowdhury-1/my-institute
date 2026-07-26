// Wraps an async route handler so a rejected promise reaches the central
// error middleware instead of crashing the process or requiring a
// per-handler try/catch.
function asyncHandler(fn) {
  return function wrapped(req, res, next) {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

// Factory so index.js can inject its already-initialised Sentry client
// (or null) without this module touching the optional dependency itself.
function createErrorMiddleware(sentry) {
  // eslint-disable-next-line no-unused-vars
  return function errorMiddleware(err, req, res, next) {
    if (sentry) {
      try {
        sentry.captureException(err);
      } catch {
        /* ignore — Sentry must never be the reason a request fails */
      }
    }
    console.error({ method: req.method, path: req.originalUrl, message: err.message, stack: err.stack });
    res.status(500).json({ error: 'Server error' });
  };
}

module.exports = { asyncHandler, createErrorMiddleware };
