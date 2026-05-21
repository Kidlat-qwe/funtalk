import pkg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const { Pool } = pkg;

const isProduction = (process.env.NODE_ENV || 'development') === 'production';
const SLOW_QUERY_MS = Number(process.env.DB_SLOW_QUERY_MS || 500);

const dbHost = process.env.DB_HOST || 'localhost';
const isLocalDb =
  dbHost === 'localhost' ||
  dbHost === '127.0.0.1' ||
  dbHost === '::1';

/** Neon / RDS / most cloud Postgres require TLS (sslmode=require). Local dev usually does not. */
const useSsl =
  process.env.DB_SSL === 'false' || process.env.DB_SSL === '0'
    ? false
    : process.env.DB_SSL === 'true' ||
      process.env.DB_SSL === '1' ||
      !isLocalDb;

const sslConfig = useSsl
  ? {
      ssl: {
        rejectUnauthorized: process.env.DB_SSL_REJECT_UNAUTHORIZED !== 'false',
      },
    }
  : {};

// Database connection pool
const pool = new Pool({
  host: dbHost,
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || 'funtalk_db',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: Number(process.env.DB_CONNECTION_TIMEOUT_MS || 10_000),
  /** Neon pooler rejects `-c search_path=...` in startup options; set search_path in transactions where needed */
  ...sslConfig,
});

pool.on('connect', (client) => {
  client.query('SET search_path TO public, pg_catalog').catch((err) => {
    console.error('Failed to set search_path on new pool client:', err.message);
  });
  if (!isProduction) {
    console.log('✅ Database connected successfully');
  }
});

pool.on('error', (err) => {
  console.error('❌ Unexpected error on idle database client:', err.message);
});

const logQuery = (text, duration, rowCount, level = 'log') => {
  const preview = String(text || '').replace(/\s+/g, ' ').trim().slice(0, 120);
  const msg = `DB ${level === 'error' ? 'error' : 'slow query'} (${duration}ms, rows=${rowCount ?? 'n/a'}): ${preview}`;
  if (level === 'error') {
    console.error(msg);
  } else {
    console.warn(msg);
  }
};

// Query helper function
export const query = async (text, params) => {
  const start = Date.now();
  try {
    const res = await pool.query(text, params);
    const duration = Date.now() - start;
    if (!isProduction) {
      console.log('Executed query', { text, duration, rows: res.rowCount });
    } else if (duration >= SLOW_QUERY_MS) {
      logQuery(text, duration, res.rowCount, 'slow');
    }
    return res;
  } catch (error) {
    const duration = Date.now() - start;
    logQuery(text, duration, null, 'error');
    throw error;
  }
};

// Get a client from the pool for transactions
export const getClient = async () => {
  const client = await pool.connect();
  const queryFn = client.query.bind(client);
  const release = client.release.bind(client);

  const timeout = setTimeout(() => {
    console.error('A client has been checked out for more than 5 seconds!');
    console.error(`The last executed query on this client was: ${client.lastQuery}`);
  }, 5000);

  client.query = (...args) => {
    client.lastQuery = args;
    return queryFn(...args);
  };

  client.release = () => {
    clearTimeout(timeout);
    client.query = queryFn;
    client.release = release;
    return release();
  };

  return client;
};

export default pool;
