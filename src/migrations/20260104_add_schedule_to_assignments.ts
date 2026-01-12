import pool from '../config/db.ts';

export async function up() {
  const client = await pool.connect();
  try {
    await client.query(`
      ALTER TABLE teacher_assignments
      ADD COLUMN IF NOT EXISTS schedule VARCHAR(255)
    `);
    console.log('✓ Schedule column added to teacher_assignments table');
  } finally {
    client.release();
  }
}

export async function down() {
  const client = await pool.connect();
  try {
    await client.query(`
      ALTER TABLE teacher_assignments
      DROP COLUMN IF EXISTS schedule
    `);
    console.log('✓ Schedule column removed from teacher_assignments table');
  } finally {
    client.release();
  }
}

// Run migration
await up();