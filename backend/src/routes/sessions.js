const express = require('express');
const { pool } = require('../db');
const { requireAuth, requireRole } = require('../middleware/auth');
const { v4: uuidv4 } = require('uuid');

const router = express.Router();
router.use(requireAuth);

async function notify(userId, type, title, message, link = null) {
  await pool.query(
    'INSERT INTO notifications (id, user_id, type, title, message, link) VALUES ($1,$2,$3,$4,$5,$6)',
    [uuidv4(), userId, type, title, message, link]
  );
}

async function notifyAdmins(type, title, message, link = null) {
  const admins = await pool.query(
    `SELECT id FROM users WHERE role IN ('admin', 'supervisor')`
  );
  for (const row of admins.rows) {
    await notify(row.id, type, title, message, link);
  }
}

// GET /sessions
router.get('/', async (req, res) => {
  try {
    let result;
    if (req.userRole === 'student') {
      result = await pool.query(
        `SELECT s.*, u.display_name AS teacher_name
         FROM sessions s JOIN users u ON u.id = s.teacher_id
         WHERE s.student_id = $1
         ORDER BY s.scheduled_at DESC`,
        [req.userId]
      );
    } else if (req.userRole === 'teacher') {
      result = await pool.query(
        `SELECT s.*, u.display_name AS student_name
         FROM sessions s JOIN users u ON u.id = s.student_id
         WHERE s.teacher_id = $1
         ORDER BY s.scheduled_at DESC`,
        [req.userId]
      );
    } else {
      // admin / supervisor
      result = await pool.query(
        `SELECT s.*,
                st.display_name AS student_name,
                t.display_name  AS teacher_name
         FROM sessions s
         JOIN users st ON st.id = s.student_id
         JOIN users t  ON t.id  = s.teacher_id
         ORDER BY s.scheduled_at DESC`
      );
    }
    res.json({ sessions: result.rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /sessions  (admin / supervisor only)
router.post('/', requireRole('admin', 'supervisor'), async (req, res) => {
  const { student_id, teacher_id, scheduled_at, duration_minutes } = req.body;
  if (!student_id || !teacher_id || !scheduled_at)
    return res.status(400).json({ error: 'student_id, teacher_id and scheduled_at are required' });

  try {
    const id = uuidv4();
    const result = await pool.query(
      `INSERT INTO sessions (id, student_id, teacher_id, scheduled_at, duration_minutes)
       VALUES ($1,$2,$3,$4,$5) RETURNING *`,
      [id, student_id, teacher_id, scheduled_at, duration_minutes || 30]
    );
    const session = result.rows[0];
    const dt = new Date(scheduled_at).toLocaleString('en-GB');

    await notify(student_id, 'session_scheduled', 'Session Scheduled',
      `A session has been booked for ${dt}`, '/student/sessions');
    await notify(teacher_id, 'session_scheduled', 'Session Scheduled',
      `A session has been scheduled for ${dt}`, '/teacher/dashboard');

    res.status(201).json({ session });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// DELETE /sessions/:id  (admin / supervisor only)
router.delete('/:id', requireRole('admin', 'supervisor'), async (req, res) => {
  const { id } = req.params;
  try {
    const existing = await pool.query('SELECT * FROM sessions WHERE id=$1', [id]);
    if (existing.rows.length === 0) return res.status(404).json({ error: 'Not found' });
    const session = existing.rows[0];
    await pool.query('DELETE FROM sessions WHERE id=$1', [id]);
    const dt = new Date(session.scheduled_at).toLocaleString('en-GB');
    await notify(session.student_id, 'session_cancelled', 'Session Removed',
      `Your session on ${dt} has been removed by admin`, '/student/sessions');
    await notify(session.teacher_id, 'session_cancelled', 'Session Removed',
      `A session on ${dt} has been removed`, '/teacher/dashboard');
    res.json({ message: 'Session deleted' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// PATCH /sessions/:id/cancel
router.patch('/:id/cancel', async (req, res) => {
  const { cancellation_reason } = req.body;
  const { id } = req.params;

  try {
    const existing = await pool.query('SELECT * FROM sessions WHERE id=$1', [id]);
    if (existing.rows.length === 0) return res.status(404).json({ error: 'Session not found' });
    const session = existing.rows[0];

    if (req.userRole === 'student' && session.student_id !== req.userId)
      return res.status(403).json({ error: 'Forbidden' });
    if (req.userRole === 'teacher' && session.teacher_id !== req.userId)
      return res.status(403).json({ error: 'Forbidden' });

    const result = await pool.query(
      `UPDATE sessions SET status='cancelled', cancellation_reason=$1, updated_at=NOW()
       WHERE id=$2 RETURNING *`,
      [cancellation_reason || null, id]
    );

    const dt = new Date(session.scheduled_at).toLocaleString('en-GB');
    if (req.userRole === 'student') {
      await notify(session.teacher_id, 'session_cancelled', 'Session Cancelled',
        `Session on ${dt} was cancelled by the student`, '/teacher/dashboard');
    } else {
      await notify(session.student_id, 'session_cancelled', 'Session Cancelled',
        `Your session on ${dt} was cancelled`, '/student/sessions');
    }
    await notifyAdmins('session_cancelled', 'Session Cancelled',
      `Session on ${dt} was cancelled`, '/supervisor');

    res.json({ session: result.rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// PATCH /sessions/:id/reschedule  (student / admin / supervisor)
router.patch('/:id/reschedule', requireRole('student', 'admin', 'supervisor'), async (req, res) => {
  const { scheduled_at } = req.body;
  const { id } = req.params;
  if (!scheduled_at) return res.status(400).json({ error: 'scheduled_at is required' });

  try {
    const existing = await pool.query('SELECT * FROM sessions WHERE id=$1', [id]);
    if (existing.rows.length === 0) return res.status(404).json({ error: 'Session not found' });
    const session = existing.rows[0];

    if (req.userRole === 'student' && session.student_id !== req.userId)
      return res.status(403).json({ error: 'Forbidden' });

    await pool.query(
      `UPDATE sessions SET status='rescheduled', updated_at=NOW() WHERE id=$1`, [id]
    );

    const newId = uuidv4();
    const result = await pool.query(
      `INSERT INTO sessions (id, student_id, teacher_id, scheduled_at, duration_minutes, rescheduled_from)
       VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
      [newId, session.student_id, session.teacher_id, scheduled_at, session.duration_minutes, id]
    );

    const newDt = new Date(scheduled_at).toLocaleString('en-GB');
    await notify(session.teacher_id, 'session_rescheduled', 'Session Rescheduled',
      `A session has been rescheduled to ${newDt}`, '/teacher/dashboard');
    await notifyAdmins('session_rescheduled', 'Session Rescheduled',
      `Session rescheduled to ${newDt}`, '/supervisor');

    res.status(201).json({ session: result.rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// PATCH /sessions/:id/complete  (teacher / admin)
router.patch('/:id/complete', requireRole('teacher', 'admin'), async (req, res) => {
  const { id } = req.params;

  try {
    const existing = await pool.query('SELECT * FROM sessions WHERE id=$1', [id]);
    if (existing.rows.length === 0) return res.status(404).json({ error: 'Session not found' });
    const session = existing.rows[0];

    if (req.userRole === 'teacher' && session.teacher_id !== req.userId)
      return res.status(403).json({ error: 'Forbidden' });

    await pool.query(`UPDATE sessions SET status='completed', updated_at=NOW() WHERE id=$1`, [id]);

    // Decrement package sessions_remaining
    const pkg = await pool.query(
      `SELECT * FROM packages WHERE user_id=$1 ORDER BY purchased_at DESC LIMIT 1`,
      [session.student_id]
    );
    if (pkg.rows.length > 0 && pkg.rows[0].sessions_remaining !== null) {
      const remaining = Math.max(0, pkg.rows[0].sessions_remaining - 1);
      await pool.query(`UPDATE packages SET sessions_remaining=$1 WHERE id=$2`, [remaining, pkg.rows[0].id]);

      if (remaining <= 2 && !pkg.rows[0].renewal_reminder_sent) {
        await pool.query(`UPDATE packages SET renewal_reminder_sent=true WHERE id=$1`, [pkg.rows[0].id]);
        await notify(session.student_id, 'renewal_reminder', 'Renew Your Package',
          `You have ${remaining} session${remaining !== 1 ? 's' : ''} remaining. Contact us to renew.`,
          '/packages');
        await notifyAdmins('renewal_reminder', 'Student Package Renewal',
          `A student has ${remaining} sessions remaining and needs renewal.`, '/supervisor');
      }
    }

    res.json({ message: 'Session marked complete' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
