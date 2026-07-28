const express = require('express');
const { pool } = require('../../db');
const { asyncHandler } = require('../../middleware/errors');
const { validateEnum } = require('../../lib/validators');

const router = express.Router();

// Registers the identical GET-all + PATCH-status pair shared by free-trials,
// scholarships, and revert-applications — differing only in table name,
// allowed status enum, and response key.
function createStatusResource(router, { path, table, validStatuses, listKey, itemKey }) {
  // GET /admin/<path>
  router.get(`/${path}`, asyncHandler(async (req, res) => {
    const result = await pool.query(`SELECT * FROM ${table} ORDER BY created_at DESC`);
    res.json({ [listKey]: result.rows });
  }));

  // PATCH /admin/<path>/:id
  router.patch(`/${path}/:id`, asyncHandler(async (req, res) => {
    const { status } = req.body;
    const statusError = validateEnum(status, validStatuses);
    if (statusError) return res.status(400).json({ error: statusError });

    const result = await pool.query(
      `UPDATE ${table} SET status = $1 WHERE id = $2 RETURNING *`,
      [status, req.params.id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Not found' });
    res.json({ [itemKey]: result.rows[0] });
  }));
}

createStatusResource(router, {
  path: 'free-trials',
  table: 'free_trials',
  validStatuses: ['pending', 'contacted', 'converted'],
  listKey: 'free_trials',
  itemKey: 'free_trial',
});

createStatusResource(router, {
  path: 'scholarships',
  table: 'scholarship_applications',
  validStatuses: ['pending', 'approved', 'rejected'],
  listKey: 'scholarships',
  itemKey: 'scholarship',
});

createStatusResource(router, {
  path: 'revert-applications',
  table: 'revert_applications',
  validStatuses: ['new', 'contacted', 'enrolled', 'archived'],
  listKey: 'applications',
  itemKey: 'application',
});

module.exports = router;
