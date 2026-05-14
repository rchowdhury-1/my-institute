const router = require('express').Router();
const { pool } = require('../db');

// GET /newsfeed — public, all posts newest first, paginated
router.get('/', async (req, res) => {
  const page = Math.max(1, parseInt(req.query.page) || 1);
  const limit = 20;
  const offset = (page - 1) * limit;

  try {
    const countResult = await pool.query('SELECT COUNT(*) FROM newsfeed_posts');
    const total = parseInt(countResult.rows[0].count);

    const result = await pool.query(
      `SELECT id, type, title, body, image_url, show_on_homepage, published_at
       FROM newsfeed_posts
       ORDER BY published_at DESC
       LIMIT $1 OFFSET $2`,
      [limit, offset]
    );

    res.json({
      posts: result.rows,
      page,
      totalPages: Math.ceil(total / limit),
      total,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch posts' });
  }
});

// GET /newsfeed/homepage — public, homepage-flagged posts, limit 3
router.get('/homepage', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT id, type, title, body, image_url, published_at
       FROM newsfeed_posts
       WHERE show_on_homepage = true
       ORDER BY published_at DESC
       LIMIT 3`
    );
    res.json({ posts: result.rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch homepage posts' });
  }
});

module.exports = router;
