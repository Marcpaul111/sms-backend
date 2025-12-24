import pool from '../config/db.ts';

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

