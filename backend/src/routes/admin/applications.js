const express = require('express');
const { pool } = require('../../db');
const { asyncHandler } = require('../../middleware/errors');
const { validateEnum } = require('../../lib/validators');

const router = express.Router();

// ─── Free Trials ─────────────────────────────────────────────────────────────

// GET /admin/free-trials
router.get('/free-trials', asyncHandler(async (req, res) => {
  const result = await pool.query('SELECT * FROM free_trials ORDER BY created_at DESC');
  res.json({ free_trials: result.rows });
}));

// PATCH /admin/free-trials/:id
router.patch('/free-trials/:id', asyncHandler(async (req, res) => {
  const { status } = req.body;
  const statusError = validateEnum(status, ['pending', 'contacted', 'converted']);
  if (statusError) return res.status(400).json({ error: statusError });

  const result = await pool.query(
    'UPDATE free_trials SET status = $1 WHERE id = $2 RETURNING *',
    [status, req.params.id]
  );
  if (result.rows.length === 0) return res.status(404).json({ error: 'Not found' });
  res.json({ free_trial: result.rows[0] });
}));

// ─── Scholarships ────────────────────────────────────────────────────────────

// GET /admin/scholarships
router.get('/scholarships', asyncHandler(async (req, res) => {
  const result = await pool.query('SELECT * FROM scholarship_applications ORDER BY created_at DESC');
  res.json({ scholarships: result.rows });
}));

// PATCH /admin/scholarships/:id
router.patch('/scholarships/:id', asyncHandler(async (req, res) => {
  const { status } = req.body;
  const statusError = validateEnum(status, ['pending', 'approved', 'rejected']);
  if (statusError) return res.status(400).json({ error: statusError });

  const result = await pool.query(
    'UPDATE scholarship_applications SET status = $1 WHERE id = $2 RETURNING *',
    [status, req.params.id]
  );
  if (result.rows.length === 0) return res.status(404).json({ error: 'Not found' });
  res.json({ scholarship: result.rows[0] });
}));

// ─── Revert Applications ────────────────────────────────────────────────────

// GET /admin/revert-applications — list all, newest first
router.get('/revert-applications', asyncHandler(async (req, res) => {
  const result = await pool.query(
    'SELECT * FROM revert_applications ORDER BY created_at DESC'
  );
  res.json({ applications: result.rows });
}));

// PATCH /admin/revert-applications/:id — update status
router.patch('/revert-applications/:id', asyncHandler(async (req, res) => {
  const { status } = req.body;
  const statusError = validateEnum(status, ['new', 'contacted', 'enrolled', 'archived']);
  if (statusError) return res.status(400).json({ error: statusError });

  const result = await pool.query(
    'UPDATE revert_applications SET status = $1 WHERE id = $2 RETURNING *',
    [status, req.params.id]
  );
  if (result.rows.length === 0)
    return res.status(404).json({ error: 'Not found' });
  res.json({ application: result.rows[0] });
}));

module.exports = router;
