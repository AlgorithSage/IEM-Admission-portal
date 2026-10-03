const { Pool } = require('pg');
const bcrypt = require('bcryptjs');

const isServerless = !!(process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME);

// TLS is configured explicitly (sslmode is stripped from the URL so pg does not reinterpret it) and the
// server certificate is verified. Set PG_SSL_REJECT_UNAUTHORIZED=false only for a self-signed dev server.
const buildPoolConfig = () => {
  const common = {
    // Each serverless instance holds its own pool: keep it small so instances do not exhaust the database
    max: Number(process.env.PG_POOL_MAX || (isServerless ? 3 : 10)),
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 5000
  };
  if (process.env.DATABASE_URL) {
    const url = new URL(process.env.DATABASE_URL);
    url.searchParams.delete('sslmode');
    return {
      ...common,
      connectionString: url.toString(),
      ssl: { rejectUnauthorized: process.env.PG_SSL_REJECT_UNAUTHORIZED !== 'false' }
    };
  }
  return {
    ...common,
    host: process.env.PG_HOST || 'localhost',
    port: parseInt(process.env.PG_PORT || '5432', 10),
    user: process.env.PG_USER || 'postgres',
    password: process.env.PG_PASSWORD || '',
    database: process.env.PG_DATABASE || 'postgres'
  };
};

const poolConfig = buildPoolConfig();

let isPostgresConnected = false;

const pool = new Pool(poolConfig);

const initPostgres = async () => {
  let client;
  try {
    client = await pool.connect();
    isPostgresConnected = true;
    const host = process.env.DATABASE_URL ? new URL(process.env.DATABASE_URL).hostname : process.env.PG_HOST || 'localhost';
    console.log('[PostgreSQL] Connected to', host);

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
    return true;
  } catch (error) {
    isPostgresConnected = false;
    console.error('[PostgreSQL] Initialization error:', error.message);
    return false;
  } finally {
    if (client) client.release();
  }
};

// Shared, lazily awaited initialisation. Requests that arrive during start-up (or a serverless
// cold start) wait for it instead of failing; after a failure, a new attempt is made once the
// cooldown has passed instead of staying disconnected until the process restarts.
const RETRY_COOLDOWN_MS = 10000;
let initPromise = null;
let lastFailureAt = 0;

const ensurePostgres = () => {
  if (initPromise) return initPromise;
  if (Date.now() - lastFailureAt < RETRY_COOLDOWN_MS) return Promise.resolve(false);
  initPromise = initPostgres().then((ok) => {
    if (!ok) {
      lastFailureAt = Date.now();
      initPromise = null;
    }
    return ok;
  });
  return initPromise;
};

module.exports = {
  pool,
  isPostgresReady: () => isPostgresConnected,
  query: async (text, params) => {
    if (!(await ensurePostgres())) {
      throw new Error('PostgreSQL database is currently unavailable.');
    }
    return pool.query(text, params);
  },
  initPostgres: ensurePostgres
};
