import pool from '../config/db';

export const getUserByEmail = async (email: string) => {
  const client = await pool.connect();
  try {
    const r = await client.query('SELECT * FROM users WHERE email = $1', [email]);
    return r.rows[0] || null;
  } finally {
    client.release();
  }
};

export const getUserById = async (id: string) => {
  const client = await pool.connect();
  try {
    const r = await client.query('SELECT * FROM users WHERE id = $1', [id]);
    return r.rows[0] || null;
  } finally {
    client.release();
  }
};

export const getUserByVerificationToken = async (token: string) => {
  const client = await pool.connect();
  try {
    const r = await client.query(
      `SELECT * FROM users 
       WHERE verification_token = $1 
       AND verification_token_expires_at > NOW()`,
      [token]
    );
    return r.rows[0] || null;
  } finally {
    client.release();
  }
};

export const getUserByEmailAndOtp = async (email: string, otp: string) => {
  const client = await pool.connect();
  try {
    const r = await client.query(
      `SELECT * FROM users 
       WHERE email = $1 
       AND otp = $2 
       AND otp_expires_at > NOW()`,
      [email, otp]
    );
    return r.rows[0] || null;
  } finally {
    client.release();
  }
};

export const getUserByEmailAndResetToken = async (email: string, token: string) => {
  const client = await pool.connect();
  try {
    const r = await client.query(
      `SELECT * FROM users 
       WHERE email = $1 
       AND password_reset_token = $2 
       AND password_reset_expires_at > NOW()`,
      [email, token]
    );
    return r.rows[0] || null;
  } finally {
    client.release();
  }
};

export const createUser = async (
  name: string,
  email: string,
  passwordHash: string,
  role: string,
  verificationToken: string,
  tokenExpires: Date
) => {
  const client = await pool.connect();
  try {
    const r = await client.query(
      `INSERT INTO users (name, email, password, role, verification_token, verification_token_expires_at)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, email, role`,
      [name, email, passwordHash, role, verificationToken, tokenExpires]
    );
    return r.rows[0];
  } finally {
    client.release();
  }
};

export const updateUserVerification = async (userId: string) => {
  const client = await pool.connect();
  try {
    await client.query(
      `UPDATE users 
       SET email_verified = TRUE, 
           email_verified_at = NOW(),
           verification_token = NULL,
           verification_token_expires_at = NULL
       WHERE id = $1`,
      [userId]
    );
  } finally {
    client.release();
  }
};

export const setUserOtp = async (userId: string, otp: string, expiresAt: Date) => {
  const client = await pool.connect();
  try {
    await client.query(
      `UPDATE users 
       SET otp = $1, otp_expires_at = $2, otp_attempts = 0
       WHERE id = $3`,
      [otp, expiresAt, userId]
    );
  } finally {
    client.release();
  }
};

export const clearOtpAndSetResetToken = async (userId: string, token: string, expiresAt: Date) => {
  const client = await pool.connect();
  try {
    await client.query(
      `UPDATE users 
       SET otp = NULL, 
           otp_expires_at = NULL,
           password_reset_token = $1,
           password_reset_expires_at = $2
       WHERE id = $3`,
      [token, expiresAt, userId]
    );
  } finally {
    client.release();
  }
};

export const updatePasswordAndClearReset = async (userId: string, hashedPassword: string) => {
  const client = await pool.connect();
  try {
    await client.query(
      `UPDATE users 
       SET password = $1, 
           password_reset_token = NULL,
           password_reset_expires_at = NULL
       WHERE id = $2`,
      [hashedPassword, userId]
    );
  } finally {
    client.release();
  }
};

export const updatePasswordAndVerifyByToken = async (userId: string, hashedPassword: string) => {
  const client = await pool.connect();
  try {
    await client.query(
      `UPDATE users
       SET password = $1,
           email_verified = TRUE,
           email_verified_at = NOW(),
           verification_token = NULL,
           verification_token_expires_at = NULL,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $2`,
      [hashedPassword, userId]
    );
  } finally {
    client.release();
  }
};

export const updateSessionVersion = async (userId: string, sessionVersion: string) => {
  const client = await pool.connect();
  try {
    await client.query(
      `UPDATE users 
       SET session_version = $1,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $2`,
      [sessionVersion, userId]
    );
  } finally {
    client.release();
  }
};

export const getSessionVersionByUserId = async (userId: string): Promise<string | null> => {
  const client = await pool.connect();
  try {
    const r = await client.query(
      `SELECT session_version FROM users WHERE id = $1`,
      [userId]
    );
    const row = r.rows[0];
    return row?.session_version || null;
  } finally {
    client.release();
  }
};

