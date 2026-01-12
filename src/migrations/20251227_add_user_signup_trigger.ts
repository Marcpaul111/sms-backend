import pool from '../config/db.ts';

export async function up() {
  const client = await pool.connect();
  try {
    await client.query(`
      CREATE OR REPLACE FUNCTION notify_user_signup()
      RETURNS trigger AS $$
      BEGIN
        PERFORM pg_notify(
          'user_events',
          json_build_object(
            'type', 'user_signup',
            'user_id', NEW.id,
            'role', NEW.role,
            'email', NEW.email,
            'name', NEW.name,
            'created_at', NOW()
          )::text
        );
        RETURN NULL;
      END;
      $$ LANGUAGE plpgsql;
    `);

    await client.query(`
      DROP TRIGGER IF EXISTS trg_notify_user_signup ON users;
      CREATE TRIGGER trg_notify_user_signup
      AFTER INSERT ON users
      FOR EACH ROW
      EXECUTE FUNCTION notify_user_signup();
    `);

    console.log('✓ Trigger for user signup notifications created');
  } finally {
    client.release();
  }
}

export async function down() {
  const client = await pool.connect();
  try {
    await client.query(`DROP TRIGGER IF EXISTS trg_notify_user_signup ON users`);
    await client.query(`DROP FUNCTION IF EXISTS notify_user_signup`);
    console.log('✓ Trigger and function removed');
  } finally {
    client.release();
  }
}

await up();

