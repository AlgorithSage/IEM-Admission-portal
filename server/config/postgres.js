const { Pool } = require('pg');
const bcrypt = require('bcryptjs');

const pool = new Pool({
  host: process.env.PG_HOST || 'localhost',
  port: parseInt(process.env.PG_PORT || '5432', 10),
  user: process.env.PG_USER || 'postgres',
  password: process.env.PG_PASSWORD || 'ssql',
  database: process.env.PG_DATABASE || 'postgres',
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000
});

const initPostgres = async () => {
  let client;
  try {
    client = await pool.connect();
    console.log('[PostgreSQL] Connected successfully to host:', process.env.PG_HOST || 'localhost');

    // Enable pgcrypto for UUID generation
    await client.query(`CREATE EXTENSION IF NOT EXISTS "pgcrypto";`);

    // 1. Relational Users Table with Optimistic Row Versioning
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        first_name VARCHAR(100) NOT NULL,
        last_name VARCHAR(100) NOT NULL,
        email VARCHAR(150) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        phone VARCHAR(20) DEFAULT '',
        address TEXT DEFAULT '',
        role VARCHAR(20) CHECK (role IN ('applicant', 'admin')) DEFAULT 'applicant',
        row_version INT DEFAULT 1,
        created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // 2. Audit Trail Table for Historical Profile Versioning
    await client.query(`
      CREATE TABLE IF NOT EXISTS user_history (
        id SERIAL PRIMARY KEY,
        user_id UUID REFERENCES users(id) ON DELETE CASCADE,
        phone VARCHAR(20),
        address TEXT,
        row_version INT,
        changed_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
        change_reason TEXT DEFAULT 'Profile update'
      );
    `);

    // Indexes
    await client.query(`CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_user_history_user_id ON user_history(user_id);`);

    // 3. Seed Default Accounts into PostgreSQL if table is empty
    const adminCheck = await client.query(`SELECT id FROM users WHERE email = $1`, ['admin@iem.edu.in']);
    if (adminCheck.rows.length === 0) {
      const adminHash = await bcrypt.hash('adminpassword123', 10);
      await client.query(
        `INSERT INTO users (first_name, last_name, email, password_hash, phone, address, role, row_version)
         VALUES ($1, $2, $3, $4, $5, $6, $7, 1)`,
        ['Admission', 'Officer', 'admin@iem.edu.in', adminHash, '+91 98300 00001', 'IEM Campus, Salt Lake Sector V, Kolkata', 'admin']
      );
      console.log('[PostgreSQL Seed] Created Admin account in PostgreSQL: admin@iem.edu.in');
    }

    const applicantCheck = await client.query(`SELECT id FROM users WHERE email = $1`, ['aarav.sharma@gmail.com']);
    if (applicantCheck.rows.length === 0) {
      const applicantHash = await bcrypt.hash('password123', 10);
      await client.query(
        `INSERT INTO users (first_name, last_name, email, password_hash, phone, address, role, row_version)
         VALUES ($1, $2, $3, $4, $5, $6, $7, 1)`,
        ['Aarav', 'Sharma', 'aarav.sharma@gmail.com', applicantHash, '+91 98301 23456', 'Salt Lake Sector V, Kolkata, West Bengal - 700091', 'applicant']
      );
      console.log('[PostgreSQL Seed] Created Applicant account in PostgreSQL: aarav.sharma@gmail.com');
    }

    console.log('[PostgreSQL] Database tables & audit versioning schema initialized successfully.');
  } catch (error) {
    console.error('[PostgreSQL] Initialization error:', error.message);
  } finally {
    if (client) client.release();
  }
};

module.exports = {
  pool,
  query: (text, params) => pool.query(text, params),
  initPostgres
};
