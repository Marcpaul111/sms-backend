import pool from '../config/db.ts';

export async function up() {
  const client = await pool.connect();
  try {
    await client.query(`
      ALTER TABLE users
      ADD COLUMN IF NOT EXISTS session_version VARCHAR(255)
    `);
    console.log('✓ Added session_version to users');
  } finally {
    client.release();
    await pool.end();
  }
}

export async function down() {
  const client = await pool.connect();
  try {
    await client.query(`
      ALTER TABLE users
      DROP COLUMN IF EXISTS session_version
    `);
    console.log('✓ Removed session_version from users');
  } finally {
    client.release();
    await pool.end();
  }
}

await up();

