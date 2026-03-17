const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL && process.env.DATABASE_URL.includes('railway.internal')
    ? false
    : process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

const initDB = async () => {
  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY, username VARCHAR(100) UNIQUE NOT NULL, password VARCHAR(255) NOT NULL,
        role VARCHAR(20) NOT NULL DEFAULT 'vessel', vessel_id INTEGER, display_name VARCHAR(200),
        created_at TIMESTAMP DEFAULT NOW(), active BOOLEAN DEFAULT true
      );
      CREATE TABLE IF NOT EXISTS vessels (
        id SERIAL PRIMARY KEY, name VARCHAR(200) NOT NULL, imo VARCHAR(20), vessel_type VARCHAR(50),
        created_at TIMESTAMP DEFAULT NOW(), active BOOLEAN DEFAULT true
      );
      CREATE TABLE IF NOT EXISTS cost_groups (
        id SERIAL PRIMARY KEY, name VARCHAR(200) NOT NULL UNIQUE, sort_order INTEGER DEFAULT 0
      );
      CREATE TABLE IF NOT EXISTS cost_elements (
        id SERIAL PRIMARY KEY, cost_group_id INTEGER REFERENCES cost_groups(id) ON DELETE CASCADE,
        code VARCHAR(20), name VARCHAR(200) NOT NULL, sort_order INTEGER DEFAULT 0
      );
      CREATE TABLE IF NOT EXISTS budget_categories (
        id SERIAL PRIMARY KEY, vessel_id INTEGER REFERENCES vessels(id) ON DELETE CASCADE,
        cost_group VARCHAR(100), sub_category VARCHAR(100), annual_budget DECIMAL(12,2) DEFAULT 0,
        year INTEGER NOT NULL, UNIQUE(vessel_id, sub_category, year)
      );
      CREATE TABLE IF NOT EXISTS indents (
        id SERIAL PRIMARY KEY, vessel_id INTEGER REFERENCES vessels(id) ON DELETE CASCADE,
        indent_number VARCHAR(20) NOT NULL, title VARCHAR(500) NOT NULL,
        cost_group VARCHAR(100), sub_category VARCHAR(100), cost_element_code VARCHAR(20),
        source VARCHAR(20) DEFAULT 'HO', status VARCHAR(30) DEFAULT 'Estimate',
        cost_usd DECIMAL(12,2) DEFAULT 0, cost_local DECIMAL(12,2) DEFAULT 0,
        cost_marked_up DECIMAL(12,2) DEFAULT 0, location VARCHAR(100), notes TEXT,
        is_carried_forward BOOLEAN DEFAULT false, carried_forward_year INTEGER,
        created_at TIMESTAMP DEFAULT NOW(), updated_at TIMESTAMP DEFAULT NOW()
      );
      ALTER TABLE users DROP CONSTRAINT IF EXISTS users_vessel_id_fkey;
      DO $$ BEGIN
        ALTER TABLE users ADD CONSTRAINT users_vessel_id_fkey FOREIGN KEY (vessel_id) REFERENCES vessels(id) ON DELETE SET NULL;
      EXCEPTION WHEN duplicate_object THEN NULL; END $$;

      -- Junction table for superintendent multi-vessel assignment
      CREATE TABLE IF NOT EXISTS user_vessels (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        vessel_id INTEGER REFERENCES vessels(id) ON DELETE CASCADE,
        UNIQUE(user_id, vessel_id)
      );

      -- Stored BPR comparison data
      CREATE TABLE IF NOT EXISTS bpr_uploads (
        id SERIAL PRIMARY KEY,
        vessel_id INTEGER REFERENCES vessels(id) ON DELETE CASCADE,
        uploaded_by INTEGER REFERENCES users(id),
        year INTEGER NOT NULL,
        month VARCHAR(20),
        filename VARCHAR(200),
        summary JSONB,
        comparison JSONB,
        bpr_rows INTEGER DEFAULT 0,
        uploaded_at TIMESTAMP DEFAULT NOW()
      );
    `);
    console.log('Database tables initialized');
  } finally { client.release(); }
};

module.exports = { pool, initDB };
