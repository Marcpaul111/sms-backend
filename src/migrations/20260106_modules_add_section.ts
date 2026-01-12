import pool from '../config/db.ts';

export async function up() {
  const client = await pool.connect();
  try {
    await client.query(`
      ALTER TABLE modules
      ADD COLUMN IF NOT EXISTS section_id UUID REFERENCES sections(id) ON DELETE SET NULL
    `);
    console.log('✓ section_id column added to modules table');
  } finally {
    client.release();
  }
}

export async function down() {
  const client = await pool.connect();
  try {
    await client.query(`
      ALTER TABLE modules
      DROP COLUMN IF EXISTS section_id
    `);
    console.log('✓ section_id column dropped from modules table');
  } finally {
    client.release();
  }
}

await up();
