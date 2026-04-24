const router = require('express').Router();
const { pool } = require('../db');
const { requireAuth, requireRole } = require('../middleware/auth');

const VALID_TYPES = ['advertisements', 'islam_info', 'honor_list', 'quotes'];

// GET /cms/admin/:sectionType — admin, all items including inactive
// Must be before /:sectionType to take precedence
router.get('/admin/:sectionType', requireAuth, requireRole('admin', 'supervisor'), async (req, res) => {
  if (!VALID_TYPES.includes(req.params.sectionType)) {
    return res.status(400).json({ error: 'Invalid section type' });
  }
  try {
    const result = await pool.query(
      `SELECT * FROM cms_sections WHERE section_type = $1 ORDER BY position ASC, created_at ASC`,
      [req.params.sectionType]
    );
    res.json({ items: result.rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch CMS items' });
  }
});

// GET /cms/:sectionType — public, active items only
router.get('/:sectionType', async (req, res) => {
  if (!VALID_TYPES.includes(req.params.sectionType)) {
    return res.status(400).json({ error: 'Invalid section type' });
  }
  try {
    const result = await pool.query(
      `SELECT * FROM cms_sections WHERE section_type = $1 AND is_active = true ORDER BY position ASC, created_at ASC`,
      [req.params.sectionType]
    );
    res.json({ items: result.rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch CMS items' });
  }
});

// POST /cms — admin adds item
router.post('/', requireAuth, requireRole('admin', 'supervisor'), async (req, res) => {
  const { section_type, title, content, image_url, position } = req.body;
  if (!VALID_TYPES.includes(section_type)) return res.status(400).json({ error: 'Invalid section type' });
  try {
    const result = await pool.query(
      `INSERT INTO cms_sections (section_type, title, content, image_url, position)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [section_type, title || null, content || null, image_url || null, parseInt(position) || 0]
    );
    res.status(201).json({ item: result.rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to create CMS item' });
  }
});

// PATCH /cms/:id — admin edits item
router.patch('/:id', requireAuth, requireRole('admin', 'supervisor'), async (req, res) => {
  const { title, content, image_url, position, is_active } = req.body;
  try {
    const result = await pool.query(
      `UPDATE cms_sections
       SET title      = CASE WHEN $1::text IS NOT NULL THEN $1 ELSE title END,
           content    = CASE WHEN $2::text IS NOT NULL THEN $2 ELSE content END,
           image_url  = CASE WHEN $3::text IS NOT NULL THEN $3 ELSE image_url END,
           position   = CASE WHEN $4::int IS NOT NULL THEN $4 ELSE position END,
           is_active  = CASE WHEN $5::boolean IS NOT NULL THEN $5 ELSE is_active END,
           updated_at = NOW()
       WHERE id = $6 RETURNING *`,
      [title ?? null, content ?? null, image_url ?? null, position != null ? parseInt(position) : null, is_active ?? null, req.params.id]
    );
    if (result.rowCount === 0) return res.status(404).json({ error: 'Item not found' });
    res.json({ item: result.rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to update CMS item' });
  }
});

// DELETE /cms/:id — admin
router.delete('/:id', requireAuth, requireRole('admin', 'supervisor'), async (req, res) => {
  try {
    await pool.query(`DELETE FROM cms_sections WHERE id = $1`, [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to delete CMS item' });
  }
});

module.exports = router;
