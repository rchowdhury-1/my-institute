const express = require('express');
const { pool } = require('../db');
const { requireAuth } = require('../middleware/auth');
const { v4: uuidv4 } = require('uuid');

const router = express.Router();
router.use(requireAuth);

// GET /messages/conversations
router.get('/conversations', async (req, res) => {
  try {
    const result = await pool.query(
      `WITH partners AS (
         SELECT DISTINCT
           CASE WHEN sender_id=$1 THEN receiver_id ELSE sender_id END AS other_id
         FROM messages
         WHERE sender_id=$1 OR receiver_id=$1
       )
       SELECT
         p.other_id,
         u.display_name AS other_name,
         u.role         AS other_role,
         (SELECT content FROM messages
          WHERE (sender_id=$1 AND receiver_id=p.other_id) OR (sender_id=p.other_id AND receiver_id=$1)
          ORDER BY created_at DESC LIMIT 1) AS last_message,
         (SELECT created_at FROM messages
          WHERE (sender_id=$1 AND receiver_id=p.other_id) OR (sender_id=p.other_id AND receiver_id=$1)
          ORDER BY created_at DESC LIMIT 1) AS last_message_at,
         (SELECT COUNT(*)::int FROM messages
          WHERE sender_id=p.other_id AND receiver_id=$1 AND read=false) AS unread_count
       FROM partners p
       JOIN users u ON u.id = p.other_id
       ORDER BY last_message_at DESC NULLS LAST`,
      [req.userId]
    );
    res.json({ conversations: result.rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /messages/:userId — conversation thread
router.get('/:userId', async (req, res) => {
  const { userId } = req.params;
  try {
    const result = await pool.query(
      `SELECT m.*, s.display_name AS sender_name
       FROM messages m
       JOIN users s ON s.id = m.sender_id
       WHERE (m.sender_id=$1 AND m.receiver_id=$2)
          OR (m.sender_id=$2 AND m.receiver_id=$1)
       ORDER BY m.created_at ASC`,
      [req.userId, userId]
    );
    // mark incoming messages as read
    await pool.query(
      `UPDATE messages SET read=true WHERE sender_id=$1 AND receiver_id=$2 AND read=false`,
      [userId, req.userId]
    );
    res.json({ messages: result.rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /messages
router.post('/', async (req, res) => {
  const { receiver_id, content } = req.body;
  if (!receiver_id || !content?.trim())
    return res.status(400).json({ error: 'receiver_id and content are required' });

  try {
    const id = uuidv4();
    const result = await pool.query(
      `INSERT INTO messages (id, sender_id, receiver_id, content) VALUES ($1,$2,$3,$4) RETURNING *`,
      [id, req.userId, receiver_id, content.trim()]
    );

    const sender = await pool.query('SELECT display_name FROM users WHERE id=$1', [req.userId]);
    const receiver = await pool.query('SELECT role FROM users WHERE id=$1', [receiver_id]);
    const receiverRole = receiver.rows[0]?.role;
    const link = receiverRole === 'student' ? '/student/messages'
               : receiverRole === 'teacher' ? '/teacher/messages'
               : '/supervisor';

    await pool.query(
      'INSERT INTO notifications (id, user_id, type, title, message, link) VALUES ($1,$2,$3,$4,$5,$6)',
      [uuidv4(), receiver_id, 'message', 'New Message',
       `New message from ${sender.rows[0]?.display_name}`, link]
    );

    res.status(201).json({ message: result.rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// PATCH /messages/:id/read
router.patch('/:id/read', async (req, res) => {
  try {
    await pool.query(
      `UPDATE messages SET read=true WHERE id=$1 AND receiver_id=$2`,
      [req.params.id, req.userId]
    );
    res.json({ message: 'Marked as read' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
