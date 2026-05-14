const router = require('express').Router();
const { pool } = require('../db');

// POST /scholarship-apply — public, always-on (not feature-flagged)
router.post('/', async (req, res) => {
  const { fullName, email, phone, country, age, story, source } = req.body;

  if (!fullName || !email || !phone) {
    return res.status(400).json({ error: 'fullName, email, and phone are required' });
  }

  // Split full name into first/last for DB compatibility
  const parts = fullName.trim().split(/\s+/);
  const firstName = parts[0];
  const lastName = parts.slice(1).join(' ') || '';

  try {
    const result = await pool.query(
      `INSERT INTO scholarship_applications
         (first_name, last_name, email, phone, country, age, referral_source, about)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING id, created_at`,
      [firstName, lastName, email, phone, country || null, age ? parseInt(age) : null, source || null, story || '']
    );

    res.status(201).json({ success: true, application: result.rows[0] });
  } catch (err) {
    console.error('[scholarship-apply]', err);
    res.status(500).json({ error: 'Failed to save application' });
  }
});

module.exports = router;
