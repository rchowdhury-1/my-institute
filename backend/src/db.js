const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

async function initDb() {
  const migrationsDir = path.join(__dirname, '../migrations');
  const files = [
    '001_init.sql',
    '002_phase2.sql',
    '003_phase2b.sql',
    '004_zoom_and_indexes.sql',
  ];
  for (const file of files) {
    const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf8');
    await pool.query(sql);
  }
  console.log('Database initialised');
}

module.exports = { pool, initDb };
