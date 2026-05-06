const router = require('express').Router();
const { pool } = require('../db');
const { requireAuth, requireRole } = require('../middleware/auth');

const ADMIN_WHATSAPP = '201067827621';

// GET /scholarships/applicants — admin/supervisor only
router.get('/applicants', requireAuth, requireRole('admin', 'supervisor'), async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT sa.id,
              sa.first_name || ' ' || sa.last_name AS name,
              sa.email, sa.created_at,
              COALESCE(json_agg(
                json_build_object(
                  'id', ss.id,
                  'sponsor_name', ss.sponsor_name,
                  'months_sponsored', ss.months_sponsored,
                  'payment_status', ss.payment_status,
                  'created_at', ss.created_at
                )
              ) FILTER (WHERE ss.id IS NOT NULL), '[]') as sponsors
       FROM scholarship_applications sa
       LEFT JOIN scholarship_sponsors ss ON ss.applicant_id = sa.id
       GROUP BY sa.id, sa.first_name, sa.last_name, sa.email, sa.created_at
       ORDER BY sa.created_at DESC`
    );
    res.json({ applicants: result.rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch applicants' });
  }
});

// POST /scholarships/sponsor — save sponsor record and return WhatsApp URL
router.post('/sponsor', async (req, res) => {
  const { sponsor_name, sponsor_email, applicant_id, months_sponsored, amount } = req.body;
  if (!sponsor_name || !applicant_id) return res.status(400).json({ error: 'sponsor_name and applicant_id required' });
  try {
    const result = await pool.query(
      `INSERT INTO scholarship_sponsors (sponsor_name, sponsor_email, applicant_id, months_sponsored, amount)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [sponsor_name, sponsor_email || null, applicant_id, parseInt(months_sponsored) || 1, amount ? parseFloat(amount) : null]
    );
    const applicantRes = await pool.query(
      `SELECT first_name || ' ' || last_name AS name FROM scholarship_applications WHERE id = $1`,
      [applicant_id]
    );
    const applicantName = applicantRes.rows[0]?.name ?? 'a student';
    const msg = encodeURIComponent(
      `Assalamu Alaikum! I would like to sponsor ${applicantName} for ${months_sponsored || 1} month(s). My name is ${sponsor_name}${sponsor_email ? ` (${sponsor_email})` : ''}. Please let me know the payment details. JazakAllah Khair.`
    );
    const whatsapp_url = `https://wa.me/${ADMIN_WHATSAPP}?text=${msg}`;
    res.status(201).json({ sponsor: result.rows[0], whatsapp_url });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to save sponsorship' });
  }
});

module.exports = router;
