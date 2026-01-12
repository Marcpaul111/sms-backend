import pool from '../config/db.ts';

export async function up() {
  const client = await pool.connect();
  try {
    await client.query(`
      ALTER TABLE assignments
      ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'active'
    `);
    console.log('✓ status column added to assignments table');
  } finally {
    client.release();
  }
}

export async function down() {
  const client = await pool.connect();
  try {
    await client.query(`
      ALTER TABLE assignments
      DROP COLUMN IF EXISTS status
    `);
    console.log('✓ status column dropped from assignments table');
  } finally {
    client.release();
  }
}

await up();