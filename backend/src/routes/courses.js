const router = require('express').Router();
const { pool } = require('../db');
const { requireAuth, requireRole } = require('../middleware/auth');

const ADMIN_WHATSAPP = '201067827621';

// GET /courses — public
router.get('/', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT c.*,
              (SELECT COUNT(*) FROM course_lessons WHERE course_id = c.id) as lesson_count
       FROM recorded_courses c
       ORDER BY c.created_at DESC`
    );
    res.json({ courses: result.rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch courses' });
  }
});

// GET /courses/:id — course with lessons
router.get('/:id', async (req, res) => {
  try {
    const courseRes = await pool.query(`SELECT * FROM recorded_courses WHERE id = $1`, [req.params.id]);
    if (courseRes.rowCount === 0) return res.status(404).json({ error: 'Course not found' });
    const lessonsRes = await pool.query(
      `SELECT * FROM course_lessons WHERE course_id = $1 ORDER BY position, created_at`,
      [req.params.id]
    );
    res.json({ course: courseRes.rows[0], lessons: lessonsRes.rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch course' });
  }
});

// POST /courses — admin creates course
router.post('/', requireAuth, requireRole('admin', 'supervisor'), async (req, res) => {
  const { title, description, price, is_free, thumbnail_url } = req.body;
  if (!title) return res.status(400).json({ error: 'title required' });
  try {
    const result = await pool.query(
      `INSERT INTO recorded_courses (title, description, price, is_free, thumbnail_url)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [title, description || null, parseFloat(price) || 0, !!is_free, thumbnail_url || null]
    );
    res.status(201).json({ course: result.rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to create course' });
  }
});

// PATCH /courses/:id — admin edits course
router.patch('/:id', requireAuth, requireRole('admin', 'supervisor'), async (req, res) => {
  const { title, description, price, is_free, thumbnail_url } = req.body;
  try {
    const result = await pool.query(
      `UPDATE recorded_courses
       SET title = COALESCE($1, title),
           description = COALESCE($2, description),
           price = COALESCE($3, price),
           is_free = COALESCE($4, is_free),
           thumbnail_url = COALESCE($5, thumbnail_url)
       WHERE id = $6 RETURNING *`,
      [title, description, price != null ? parseFloat(price) : null, is_free, thumbnail_url, req.params.id]
    );
    if (result.rowCount === 0) return res.status(404).json({ error: 'Course not found' });
    res.json({ course: result.rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to update course' });
  }
});

// DELETE /courses/:id — admin
router.delete('/:id', requireAuth, requireRole('admin', 'supervisor'), async (req, res) => {
  try {
    await pool.query(`DELETE FROM recorded_courses WHERE id = $1`, [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to delete course' });
  }
});

// POST /courses/:id/enroll — user enrolls
router.post('/:id/enroll', requireAuth, async (req, res) => {
  try {
    const courseRes = await pool.query(`SELECT * FROM recorded_courses WHERE id = $1`, [req.params.id]);
    if (courseRes.rowCount === 0) return res.status(404).json({ error: 'Course not found' });
    const course = courseRes.rows[0];

    if (!course.is_free && parseFloat(course.price) > 0) {
      const msg = encodeURIComponent(
        `Assalamu Alaikum! I would like to enroll in "${course.title}" (£${course.price}). Please let me know the payment details.`
      );
      return res.status(402).json({
        error: 'Payment required',
        whatsapp_url: `https://wa.me/${ADMIN_WHATSAPP}?text=${msg}`,
      });
    }

    const result = await pool.query(
      `INSERT INTO course_enrollments (course_id, user_id)
       VALUES ($1, $2)
       ON CONFLICT (course_id, user_id) DO NOTHING
       RETURNING *`,
      [req.params.id, req.user.id]
    );
    res.status(201).json({ enrollment: result.rows[0] ?? { already_enrolled: true } });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to enroll' });
  }
});

// POST /courses/:id/lessons — admin adds lesson
router.post('/:id/lessons', requireAuth, requireRole('admin', 'supervisor'), async (req, res) => {
  const { title, video_url, duration_minutes, position } = req.body;
  if (!title) return res.status(400).json({ error: 'title required' });
  try {
    const result = await pool.query(
      `INSERT INTO course_lessons (course_id, title, video_url, duration_minutes, position)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [req.params.id, title, video_url || null, duration_minutes || null, position ?? 0]
    );
    res.status(201).json({ lesson: result.rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to add lesson' });
  }
});

// DELETE /courses/:courseId/lessons/:lessonId — admin
router.delete('/:courseId/lessons/:lessonId', requireAuth, requireRole('admin', 'supervisor'), async (req, res) => {
  try {
    await pool.query(`DELETE FROM course_lessons WHERE id = $1 AND course_id = $2`, [req.params.lessonId, req.params.courseId]);
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to delete lesson' });
  }
});

module.exports = router;
