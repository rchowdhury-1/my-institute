/**
 * featureFlag(envVar)
 * Returns a middleware that responds 404 when the named env var is not 'true'.
 * Apply at router-mount level so the entire route tree is unreachable.
 *
 * Usage:
 *   app.use('/exams', featureFlag('FEATURE_EXAMS'), require('./src/routes/exams'));
 */
function featureFlag(envVar) {
  return (req, res, next) => {
    if (process.env[envVar] !== 'true') {
      return res.status(404).json({ error: 'Not found' });
    }
    next();
  };
}

module.exports = featureFlag;
