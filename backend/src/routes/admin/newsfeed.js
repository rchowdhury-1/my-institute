const express = require('express');
const { pool } = require('../../db');
const { asyncHandler } = require('../../middleware/errors');
const { validateEnum } = require('../../lib/validators');

const router = express.Router();

// ─── Newsfeed ───────────────────────────────────────────────────────────────

// GET /admin/newsfeed — all posts, newest first, paginated
router.get('/newsfeed', asyncHandler(async (req, res) => {
  const page = Math.max(1, parseInt(req.query.page) || 1);
  const limit = 20;
  const offset = (page - 1) * limit;

  const countResult = await pool.query('SELECT COUNT(*) FROM newsfeed_posts');
  const total = parseInt(countResult.rows[0].count);

  const result = await pool.query(
    `SELECT * FROM newsfeed_posts ORDER BY published_at DESC LIMIT $1 OFFSET $2`,
    [limit, offset]
  );

  res.json({
    posts: result.rows,
    page,
    totalPages: Math.ceil(total / limit),
    total,
  });
}));

// POST /admin/newsfeed — create post
router.post('/newsfeed', asyncHandler(async (req, res) => {
  const { type, title, body, image_url, show_on_homepage = false } = req.body;

  if (!type)
    return res.status(400).json({ error: 'type is required' });
  if (!title?.trim() && !body?.trim() && !image_url)
    return res.status(400).json({ error: 'Post needs a title, body, or image' });

  const typeError = validateEnum(type, ['quote', 'honour_list', 'general'], 'type must be quote, honour_list, or general');
  if (typeError) return res.status(400).json({ error: typeError });

  const result = await pool.query(
    `INSERT INTO newsfeed_posts (type, title, body, image_url, show_on_homepage, created_by)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING *`,
    [type, title?.trim() || null, body?.trim() || null, image_url || null, show_on_homepage, req.userId]
  );
  res.status(201).json({ post: result.rows[0] });
}));

// PATCH /admin/newsfeed/:id — update post
router.patch('/newsfeed/:id', asyncHandler(async (req, res) => {
  const { type, title, body, image_url, show_on_homepage } = req.body;

  if (type) {
    const typeError = validateEnum(type, ['quote', 'honour_list', 'general'], 'type must be quote, honour_list, or general');
    if (typeError) return res.status(400).json({ error: typeError });
  }

  const result = await pool.query(
    `UPDATE newsfeed_posts
     SET type             = COALESCE($1, type),
         title            = COALESCE($2, title),
         body             = COALESCE($3, body),
         image_url        = COALESCE($4, image_url),
         show_on_homepage = COALESCE($5, show_on_homepage),
         updated_at       = NOW()
     WHERE id = $6
     RETURNING *`,
    [
      type || null,
      title?.trim() || null,
      body?.trim() || null,
      image_url !== undefined ? (image_url || null) : null,
      show_on_homepage != null ? show_on_homepage : null,
      req.params.id,
    ]
  );
  if (result.rows.length === 0)
    return res.status(404).json({ error: 'Post not found' });
  res.json({ post: result.rows[0] });
}));

// DELETE /admin/newsfeed/:id — hard delete
router.delete('/newsfeed/:id', asyncHandler(async (req, res) => {
  const result = await pool.query(
    'DELETE FROM newsfeed_posts WHERE id = $1 RETURNING id',
    [req.params.id]
  );
  if (result.rows.length === 0)
    return res.status(404).json({ error: 'Post not found' });
  res.json({ deleted: true });
}));

module.exports = router;
