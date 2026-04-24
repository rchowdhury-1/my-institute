const express = require('express');
const { pool } = require('../db');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();
router.use(requireAuth);

// GET /notifications
router.get('/', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT * FROM notifications WHERE user_id=$1 ORDER BY created_at DESC LIMIT 50`,
      [req.userId]
    );
    const unread_count = result.rows.filter((n) => !n.read).length;
    res.json({ notifications: result.rows, unread_count });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// PATCH /notifications/read-all  (must be before /:id/read)
router.patch('/read-all', async (req, res) => {
  try {
    await pool.query(`UPDATE notifications SET read=true WHERE user_id=$1`, [req.userId]);
    res.json({ message: 'All marked as read' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// PATCH /notifications/:id/read
router.patch('/:id/read', async (req, res) => {
  try {
    await pool.query(
      `UPDATE notifications SET read=true WHERE id=$1 AND user_id=$2`,
      [req.params.id, req.userId]
    );
    res.json({ message: 'Marked as read' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
