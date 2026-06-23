const express = require('express');
const { pool } = require('../db');
const { generateAllSchedules } = require('../lib/schedule-generator');

const router = express.Router();

// Auth: CRON_SECRET header (not JWT)
function requireCronSecret(req, res, next) {
  const secret = req.headers['x-cron-secret'];
  if (!process.env.CRON_SECRET) {
    console.warn('[CRON] CRON_SECRET not set — rejecting request');
    return res.status(500).json({ error: 'CRON_SECRET not configured on server' });
  }
  if (secret !== process.env.CRON_SECRET) {
    return res.status(401).json({ error: 'Invalid cron secret' });
  }
  next();
}

// POST /cron/generate-sessions
router.post('/generate-sessions', requireCronSecret, async (req, res) => {
  try {
    console.log('[CRON] Session generation started');

    const generation = await generateAllSchedules();

    // Log legacy session count
    const legacy = await pool.query(
      `SELECT COUNT(*)::int AS count FROM sessions
       WHERE schedule_id IS NULL
         AND status = 'scheduled'
         AND scheduled_at > NOW()`
    );
    const legacyCount = legacy.rows[0]?.count || 0;

    if (legacyCount > 0) {
      console.log(`[CRON] Skipped ${legacyCount} potential generations due to existing legacy sessions`);
    }

    console.log(`[CRON] Done — ${generation.schedules_processed} schedules, ${generation.total_created} created, ${generation.total_skipped} skipped`);

    res.json({
      ...generation,
      legacy_sessions_count: legacyCount,
    });
  } catch (err) {
    console.error('[CRON] Error:', err);
    res.status(500).json({ error: 'Generation failed', message: err.message });
  }
});

module.exports = router;
