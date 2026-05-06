require('dotenv').config();
const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const { initDb, pool } = require('./src/db');
const featureFlag = require('./src/middleware/featureFlag');

// ─── Sentry (optional — only active when SENTRY_DSN is set) ────────────────
if (process.env.SENTRY_DSN) {
  try {
    const Sentry = require('@sentry/node');
    Sentry.init({
      dsn: process.env.SENTRY_DSN,
      environment: process.env.NODE_ENV || 'development',
      tracesSampleRate: 0.1,
    });
  } catch {
    console.warn('[Sentry] @sentry/node not installed — error tracking disabled');
  }
}

const app = express();

const allowedOrigins = [
  process.env.CLIENT_URL,
  process.env.FRONTEND_URL,
  'http://localhost:3000',
  'http://localhost:3001',
].filter(Boolean);

console.log('CORS — allowedOrigins:', JSON.stringify(allowedOrigins));

app.use(cors({
  origin: (origin, callback) => {
    if (!origin) return callback(null, true);
    if (allowedOrigins.includes(origin)) return callback(null, true);
    console.log('CORS REJECT — origin:', JSON.stringify(origin));
    console.log('CORS REJECT — expected:', JSON.stringify(process.env.CLIENT_URL));
    console.log('CORS REJECT — also expected:', JSON.stringify(process.env.FRONTEND_URL));
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
  } catch {
    dbStatus = 'error';
  }
  res.json({ status: 'ok', db: dbStatus });
});

// ─── Global error handler ────────────────────────────────────────────────────
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  if (process.env.SENTRY_DSN) {
    try {
      const Sentry = require('@sentry/node');
      Sentry.captureException(err);
    } catch { /* ignore */ }
  }
  console.error(err);
  res.status(500).json({ error: 'Internal server error' });
});

const PORT = process.env.PORT || 5000;

initDb()
  .then(() => {
    app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
  })
  .catch((err) => {
    console.error('Failed to initialise database:', err);
    process.exit(1);
  });
