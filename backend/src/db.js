const { Pool, types } = require('pg');
const fs = require('fs');
const path = require('path');

// NUMERIC columns (hours balances, rates, amounts) arrive as strings by
// default; parse to number so comparisons and JSON payloads keep their type.
types.setTypeParser(types.builtins.NUMERIC, (v) => (v === null ? null : parseFloat(v)));

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

// Migrations that were applied before the tracking table existed.
// These are seeded into migrations_applied on first run so they aren't re-run.
const LEGACY_MIGRATIONS = [
  '001_init.sql',
  '002_phase2.sql',
  '003_phase2b.sql',
  '004_zoom_and_indexes.sql',
  '005_user_profiles.sql',
  '006_scholarship_fields.sql',
  '007_newsfeed.sql',
  '008_revert_applications.sql',
];

async function initDb() {
  // 1. Create tracking table if it doesn't exist
  await pool.query(`
    CREATE TABLE IF NOT EXISTS migrations_applied (
      filename TEXT PRIMARY KEY,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);

  // 2. Seed legacy migrations so they are never re-run
  const { rows: existing } = await pool.query('SELECT filename FROM migrations_applied');
  const applied = new Set(existing.map(r => r.filename));

  if (applied.size === 0 && LEGACY_MIGRATIONS.length > 0) {
    const values = LEGACY_MIGRATIONS.map((f, i) => `($${i + 1}, now())`).join(', ');
    await pool.query(
      `INSERT INTO migrations_applied (filename, applied_at) VALUES ${values} ON CONFLICT DO NOTHING`,
      LEGACY_MIGRATIONS
    );
    for (const f of LEGACY_MIGRATIONS) applied.add(f);
    console.log(`Seeded ${LEGACY_MIGRATIONS.length} legacy migrations into tracking table`);
  }

  // 3. Discover all .sql files, sorted by name
  const migrationsDir = path.join(__dirname, '../migrations');
  const files = fs.readdirSync(migrationsDir)
    .filter(f => f.endsWith('.sql'))
    .sort();

  // 4. Run any that haven't been applied yet
  let newCount = 0;
  for (const file of files) {
    if (applied.has(file)) continue;

    const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf8');
    await pool.query(sql);
    await pool.query(
      'INSERT INTO migrations_applied (filename) VALUES ($1) ON CONFLICT DO NOTHING',
      [file]
    );
    console.log(`Applied migration: ${file}`);
    newCount++;
  }

  if (newCount === 0) {
    console.log('Database initialised — all migrations already applied');
  } else {
    console.log(`Database initialised — applied ${newCount} new migration(s)`);
  }
}

module.exports = { pool, initDb };
