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
 * Insert a notification for every admin and supervisor user in one query.
 */
async function notifyAdmins(type, title, message, link = null) {
  await pool.query(
    `INSERT INTO notifications (user_id, type, title, message, link)
     SELECT id, $1, $2, $3, $4 FROM users WHERE role IN ('admin', 'supervisor')`,
    [type, title, message, link]
  );
}

module.exports = { notify, notifyAdmins };
