const crypto = require('crypto');
const bcrypt = require('bcryptjs');

/**
 * Generates a cryptographically random temporary password.
 * ~13 URL-safe characters — no ambiguous characters (0/O, l/1).
 */
function generateTempPassword() {
  return crypto.randomBytes(10).toString('base64url');
}

/**
 * Hashes a plaintext password with bcrypt (cost factor 12).
 * @returns {Promise<string>} the bcrypt hash
 */
async function hashPassword(plain) {
  return bcrypt.hash(plain, 12);
}

module.exports = { generateTempPassword, hashPassword };
