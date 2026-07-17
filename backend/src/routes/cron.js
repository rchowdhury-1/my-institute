const express = require('express');
const { pool } = require('../db');
const { requireAuth, requireRole } = require('../middleware/auth');
const { generateAllSchedules, wipeAndRegenerate, OPERATIONAL_TZ } = require('../lib/schedule-generator');

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

// POST /cron/regenerate-all — wipe + regenerate future sessions for ALL active
// schedules (admin/supervisor only). Required once after any OPERATIONAL_TZ
// change: existing future sessions sit at instants computed under the old
// anchor, so plain generation would duplicate rather than replace them.
router.post('/regenerate-all', requireAuth, requireRole('admin', 'supervisor'), async (req, res) => {
  try {
    console.log(`[CRON] Wipe-and-regenerate for all active schedules (anchor: ${OPERATIONAL_TZ})`);

    const schedules = await pool.query(
      `SELECT id FROM weekly_schedules WHERE is_active = true`
    );

    const results = [];
    let totalRemoved = 0;
    let totalCreated = 0;

    for (const { id } of schedules.rows) {
      try {
        const gen = await wipeAndRegenerate(id);
        totalRemoved += gen.sessions_removed;
        totalCreated += gen.created;
        results.push({ schedule_id: id, removed: gen.sessions_removed, created: gen.created, conflicts: gen.conflicts });
      } catch (err) {
        results.push({ schedule_id: id, error: err.message });
      }
    }

    console.log(`[CRON] Regenerate-all done — ${schedules.rows.length} schedules, ${totalRemoved} removed, ${totalCreated} created`);

    res.json({
      operational_tz: OPERATIONAL_TZ,
      schedules_processed: schedules.rows.length,
      total_removed: totalRemoved,
      total_created: totalCreated,
      results,
    });
  } catch (err) {
    console.error('[CRON] Regenerate-all error:', err);
    res.status(500).json({ error: 'Regeneration failed', message: err.message });
  }
});

module.exports = router;
