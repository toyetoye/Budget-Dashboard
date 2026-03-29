// server/migrate-indent-lines.js
// Run once: railway run node server/migrate-indent-lines.js
// Or locally: node server/migrate-indent-lines.js

const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false });

async function migrate() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 1. Create indent_lines table
    await client.query(`
      CREATE TABLE IF NOT EXISTS indent_lines (
        id SERIAL PRIMARY KEY,
        indent_id INTEGER NOT NULL REFERENCES indents(id) ON DELETE CASCADE,
        line_number INTEGER NOT NULL DEFAULT 1,
        cost_group VARCHAR(255),
        sub_category VARCHAR(255),
        cost_element_code VARCHAR(100),
        description TEXT,
        cost_usd NUMERIC(14,2) DEFAULT 0,
        cost_local NUMERIC(14,2) DEFAULT 0,
        cost_marked_up NUMERIC(14,2) DEFAULT 0,
        created_at TIMESTAMP DEFAULT NOW()
      );
    `);

    // 2. Create index for fast lookups
    await client.query(`CREATE INDEX IF NOT EXISTS idx_indent_lines_indent_id ON indent_lines(indent_id);`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_indent_lines_sub_category ON indent_lines(sub_category);`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_indent_lines_cost_group ON indent_lines(cost_group);`);

    // 3. Migrate existing indent data into indent_lines (one line per existing indent)
    const existing = await client.query(`
      SELECT id, cost_group, sub_category, cost_element_code, cost_usd, cost_local, cost_marked_up, title
      FROM indents WHERE id NOT IN (SELECT DISTINCT indent_id FROM indent_lines)
    `);

    console.log(`Migrating ${existing.rows.length} existing indents to indent_lines...`);

    for (const row of existing.rows) {
      await client.query(`
        INSERT INTO indent_lines (indent_id, line_number, cost_group, sub_category, cost_element_code, description, cost_usd, cost_local, cost_marked_up)
        VALUES ($1, 1, $2, $3, $4, $5, $6, $7, $8)
      `, [row.id, row.cost_group, row.sub_category, row.cost_element_code, row.title || '', row.cost_usd || 0, row.cost_local || 0, row.cost_marked_up || 0]);
    }

    // 4. Add total columns to indents table for fast aggregation (denormalized)
    const cols = await client.query(`SELECT column_name FROM information_schema.columns WHERE table_name='indents' AND column_name='total_usd'`);
    if (cols.rows.length === 0) {
      await client.query(`ALTER TABLE indents ADD COLUMN total_usd NUMERIC(14,2) DEFAULT 0;`);
      await client.query(`ALTER TABLE indents ADD COLUMN total_local NUMERIC(14,2) DEFAULT 0;`);
      await client.query(`ALTER TABLE indents ADD COLUMN line_count INTEGER DEFAULT 1;`);
    }

    // 5. Update totals from migrated lines
    await client.query(`
      UPDATE indents SET
        total_usd = COALESCE((SELECT SUM(cost_usd) FROM indent_lines WHERE indent_id = indents.id), 0),
        total_local = COALESCE((SELECT SUM(cost_local) FROM indent_lines WHERE indent_id = indents.id), 0),
        line_count = COALESCE((SELECT COUNT(*) FROM indent_lines WHERE indent_id = indents.id), 0)
    `);

    await client.query('COMMIT');
    console.log('Migration complete.');
    console.log(`  - indent_lines table created`);
    console.log(`  - ${existing.rows.length} existing indents migrated`);
    console.log(`  - total_usd, total_local, line_count columns added to indents`);

  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Migration failed:', err);
    throw err;
  } finally {
    client.release();
    pool.end();
  }
}

migrate().catch(e => { console.error(e); process.exit(1); });