export const getTeacherByUserId = async (userId: string) => {
  const client = await pool.connect();
  try {
    const r = await client.query(
      `SELECT * FROM teachers WHERE user_id = $1`,
      [userId]
    );
    return r.rows[0] || null;
  } finally {
    client.release();
  }
};

export const createTeacherByUserId = async (userId: string) => {
  const client = await pool.connect();
  try {
    const r = await client.query(
      `INSERT INTO teachers (user_id, is_active)
       VALUES ($1, FALSE)
       ON CONFLICT (user_id) DO NOTHING
       RETURNING id, is_active`,
      [userId]
    );
    return r.rows[0] || null;
  } finally {
    client.release();
  }
};

export const activateTeacherByUserId = async (userId: string) => {
  const client = await pool.connect();
  try {
    await client.query(
      `UPDATE teachers
       SET is_active = TRUE, updated_at = CURRENT_TIMESTAMP
       WHERE user_id = $1`,
      [userId]
    );
  } finally {
    client.release();
  }
};

export const incrementOtpAttempts = async (userId: string): Promise<number> => {
  const client = await pool.connect();
  try {
    const r = await client.query(
      `UPDATE users 
       SET otp_attempts = COALESCE(otp_attempts, 0) + 1
       WHERE id = $1
       RETURNING otp_attempts`,
      [userId]
    );
    return r.rows[0]?.otp_attempts ?? 0;
  } finally {
    client.release();
  }
};

export const createTeacherAssignment = async (
  teacherUserId: string,
  subjectId: string,
  classId: string,
  sectionId: string
) => {
  const client = await pool.connect();
  try {
    const t = await client.query(
      `SELECT id FROM teachers WHERE user_id = $1`,
      [teacherUserId]
    );
    const teacherId = t.rows[0]?.id;
    if (!teacherId) {
      throw new Error('Teacher not found');
    }
    const r = await client.query(
      `INSERT INTO teacher_assignments (teacher_id, subject_id, class_id, section_id)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (teacher_id, subject_id, class_id, section_id) DO NOTHING
       RETURNING id`,
      [teacherId, subjectId, classId, sectionId]
    );
    return { id: r.rows[0]?.id || null };
  } finally {
    client.release();
  }
};

export const listAssignmentsByTeacherUserId = async (teacherUserId: string) => {
  const client = await pool.connect();
  try {
    const r = await client.query(
      `SELECT 
         ta.id,
         ta.assigned_at,
         s.id as subject_id, s.name as subject_name, s.code as subject_code,
         c.id as class_id, c.name as class_name,
         sec.id as section_id, sec.name as section_name
       FROM teacher_assignments ta
       JOIN teachers t ON ta.teacher_id = t.id
       JOIN subjects s ON ta.subject_id = s.id
       JOIN classes c ON ta.class_id = c.id
       JOIN sections sec ON ta.section_id = sec.id
       WHERE t.user_id = $1
       ORDER BY ta.assigned_at DESC`,
      [teacherUserId]
    );
    return r.rows;
  } finally {
    client.release();
  }
};

export const createAssignment = async (
  teacherUserId: string,
  subjectId: string,
  classId: string,
  sectionId: string,
  title: string,
  description: string | null,
  dueAt: Date,
  attachments: any[]
) => {
  const client = await pool.connect();
  try {
    const t = await client.query(`SELECT id FROM teachers WHERE user_id = $1`, [teacherUserId]);
    const teacherId = t.rows[0]?.id;
    if (!teacherId) {
      throw new Error('Teacher not found');
    }
    const r = await client.query(
      `INSERT INTO assignments (teacher_id, subject_id, class_id, section_id, title, description, due_at, attachments)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING id`,
      [teacherId, subjectId, classId, sectionId, title, description, dueAt, JSON.stringify(attachments || [])]
    );
    return r.rows[0];
  } finally {
    client.release();
  }
};

export const listAssignmentsForTeacher = async (teacherUserId: string) => {
  const client = await pool.connect();
  try {
    const r = await client.query(
      `SELECT a.*, s.name as subject_name, c.name as class_name, sec.name as section_name
       FROM assignments a
       JOIN teachers t ON a.teacher_id = t.id
       JOIN subjects s ON a.subject_id = s.id
       JOIN classes c ON a.class_id = c.id
       JOIN sections sec ON a.section_id = sec.id
       WHERE t.user_id = $1
       ORDER BY a.created_at DESC`,
      [teacherUserId]
    );
    return r.rows;
  } finally {
    client.release();
  }
};

