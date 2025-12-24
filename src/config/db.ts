import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error('DATABASE_URL environment variable is not set');
}

const pool = new pg.Pool({
  connectionString,
  ssl: { rejectUnauthorized: false }
});

export const connectDB = async (): Promise<void> => {
  try {
    const client = await pool.connect();
    const result = await client.query('SELECT NOW()');
    console.log('✓ Connected to PostgreSQL');
    client.release();
  } catch (error) {
    console.error('✗ Database connection error:', error);
    process.exit(1);
  }
};

export const disconnectDB = async (): Promise<void> => {
  try {
    await pool.end();
    console.log('✓ Disconnected from PostgreSQL');
  } catch (error) {
    console.error('✗ Database disconnection error:', error);
    process.exit(1);
  }
};

export default pool;