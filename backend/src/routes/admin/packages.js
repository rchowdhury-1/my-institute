const express = require('express');
const { pool } = require('../../db');
const { asyncHandler } = require('../../middleware/errors');

const router = express.Router();

// ─── Packages ────────────────────────────────────────────────────────────────

// POST /admin/packages — create/assign a prepaid bundle for a student
router.post('/packages', asyncHandler(async (req, res) => {
  const { student_id, package_name, total_lessons, expires_at } = req.body;
  if (!student_id || !package_name || !total_lessons)
    return res.status(400).json({ error: 'student_id, package_name and total_lessons are required' });

  const result = await pool.query(
    `INSERT INTO packages (user_id, package_name, total_lessons, sessions_remaining, expires_at)
     VALUES ($1, $2, $3, $3, $4)
     RETURNING *`,
    [student_id, package_name, parseInt(total_lessons), expires_at || null]
  );
  res.status(201).json({ package: result.rows[0] });
}));

// PATCH /admin/packages/:id — update bundle details and/or renewal date
router.patch('/packages/:id', asyncHandler(async (req, res) => {
  const { package_name, total_lessons, sessions_remaining, expires_at } = req.body;

  const result = await pool.query(
    `UPDATE packages
     SET package_name       = COALESCE($1, package_name),
         total_lessons      = COALESCE($2, total_lessons),
         sessions_remaining = COALESCE($3, sessions_remaining),
         expires_at         = COALESCE($4, expires_at)
     WHERE id = $5
     RETURNING *`,
    [
      package_name || null,
      total_lessons != null ? parseInt(total_lessons) : null,
      sessions_remaining != null ? parseInt(sessions_remaining) : null,
      expires_at || null,
      req.params.id,
    ]
  );
  if (result.rows.length === 0) return res.status(404).json({ error: 'Bundle not found' });
  res.json({ package: result.rows[0] });
}));

module.exports = router;
