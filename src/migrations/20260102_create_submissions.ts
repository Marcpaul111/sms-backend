import pool from '../config/db.ts';

export async function up() {
  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS submissions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
        assignment_id UUID NOT NULL REFERENCES assignments(id) ON DELETE CASCADE,
        attachments JSONB DEFAULT '[]'::jsonb,
        submitted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        status VARCHAR(50) DEFAULT 'submitted',
        UNIQUE(student_id, assignment_id)
      )
    `);
    console.log('✓ submissions table created');
  } finally {
    client.release();
  }
}

export async function down() {
  const client = await pool.connect();
  try {
    await client.query(`DROP TABLE IF EXISTS submissions`);
    console.log('✓ submissions table dropped');
  } finally {
    client.release();
  }
}

await up();