const express = require('express');
const { pool } = require('../db');
const { requireAuth } = require('../middleware/auth');
const { v4: uuidv4 } = require('uuid');
const { asyncHandler } = require('../middleware/errors');
const { notify } = require('../lib/notify');

const router = express.Router();
router.use(requireAuth);

// GET /messages/conversations
router.get('/conversations', asyncHandler(async (req, res) => {
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
}));

// GET /messages/:userId — conversation thread
router.get('/:userId', asyncHandler(async (req, res) => {
  const { userId } = req.params;
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
}));

// POST /messages
router.post('/', asyncHandler(async (req, res) => {
  const { receiver_id, content } = req.body;
  if (!receiver_id || !content?.trim())
    return res.status(400).json({ error: 'receiver_id and content are required' });

  const id = uuidv4();
  const result = await pool.query(
    `INSERT INTO messages (id, sender_id, receiver_id, content) VALUES ($1,$2,$3,$4) RETURNING *`,
    [id, req.userId, receiver_id, content.trim()]
  );

  const parties = await pool.query(
    `SELECT id, display_name, role FROM users WHERE id = ANY($1::uuid[])`,
    [[req.userId, receiver_id]]
  );
  const senderName = parties.rows.find(u => u.id === req.userId)?.display_name;
  const receiverRole = parties.rows.find(u => u.id === receiver_id)?.role;
  const link = receiverRole === 'student' ? '/student/messages'
             : receiverRole === 'teacher' ? '/teacher/messages'
             : '/supervisor';

  await notify(receiver_id, 'message', 'New Message', `New message from ${senderName}`, link);

  res.status(201).json({ message: result.rows[0] });
}));

// PATCH /messages/:id/read
router.patch('/:id/read', asyncHandler(async (req, res) => {
  await pool.query(
    `UPDATE messages SET read=true WHERE id=$1 AND receiver_id=$2`,
    [req.params.id, req.userId]
  );
  res.json({ message: 'Marked as read' });
}));

module.exports = router;
