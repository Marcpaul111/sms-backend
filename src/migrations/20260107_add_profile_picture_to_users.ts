import type { Pool } from 'pg';

export async function up(pool: Pool) {
  await pool.query(`
    ALTER TABLE users ADD COLUMN IF NOT EXISTS profile_picture TEXT;
  `);
}

export async function down(pool: Pool) {
  await pool.query(`
    ALTER TABLE users DROP COLUMN IF EXISTS profile_picture;
  `);
}
