import pg from 'pg';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error('DATABASE_URL environment variable is not set');
}

let pool = new pg.Pool({
  connectionString,
  // ssl: {
  //   ca: fs.readFileSync(path.join(__dirname, '../../server-ca.pem')).toString()
  // }
    ssl: { rejectUnauthorized: false }
});

export const connectDB = async (): Promise<void> => {
  try {
    const client = await pool.connect();
    await client.query('SELECT NOW()');
    console.log('✓ Connected to PostgreSQL');
    client.release();
  } catch (error) {
    console.error('✗ Database connection error:', error);
    // Don't exit process, just log the error
    // The pool recreation logic will handle reconnection
  }
};

export const disconnectDB = async (): Promise<void> => {
  try {
    console.log('⚠️ disconnectDB called - this should only happen during server shutdown');
    console.trace('disconnectDB call stack:');
    await pool.end();
    console.log('✓ Disconnected from PostgreSQL');
  } catch (error) {
    console.error('✗ Database disconnection error:', error);
    process.exit(1);
  }
};

// Function to get a valid pool, recreating if necessary
const getValidPool = () => {
  if (pool.ended) {
    console.log('⚠️ Pool was ended, recreating...');
    pool = new pg.Pool({
      connectionString,
      ssl: { rejectUnauthorized: false }
    });
  }
  return pool;
};

// Export a getter that always returns a valid pool
export default new Proxy(getValidPool(), {
  get(target, prop) {
    const currentPool = getValidPool();
    return (currentPool as any)[prop];
  }
});