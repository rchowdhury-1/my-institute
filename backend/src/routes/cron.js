const express = require('express');
const { pool } = require('../db');
const { requireAuth, requireRole } = require('../middleware/auth');
const { generateAllSchedules } = require('../lib/schedule-generator');

const router = express.Router();

// POST /cron/generate-sessions — manual trigger (admin/supervisor only)
// On-demand generation in GET /sessions handles normal usage.
// This endpoint is a manual fallback for forcing generation.
router.post('/generate-sessions', requireAuth, requireRole('admin', 'supervisor'), async (req, res) => {
  try {
    console.log('[CRON] Manual session generation triggered');

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
      console.log(`[CRON] ${legacyCount} legacy sessions (not linked to a schedule) exist`);
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
