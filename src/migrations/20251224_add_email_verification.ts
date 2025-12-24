import pool from '../config/db.ts';

export async function up() {
  const client = await pool.connect();
  try {
    // Add email verification fields
    await client.query(`
      ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verified BOOLEAN DEFAULT FALSE,
      ADD COLUMN IF NOT EXISTS email_verified_at TIMESTAMP,
      ADD COLUMN IF NOT EXISTS verification_token VARCHAR(255),
      ADD COLUMN IF NOT EXISTS verification_token_expires_at TIMESTAMP,
      ADD COLUMN IF NOT EXISTS otp VARCHAR(6),
      ADD COLUMN IF NOT EXISTS otp_expires_at TIMESTAMP,
      ADD COLUMN IF NOT EXISTS otp_attempts INT DEFAULT 0,
      ADD COLUMN IF NOT EXISTS password_reset_token VARCHAR(255),
      ADD COLUMN IF NOT EXISTS password_reset_expires_at TIMESTAMP
    `);

    console.log('✓ Auth fields added to users table');
  } finally {
    client.release();
    await pool.end();
  }
}

export async function down() {
  const client = await pool.connect();
  try {
    await client.query(`
      ALTER TABLE users DROP COLUMN IF EXISTS email_verified,
      DROP COLUMN IF EXISTS email_verified_at,
      DROP COLUMN IF EXISTS verification_token,
      DROP COLUMN IF EXISTS verification_token_expires_at,
      DROP COLUMN IF EXISTS otp,
      DROP COLUMN IF EXISTS otp_expires_at,
      DROP COLUMN IF EXISTS otp_attempts,
      DROP COLUMN IF EXISTS password_reset_token,
      DROP COLUMN IF EXISTS password_reset_expires_at
    `);

    console.log('✓ Auth fields removed from users table');
  } finally {
    client.release();
    await pool.end();
  }
}

await up();