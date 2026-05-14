const router = require('express').Router();
const { pool } = require('../db');

// POST /revert-apply — public, always-on
router.post('/', async (req, res) => {
  const { name, email, phone, country, story } = req.body;

  if (!name || !email || !phone) {
    return res.status(400).json({ error: 'name, email, and phone are required' });
  }

  try {
    const result = await pool.query(
      `INSERT INTO revert_applications (name, email, phone, country, story)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, created_at`,
      [name.trim(), email.trim(), phone.trim(), country || null, story || null]
    );

    res.status(201).json({ success: true, application: result.rows[0] });
  } catch (err) {
    console.error('[revert-apply]', err);
    res.status(500).json({ error: 'Failed to save application' });
  }
});

module.exports = router;
