const { pool } = require('../db');
const { v4: uuidv4 } = require('uuid');

/**
 * Insert a notification for a single user.
 */
async function notify(userId, type, title, message, link = null) {
  await pool.query(
    'INSERT INTO notifications (id, user_id, type, title, message, link) VALUES ($1,$2,$3,$4,$5,$6)',
    [uuidv4(), userId, type, title, message, link]
  );
}

/**
 * Insert a notification for every admin and supervisor user.
 */
async function notifyAdmins(type, title, message, link = null) {
  const admins = await pool.query(
    `SELECT id FROM users WHERE role IN ('admin', 'supervisor')`
  );
  for (const row of admins.rows) {
    await notify(row.id, type, title, message, link);
  }
}

module.exports = { notify, notifyAdmins };
