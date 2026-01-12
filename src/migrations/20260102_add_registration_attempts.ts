import pool from '../config/db.ts';

export async function up() {
  const client = await pool.connect();
  try {
    await client.query(`
      ALTER TABLE users
      ADD COLUMN IF NOT EXISTS registration_attempts INTEGER DEFAULT 0
    `);
    console.log('✓ Added registration_attempts to users table');
  } finally {
    client.release();
  }
}

export async function down() {
  const client = await pool.connect();
  try {
    await client.query(`
      ALTER TABLE users
      DROP COLUMN IF EXISTS registration_attempts
    `);
    console.log('✓ Removed registration_attempts from users table');
  } finally {
    client.release();
  }
}

await up();