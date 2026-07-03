require('dotenv').config();
const { Pool } = require('pg');
const bcrypt = require('bcryptjs');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

async function seedAdmin() {
  // Credentials come from the environment — never hardcode them.
  // Emergency recovery only: SEED_ADMIN_EMAIL=... SEED_ADMIN_PASSWORD=... node seed-admin.js
  const email = process.env.SEED_ADMIN_EMAIL;
  const password = process.env.SEED_ADMIN_PASSWORD;
  const display_name = 'Admin';
  const role = 'admin';

  if (!email || !password) {
    console.error('Refusing to seed: set SEED_ADMIN_EMAIL and SEED_ADMIN_PASSWORD env vars.');
    process.exitCode = 1;
    return;
  }
  if (password.length < 12) {
    console.error('Refusing to seed: SEED_ADMIN_PASSWORD must be at least 12 characters.');
    process.exitCode = 1;
    return;
  }

  try {
    const existing = await pool.query('SELECT id FROM users WHERE email = $1', [email]);
    if (existing.rowCount > 0) {
      console.log('Admin user already exists — skipping.');
      return;
    }

    const password_hash = await bcrypt.hash(password, 12);
    const result = await pool.query(
      `INSERT INTO users (email, password_hash, display_name, role, must_change_password)
       VALUES ($1, $2, $3, $4, true) RETURNING id, email, display_name, role`,
      [email, password_hash, display_name, role]
    );
    console.log('Admin user created:', result.rows[0]);
  } catch (err) {
    console.error('Error seeding admin:', err.message);
  } finally {
    await pool.end();
  }
}

seedAdmin();
