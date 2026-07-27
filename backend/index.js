require('dotenv').config();

// ─── Fail fast on missing/weak required env vars ────────────────────────────
// A misconfigured deploy must not boot "healthy" and then throw opaque
// errors on the first request that needs a secret (e.g. jwt.sign with an
// undefined secret).
(function validateEnv() {
  const required = ['JWT_SECRET', 'JWT_REFRESH_SECRET', 'DATABASE_URL'];
  const missing = required.filter((key) => !process.env[key]);
  if (missing.length > 0) {
    console.error(`Missing required environment variable(s): ${missing.join(', ')}`);
    process.exit(1);
  }
  const weak = ['JWT_SECRET', 'JWT_REFRESH_SECRET'].filter((key) => process.env[key].length < 32);
  if (weak.length > 0) {
    console.error(`Environment variable(s) too short (must be at least 32 characters): ${weak.join(', ')}`);
    process.exit(1);
  }
})();

const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const { initDb, pool } = require('./src/db');
const featureFlag = require('./src/middleware/featureFlag');
const { createErrorMiddleware } = require('./src/middleware/errors');

// ─── Sentry (optional — only active when SENTRY_DSN is set) ────────────────
// Required once here, not per-error, so a missing/failed require only ever
// costs one warning at boot.
let sentry = null;
if (process.env.SENTRY_DSN) {
  try {
    sentry = require('@sentry/node');
    sentry.init({
      dsn: process.env.SENTRY_DSN,
      environment: process.env.NODE_ENV || 'development',
      tracesSampleRate: 0.1,
    });
  } catch {
    console.warn('[Sentry] @sentry/node not installed — error tracking disabled');
    sentry = null;
  }
}

const app = express();

const allowedOrigins = [
  process.env.CLIENT_URL,
  process.env.FRONTEND_URL,
  'http://localhost:3000',
  'http://localhost:3001',
].filter(Boolean);

if (process.env.DEBUG_CORS) {
  console.log('CORS — allowedOrigins:', JSON.stringify(allowedOrigins));
}

app.use(cors({
  origin: (origin, callback) => {
    if (!origin) return callback(null, true);
    if (allowedOrigins.includes(origin)) return callback(null, true);
    if (process.env.DEBUG_CORS) {
      console.warn('CORS REJECT:', JSON.stringify({ origin, clientUrl: process.env.CLIENT_URL, frontendUrl: process.env.FRONTEND_URL }));
    }
    callback(new Error('Not allowed by CORS'));
  },
  credentials: true,
}));
app.use(express.json());
app.use(cookieParser());

// ─── Always-on routes ────────────────────────────────────────────────────────
app.use('/auth',          require('./src/routes/auth'));
app.use('/students',      require('./src/routes/students'));
app.use('/teachers',      require('./src/routes/teachers'));
app.use('/admin',         require('./src/routes/admin'));
app.use('/sessions',      require('./src/routes/sessions'));
app.use('/homework',      require('./src/routes/homework'));
app.use('/notifications', require('./src/routes/notifications'));
app.use('/cms',           require('./src/routes/cms'));
app.use('/scholarship-apply', require('./src/routes/scholarship-apply'));
app.use('/newsfeed',          require('./src/routes/newsfeed'));
app.use('/revert-apply',      require('./src/routes/revert-apply'));
app.use('/reschedule-requests', require('./src/routes/reschedule'));
app.use('/admin/weekly-schedules', require('./src/routes/weekly-schedules'));
app.use('/cron',                   require('./src/routes/cron'));

// ─── Phase 2B — feature-flagged routes ───────────────────────────────────────
app.use('/exams',        featureFlag('FEATURE_EXAMS'),                  require('./src/routes/exams'));
app.use('/payments',     featureFlag('FEATURE_TEACHER_SALARY'),         require('./src/routes/payments'));
app.use('/messages',     featureFlag('FEATURE_MESSAGING'),              require('./src/routes/messages'));
app.use('/courses',      featureFlag('FEATURE_RECORDED_COURSES'),       require('./src/routes/courses'));
app.use('/scholarships', featureFlag('FEATURE_SCHOLARSHIP_SPONSORSHIP'), require('./src/routes/scholarships'));

// ─── Health check ─────────────────────────────────────────────────────────────
app.get('/health', async (req, res) => {
  let dbStatus = 'ok';
  try {
    await pool.query('SELECT 1');
  } catch (err) {
    console.error('[health] DB check failed:', err);
    dbStatus = 'error';
  }
  res.json({ status: 'ok', db: dbStatus });
});

// ─── Global error handler ────────────────────────────────────────────────────
app.use(createErrorMiddleware(sentry));

const PORT = process.env.PORT || 5000;

initDb()
  .then(() => {
    const resendKey = process.env.RESEND_API_KEY;
    console.log(`RESEND_API_KEY: ${resendKey ? 'set' : 'NOT SET — welcome emails disabled'}`);
    app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
  })
  .catch((err) => {
    console.error('Failed to initialise database:', err);
    process.exit(1);
  });
