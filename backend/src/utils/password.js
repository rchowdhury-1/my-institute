const crypto = require('crypto');
// Native bcrypt, not bcryptjs: hashing runs on libuv's thread pool instead of
// blocking the main event loop. The pure-JS implementation cost ~2.5s of
// main-thread CPU per login on Render's free tier, so concurrent logins
// serialised into a multi-minute queue (2026-10-15 login outage).
const bcrypt = require('bcrypt');

const TEMP_PASSWORD_BYTES = 10; // ~13 URL-safe characters once base64url-encoded
const BCRYPT_COST = 12;

/**
 * Generates a cryptographically random temporary password.
 * No ambiguous characters (0/O, l/1) — base64url encoding avoids them.
 */
function generateTempPassword() {
  return crypto.randomBytes(TEMP_PASSWORD_BYTES).toString('base64url');
}

/**
 * Hashes a plaintext password with bcrypt.
 * @returns {Promise<string>} the bcrypt hash
 */
async function hashPassword(plain) {
  return bcrypt.hash(plain, BCRYPT_COST);
}

module.exports = { generateTempPassword, hashPassword };
