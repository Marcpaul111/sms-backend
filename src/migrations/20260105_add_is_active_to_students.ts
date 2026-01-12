import pool from '../config/db.ts';

export async function up() {
  const client = await pool.connect();
  try {
    await client.query(`
      ALTER TABLE students
      ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true
    `);
    console.log('✓ is_active column added to students table');
  } finally {
    client.release();
  }
}

export async function down() {
  const client = await pool.connect();
  try {
    await client.query(`
      ALTER TABLE students
      DROP COLUMN IF EXISTS is_active
    `);
    console.log('✓ is_active column removed from students table');
  } finally {
    client.release();
  }
}

// Run migration
await up();