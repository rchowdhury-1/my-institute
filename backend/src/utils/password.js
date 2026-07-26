const crypto = require('crypto');
const bcrypt = require('bcryptjs');

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
