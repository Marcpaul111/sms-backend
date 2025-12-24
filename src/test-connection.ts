import dotenv from 'dotenv';
import pool from './config/db.ts';

dotenv.config();

const connectionString = process.env.DATABASE_URL;

console.log('Connecting to:', connectionString?.substring(0, 50) + '...');

try {
  const client = await pool.connect();
  const result = await client.query('SELECT NOW() as current_time');
  console.log('✓ Connection successful!');
  console.log('Server time:', result.rows[0]);
  client.release();
  await pool.end();
  process.exit(0);
} catch (error) {
  console.error('✗ Connection failed:', error);
  await pool.end();
  process.exit(1);
}