import pool from '../config/db.ts';

export async function up() {
  const client = await pool.connect();
  try {
    await client.query(`
      ALTER TABLE assignments
      ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    `);
    console.log('✓ updated_at column added to assignments table');
  } finally {
    client.release();
  }
}

export async function down() {
  const client = await pool.connect();
  try {
    await client.query(`
      ALTER TABLE assignments
      DROP COLUMN IF EXISTS updated_at
    `);
    console.log('✓ updated_at column dropped from assignments table');
  } finally {
    client.release();
  }
}

await up();