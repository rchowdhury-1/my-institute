const { pool } = require('../db');
const { v4: uuidv4 } = require('uuid');

/**
 * Insert a notification for a single user. Best-effort: a notify() failure
 * must never turn an already-committed write into a client-visible 500 (the
 * ~30 call sites across routes/ and services/ all rely on this — swallowing
 * here once is safer than trusting every call site to wrap itself, which is
 * exactly the inconsistency this replaced: services/reschedule.js had its
 * own local safeNotify() wrapper, but most other routes called notify()
 * unguarded).
 */
async function notify(userId, type, title, message, link = null) {
  try {
    await pool.query(
      'INSERT INTO notifications (id, user_id, type, title, message, link) VALUES ($1,$2,$3,$4,$5,$6)',
      [uuidv4(), userId, type, title, message, link]
    );
  } catch (err) {
    console.error(`[notify] failed (user ${userId}, type ${type})`, err);
  }
}

/**
 * Insert a notification for every admin and supervisor user in one query.
 * Same best-effort guarantee as notify() above.
 */
async function notifyAdmins(type, title, message, link = null) {
  try {
    await pool.query(
      `INSERT INTO notifications (user_id, type, title, message, link)
       SELECT id, $1, $2, $3, $4 FROM users WHERE role IN ('admin', 'supervisor')`,
      [type, title, message, link]
    );
  } catch (err) {
    console.error(`[notify] notifyAdmins failed (type ${type})`, err);
  }
}

module.exports = { notify, notifyAdmins };
