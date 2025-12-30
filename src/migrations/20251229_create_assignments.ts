import pool from '../config/db.ts';

export async function up() {
  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS assignments (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        teacher_id UUID NOT NULL REFERENCES teachers(id) ON DELETE CASCADE,
        subject_id UUID NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
        class_id UUID NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
        section_id UUID NOT NULL REFERENCES sections(id) ON DELETE CASCADE,
        title VARCHAR(200) NOT NULL,
        description TEXT,
        due_at TIMESTAMP NOT NULL,
        attachments JSONB DEFAULT '[]'::jsonb,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('✓ assignments table created');
  } finally {
    client.release();
    await pool.end();
  }
}

export async function down() {
  const client = await pool.connect();
  try {
    await client.query(`DROP TABLE IF EXISTS assignments`);
    console.log('✓ assignments table dropped');
  } finally {
    client.release();
    await pool.end();
  }
}

await up();

