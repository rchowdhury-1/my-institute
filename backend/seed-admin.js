require('dotenv').config();
const { Pool } = require('pg');
const bcrypt = require('bcrypt');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

async function seedAdmin() {
  const email = 'razwanul712@gmail.com';
  const password = 'changeme123';
  const display_name = 'Admin';
  const role = 'admin';

  try {
    const existing = await pool.query('SELECT id FROM users WHERE email = $1', [email]);
    if (existing.rowCount > 0) {
      console.log('Admin user already exists — skipping.');
      return;
    }

    const password_hash = await bcrypt.hash(password, 12);
    const result = await pool.query(
      `INSERT INTO users (email, password_hash, display_name, role)
       VALUES ($1, $2, $3, $4) RETURNING id, email, display_name, role`,
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
