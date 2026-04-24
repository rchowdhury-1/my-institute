const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

async function initDb() {
  const sql1 = fs.readFileSync(path.join(__dirname, '../migrations/001_init.sql'), 'utf8');
  await pool.query(sql1);
  const sql2 = fs.readFileSync(path.join(__dirname, '../migrations/002_phase2.sql'), 'utf8');
  await pool.query(sql2);
  const sql3 = fs.readFileSync(path.join(__dirname, '../migrations/003_phase2b.sql'), 'utf8');
  await pool.query(sql3);
  console.log('Database initialised');
}

module.exports = { pool, initDb };
